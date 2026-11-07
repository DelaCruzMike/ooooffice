import { SnapshotDiffer } from '../shared/sync.js';
import { Room, type Client } from '@colyseus/core';
import { OfficeEngine } from './engine.js';
import { authenticate, loadTesting, evictVoice, loadLinks, saveProfile, type Identity } from './services.js';
import { roomAt, voiceZone, cleanAvatar, PROTOCOL_VERSION, type Vec, type Player } from '../shared/world.js';
export let office: OfficeRoom;
export class OfficeRoom extends Room {
  // Authenticate at HTTP matchmaking, before reserving any of the 50 seats.
  static async onAuth(token:string,options:{token?:string;protocol?:number},context:{headers?:{origin?:string}}){
    if(options.protocol!==PROTOCOL_VERSION)throw new Error('Your office version changed. Reload this page to reconnect.');
    const origin=context.headers?.origin,allowed=(process.env.FRONTEND_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173').split(',').map(s=>s.trim());
    if(origin&&!allowed.includes(origin))throw new Error('This website is not an allowed office client.');
    const value=options.token||token||'';return {identity:await authenticate(value),token:value};
  }

  engine = new OfficeEngine();
  identities = new Map<string, Identity>();
  tokens = new Map<string, string>();
  voiceSessions = new Map<string, string>();
  voiceTransitions = new Set<string>();
  voiceExpiry = new Map<string, number>();
  private nextVoiceAttempt = new Map<string, number>();
  private differ = new SnapshotDiffer();
  voiceRemoval = evictVoice;
  identityResolver = authenticate;
  authCheck = false;
  private joining = new Map<string, Promise<void>>();
  private counts = new Map<string, { at: number; count: number }>();
  private saving = new Set<string>();
  private lastSave = new Map<string, number>();
  private permit(id: string) {
    const now = Date.now(); let rate = this.counts.get(id);
    if (!rate || now - rate.at > 1000) { rate = { at: now, count: 0 }; this.counts.set(id, rate); }
    return ++rate.count <= 40;
  }
  onCreate() {
    office = this; this.maxClients = 50; this.autoDispose = false;
    loadLinks().then(links => this.engine.links = links).catch(() => console.warn('Office links unavailable; admin can retry.'));
    this.setSimulationInterval(dt => this.engine.tick(dt / 1000, (p, next) => this.transition(p, next)), 50);
    this.clock.setInterval(() => { const patch = this.differ.diff(this.engine.snapshot()); if (patch) this.broadcast('patch', patch); else this.broadcast('heartbeat', Date.now()); }, 100);
    if(loadTesting)this.onMessage('test:place',(c,d)=>{const p=this.engine.players.get(c.sessionId);const spots=[{x:-6,z:-.55,room:'lounge'},{x:-6,z:-.55,room:'lounge'},{x:2.8,z:8.5,room:'lounge'},{x:2.8,z:8.5,room:'lounge'},{x:-20.5,z:-13.2,room:'social'},{x:-20.5,z:-10.8,room:'hallway'}];if(p&&Number.isInteger(d?.slot)&&spots[d.slot])Object.assign(p,spots[d.slot],{y:0,grounded:true});});
    this.onMessage('sync', c => { if(this.permit(c.sessionId)) c.send('snapshot',this.engine.snapshot()); });
    this.clock.setInterval(() => { void this.revalidate(); }, 15000);
    this.clock.setInterval(()=>{for(const c of this.clients)c.send('door:requests',this.engine.requestsFor(c.sessionId));},500);
    this.onMessage('input', (c, d) => this.permit(c.sessionId) && this.engine.input(c.sessionId, d));
    for (const type of ['status', 'emote', 'jump', 'stand', 'seat', 'bed', 'meeting', 'game:join', 'game:drop', 'game:reset', 'game:leave', 'game:dart', 'game:chess', 'game:start', 'game:shot', 'game:place', 'door:open', 'door:close', 'door:request', 'door:admit', 'door:dismiss', 'chat']) this.onMessage(type, (c, d) => {
      if (!this.permit(c.sessionId)) return;
      const message = this.engine.action(c.sessionId, type, d);
      if (message) for (const recipient of this.clients) {
        const p = this.engine.players.get(recipient.sessionId);
        if (message.scope === 'office' || p?.room === message.room) recipient.send('chat', message);
      }
    });
    this.onMessage('auth:refresh', async (c, d) => {
      try { const i = await this.identityResolver(String(d?.token || '')); if (this.engine.players.get(c.sessionId)?.userId !== i.id) throw new Error('Identity changed.'); this.tokens.set(c.sessionId, String(d.token)); }
      catch { await this.removeSession(c.sessionId, 'Please sign in again.'); }
    });
    this.onMessage('voice:state', (c, d) => { const p = this.engine.players.get(c.sessionId); if (p) p.mic = this.voiceSessions.has(p.id) && !p.forcedMute && d?.microphone === true; });
    this.onMessage('avatar', async (c, d) => {
      const p = this.engine.players.get(c.sessionId); if (!p || this.saving.has(p.id) || Date.now() - (this.lastSave.get(p.id) || 0) < 1500) return;
      this.saving.add(p.id); this.lastSave.set(p.id, Date.now());
      const next = { ...p, avatar: cleanAvatar(d?.avatar) };
      try { await saveProfile(p.userId, next); p.avatar = next.avatar; c.send('notice', 'Your look is saved.'); }
      catch (error) { c.send('notice', (error as Error).message); }
      finally { this.saving.delete(p.id); }
    });
  }
  async onAuth(c: Client, options: { token?: string; protocol?: number }, request: { headers?: { origin?: string } }) {
    if(options.protocol !== PROTOCOL_VERSION) throw new Error('Your office version changed. Reload this page to reconnect.');
    const origin = request.headers?.origin;
    const allowed = (process.env.FRONTEND_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(s => s.trim());
    if (origin && !allowed.includes(origin)) throw new Error('This website is not an allowed office client.');
    const identity = await this.identityResolver(options.token || '');
    return { identity, token: options.token || '' };
  }
  async onJoin(c: Client, _options: unknown, auth: { identity: Identity; token: string }) {
    const userId = auth.identity.id;
    const previous = this.joining.get(userId) || Promise.resolve();
    let release!: () => void; const current = new Promise<void>(r => release = r); this.joining.set(userId, current);
    await previous;
    try {
      for (const p of this.engine.players.values()) if (p.userId === userId) await this.removeSession(p.id, 'Your office was opened on another device.');
      const i = await this.identityResolver(auth.token);
      this.engine.add(c.sessionId, i.id, i.name, i.avatar, i.role, i.department);
      this.identities.set(c.sessionId, i); this.tokens.set(c.sessionId, auth.token);
      c.send('snapshot', this.engine.snapshot());
    } finally { release(); if (this.joining.get(userId) === current) this.joining.delete(userId); }
  }
  onDispose(){this.engine.dispose();}
  async onLeave(c: Client) {
    const zone = this.voiceSessions.get(c.sessionId);
    this.engine.remove(c.sessionId); this.identities.delete(c.sessionId); this.tokens.delete(c.sessionId); this.counts.delete(c.sessionId); this.lastSave.delete(c.sessionId); this.nextVoiceAttempt.delete(c.sessionId);
    if (zone) {
      try { await this.stopVoice(c.sessionId); }
      catch { /* Retry stale voice cleanup, without logging identities or tokens. */ this.clock.setTimeout(() => void this.cleanupVoice(c.sessionId), 3000); }
    }
  }
  async stopVoice(id: string) {
    const zone = this.voiceSessions.get(id); if (!zone) return;
    const removed = await this.voiceRemoval(id, zone);
    // An unused token cannot be revoked as a connected participant. Keep the character
    // in the old zone until that short-lived token has expired (including clock skew).
    if (!removed) await new Promise(r => setTimeout(r, Math.max(0, (this.voiceExpiry.get(id) || 0) - Date.now())));
    this.voiceSessions.delete(id); this.voiceExpiry.delete(id);
    const p = this.engine.players.get(id); if (p) { p.voice = false; p.mic = false; }
  }
  async cleanupVoice(id: string) { const zone = this.voiceSessions.get(id); if (!zone) return; try { await this.stopVoice(id); } catch { this.clock.setTimeout(() => void this.cleanupVoice(id), 3000); } }
  async removeSession(id: string, message: string) {
    const c = this.clients.find(c => c.sessionId === id);
    this.engine.remove(id); this.identities.delete(id); this.tokens.delete(id); this.counts.delete(id); this.lastSave.delete(id);
    if (c) { c.send('removed', message); c.leave(4001); }
    try { await this.stopVoice(id); }
    catch (error) { this.clock.setTimeout(() => void this.cleanupVoice(id), 3000); throw error; }
  }
  transition(p: Player, next: Vec) {
    const current = this.voiceSessions.get(p.id);
    const nextZone = voiceZone({ room: roomAt(next) });
    if (this.voiceTransitions.has(p.id)) return nextZone === voiceZone(p);
    if (!current || current === nextZone) return true;
    if (Date.now() < (this.nextVoiceAttempt.get(p.id) || 0)) return false;
    this.voiceTransitions.add(p.id);
    this.stopVoice(p.id).then(() => {
      this.voiceSessions.delete(p.id); p.voice = false; p.mic = false;
      this.clients.find(c => c.sessionId === p.id)?.send('voice:zone', nextZone);
    }).catch((e: Error) => { this.nextVoiceAttempt.set(p.id, Date.now() + 3000); this.clients.find(c => c.sessionId === p.id)?.send('notice', e.message); }).finally(() => this.voiceTransitions.delete(p.id));
    return false;
  }
  async revalidate() {
    if (this.authCheck) return; this.authCheck = true;
    try {
      await Promise.allSettled([...this.tokens].map(async ([id, token]) => {
        try {
          const i = await this.identityResolver(token); const p = this.engine.players.get(id);
          if (p) { p.role = i.role; p.department = i.department; }
        } catch { await this.removeSession(id, 'Your session expired or office access changed. Please sign in again.'); }
      }));
    } finally { this.authCheck = false; }
  }
}
