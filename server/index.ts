import {cleanFloors,mayEnter,mayManageFloor,roomFloor,resolveVoice,inventoryUrl} from '../shared/building.js';
import {cleanRoomSettings,mayManage} from '../shared/room-settings.js';
import 'dotenv/config';
import http from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { OfficeRoom, office } from './OfficeRoom.js';
import { authenticate, supabase, livekit, voiceToken, validateLinks, loadTesting, initializeVoice, voiceReady, type Identity } from './services.js';
import { OfficeServer } from './guarded-server.js';
import { voiceZone, PROTOCOL_VERSION } from '../shared/world.js';
const app = express(); app.disable('x-powered-by');
const origins = (process.env.FRONTEND_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({ origin: origins, methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
app.use(express.json({ limit: '16kb' }));
app.get('/health', (_req, res) => res.json({ ok: true, protocol: PROTOCOL_VERSION, accounts: Boolean(supabase), voice: Boolean(livekit), voiceReady, loadTesting }));
type AuthRequest = Request & { identity?: Identity };
app.use('/api', async (req: AuthRequest, res, next) => {
  try { req.identity = await authenticate(req.headers.authorization?.replace(/^Bearer /, '') || ''); next(); }
  catch (e) { res.status(401).json({ error: (e as Error).message }); }
});
const wrap = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
app.post('/api/session', wrap(async (req, res) => {
  if (!office) throw new Error('The office is still starting. Please try again.');
  // Free the existing seat before reserving a replacement, including when the office has 50 members.
  for (const p of office.engine.players.values()) if (p.userId === req.identity!.id) await office.removeSession(p.id, 'Your office was opened on another device.');
  res.json({ roomId: office.roomId, identity: req.identity });
}));
const voiceBusy = new Set<string>();
app.post('/api/voice', wrap(async (req, res) => {
  const id = String(req.body.sessionId || '');
  const p = office?.engine.players.get(id);
  if (!p || p.userId !== req.identity!.id) { res.status(403).json({ error: 'Join the office before connecting voice.' }); return; }
  if (office.doorTransaction || voiceBusy.has(id) || office.voiceTransitions.has(id)) { res.status(409).json({ error: 'Your conversation is changing. Please try again.' }); return; }
  voiceBusy.add(id); office.voiceTransitions.add(id);
  try {
    await office.stopVoice(id);
    if (!office.engine.players.has(id)) throw new Error('Your office session ended.');
    if (req.body.disconnect) { p.voice = false; p.mic = false; res.json({ ok: true }); return; }
    if(office.engine.roomSettings[p.room]?.voice==='muted')throw new Error('Voice is disabled in this room.');
    if(!p.inElevator&&!mayEnter(p,p.floor))throw new Error('Floor access required.');const zone=resolveVoice(p,office.engine.doors,office.engine.roomSettings);
    if(req.body.zone&&req.body.zone!==zone){res.status(409).json({error:'Your conversation is changing. Please try again.'});return;}
    const result = await voiceToken(p, zone);
    if (!office.engine.players.has(id)||(!p.inElevator&&!mayEnter(p,p.floor))) throw new Error('Your office session ended.');
    if(office.doorTransaction||zone!==resolveVoice(p,office.engine.doors,office.engine.roomSettings)){res.status(409).json({error:'Your conversation is changing. Please try again.'});return;}
    office.voiceSessions.set(id, zone); office.voiceExpiry.set(id, Date.now() + 20000);
    p.voice = true; p.mic = Boolean(req.body.microphone); p.forcedMute = false;
    res.json(result);
  } finally { voiceBusy.delete(id); office.voiceTransitions.delete(id); }
}));
const accessIdentity=(i:Identity)=>({role:i.role,approved:i.approved??true,floors:i.floors??['3' as const],managedFloors:i.managedFloors??[]});
app.post('/api/access-request',wrap(async(req,res)=>{if(!supabase)throw new Error('Account storage unavailable.');const {error}=await supabase.from('memberships').update({access_requested:true}).eq('email',req.identity!.email);if(error)throw new Error('Could not request access.');res.json({ok:true});}));
app.get('/api/inventory',wrap(async(req,res)=>{if(!mayEnter(accessIdentity(req.identity!),'1'))throw new Error('IT access required.');res.json({url:office.engine.inventory});}));
app.post('/api/inventory',wrap(async(req,res)=>{if(!mayManageFloor(accessIdentity(req.identity!),'1'))throw new Error('IT manager access required.');if(!supabase)throw new Error('Storage unavailable.');const url=inventoryUrl(req.body.url);const {error}=await supabase.from('office_config').upsert({key:'it:inventory',value:url});if(error)throw new Error('Inventory link could not be saved.');office.engine.inventory=url;res.json({url});}));
app.post('/api/rooms',wrap(async(req,res)=>{const id=String(req.body.room);if(!mayManageFloor(accessIdentity(req.identity!),roomFloor(id)))throw new Error('Floor manager access required.');if(!supabase)throw new Error('Storage unavailable.');const settings=cleanRoomSettings(id,req.body.settings);const {error}=await supabase.from('office_config').upsert({key:'room:'+id,value:settings});if(error)throw new Error('Room settings could not be saved.');office.engine.roomSettings[id]=settings;await office.reconcileVoice();res.json({ok:true});}));
app.use('/api/admin', (req: AuthRequest, res, next) => {
  if (req.identity!.approved===false || req.identity!.role === 'member') { res.status(403).json({ error: 'Administrator access required.' }); return; } next();
});
app.get('/api/admin/members', wrap(async (_req, res) => {
  if (!supabase) throw new Error('Account storage is not configured.');
  const { data, error } = await supabase.from('memberships').select('email,role,approved,department,floors,managed_floors,access_requested').order('email');
  if (error) throw new Error('Members could not be loaded.'); res.json({ members: data });
}));
app.post('/api/admin/members', wrap(async (req, res) => {
  if (!supabase) throw new Error('Account storage is not configured.');
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
  const { data: existing, error: readError } = await supabase.from('memberships').select('role').eq('email', email).maybeSingle();
  if (readError) throw new Error('Membership could not be checked.');
  const role = req.body.role === 'administrator' ? 'administrator' : 'member';
  if (email === req.identity!.email || !mayManage(req.identity!.role,existing?.role||'member',role)) { res.status(403).json({ error: 'Only the owner can manage administrators. Owner and self-access cannot be changed here.' }); return; }
  const approved = req.body.approved === true;
  const { error } = await supabase.from('memberships').upsert({ email, role, approved, department: String(req.body.department || 'Team').slice(0, 48),floors:cleanFloors(req.body.floors??['3']),managed_floors:cleanFloors(req.body.managed_floors) });
  if (error) throw new Error('Membership could not be updated.');
  let cleanupFailed = false;
  for (const [id, i] of office.identities) if (i.email === email) {
    if (!approved) {const p=office.engine.players.get(id);if(p){p.approved=false;p.floors=[];p.managedFloors=[];}try {await office.stopVoice(id);if(p)office.engine.lobby(p);}catch{cleanupFailed=true;await office.removeSession(id,'Floor access revoked. Please reconnect in the lobby.').catch(()=>{});} }
    else { const p = office.engine.players.get(id); if (p) { p.role=role;p.approved=approved;p.floors=cleanFloors(req.body.floors??['3']);p.managedFloors=cleanFloors(req.body.managed_floors);p.department=String(req.body.department||'Team').slice(0,48);if(!mayEnter(p,p.floor)){await office.stopVoice(id);office.engine.lobby(p);} } }
  }
  if (cleanupFailed) throw new Error('Access is revoked. Voice disconnection is still retrying; check the participant list.');
  res.json({ ok: true });
}));
app.post('/api/admin/participant', wrap(async (req, res) => {
  const id = String(req.body.id || ''), target = office.engine.players.get(id);
  if (!target) throw new Error('That teammate has already left.');
  if (target.userId === req.identity!.id || target.role === 'owner' || (target.role === 'administrator' && req.identity!.role !== 'owner')) { res.status(403).json({ error: 'You cannot moderate this account.' }); return; }
  if (req.body.action === 'remove') await office.removeSession(id, 'An administrator removed you from this office session.');
  else if (req.body.action === 'mute') {
    await office.stopVoice(id); target.forcedMute = true; target.voice = false; target.mic = false;
    office.clients.find(c => c.sessionId === id)?.send('voice:muted', 'An administrator muted your microphone. You can enable it again yourself.');
  } else throw new Error('Choose remove or mute.');
  res.json({ ok: true });
}));
app.post('/api/admin/rooms', wrap(async (req,res)=>{
  if(!supabase)throw new Error('Office storage is unavailable.');
  const id=String(req.body.room),settings=cleanRoomSettings(id,req.body.settings);
  // Store each room separately to avoid lost updates between concurrent administrators.
  const {error}=await supabase.from('office_config').upsert({key:'room:'+id,value:settings});
  if(error)throw new Error('Room settings could not be saved.');
  office.engine.roomSettings[id]=settings;
  if(settings.voice==='muted')for(const p of office.engine.players.values())if(p.room===id)await office.stopVoice(p.id);
  res.json({ok:true});
}));
app.post('/api/admin/links', wrap(async (req, res) => {
  if (!supabase) throw new Error('Office storage is not configured.');
  const links = validateLinks(req.body.links);
  const { error } = await supabase.from('office_config').upsert({ key: 'links', value: links });
  if (error) throw new Error('Work links could not be saved.'); office.engine.links = links; res.json({ ok: true });
}));
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => res.status(400).json({ error: error.message || 'Please try again.' }));
const httpServer = http.createServer(app);
const gameServer = new OfficeServer({ transport: new WebSocketTransport({ server: httpServer, maxPayload: 16 * 1024 }) });
gameServer.define('office', OfficeRoom);
const port = Number(process.env.PORT || 2567);
await gameServer.listen(port, loadTesting ? '127.0.0.1' : process.env.HOST || '0.0.0.0');
await matchMaker.createRoom('office', {});
console.log(`Ooooffice multiplayer listening on port ${port}. Accounts: ${supabase ? 'configured' : 'not configured'}. Voice: ${livekit ? 'configured' : 'not configured'}.`);

if (livekit) { const prepare = () => initializeVoice().catch(() => { console.warn('Voice initialization unavailable; retrying without enabling admission.'); setTimeout(prepare, 15000); }); void prepare(); }
