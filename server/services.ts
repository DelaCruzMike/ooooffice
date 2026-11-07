import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { cleanAvatar, DEFAULT_AVATAR, type Player, type Role, type WorkLink } from '../shared/world.js';
const env = process.env;
export const supabase = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
export const livekit = env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET ? new RoomServiceClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET) : null;
export let voiceReady = !livekit;
export async function initializeVoice() {
  if (!livekit) return;
  voiceReady = false;
  // Expire any previously issued but unused join token before cleaning up sessions
  // left by a crashed/sleeping server. No new voice credentials are issued until done.
  await new Promise(r => setTimeout(r, 20000));
  const rooms = await livekit.listRooms();
  for (const room of rooms.filter(r => r.name.startsWith('ooooffice-'))) {
    for (const participant of await livekit.listParticipants(room.name)) await livekit.removeParticipant(room.name, participant.identity);
  }
  voiceReady = true;
}
export type Identity = { id: string; email: string; role: Role; name: string; department: string; avatar: typeof DEFAULT_AVATAR };
export const loadTesting = env.NODE_ENV === 'test' && env.ENABLE_LOAD_TEST === 'true' && Boolean(env.LOAD_TEST_KEY);
export async function authenticate(token: string): Promise<Identity> {
  if (loadTesting && token.startsWith(`${env.LOAD_TEST_KEY}:`)) {
    const id = token.slice(env.LOAD_TEST_KEY!.length + 1).replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    if (!id) throw new Error('Invalid test identity');
    return { id: `test-${id}`, email: `${id}@example.invalid`, role: 'member', name: `Pilot ${id}`, department: 'Test', avatar: DEFAULT_AVATAR };
  }
  if (!supabase || !token) throw new Error('Team sign-in is not configured. The local preview is available without connecting to the office.');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) throw new Error('Please sign in again.');
  const email = user.email.toLowerCase();
  if (!user.email_confirmed_at || !user.identities?.some(i => i.provider === 'google' && String(i.identity_data?.email || '').toLowerCase() === email && i.identity_data?.email_verified !== false)) throw new Error('Please use a verified Google account to enter this office.');
  // Bootstrap only the explicitly configured owner, whose email is verified by Google/Supabase.
  if (env.OWNER_EMAIL && email === env.OWNER_EMAIL.toLowerCase()) {
    const { error } = await supabase.from('memberships').upsert({ email, role: 'owner', approved: true }, { onConflict: 'email' });
    if (error) throw new Error('Office membership setup is incomplete.');
  }
  const membership = await supabase.from('memberships').select('role,approved,department').eq('email', email).maybeSingle();
  if(!membership.error&&!membership.data){await supabase.from('memberships').upsert({email,role:'member',approved:false},{onConflict:'email',ignoreDuplicates:true});}
  if (membership.error || !membership.data?.approved) throw new Error('Your email is not on the approved team list yet. Ask the office owner to invite you.');
  const profile = await supabase.from('profiles').select('name,avatar').eq('id', user.id).maybeSingle();
  if (profile.error) throw new Error('Your profile could not be loaded. Please try again.');
  return { id: user.id, email, role: membership.data.role, department: membership.data.department || 'Team', name: profile.data?.name || String(user.user_metadata.full_name || email.split('@')[0]).slice(0, 32), avatar: cleanAvatar(profile.data?.avatar) };
}
export async function saveProfile(userId: string, p: Player) {
  if (!supabase) { if (loadTesting) return; throw new Error('Profile storage is unavailable.'); }
  const { error } = await supabase.from('profiles').upsert({ id: userId, name: p.name, avatar: p.avatar });
  if (error) throw new Error('Appearance could not be saved. Please try again.');
}
export async function loadLinks(): Promise<WorkLink[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('office_config').select('value').eq('key', 'links').maybeSingle();
  if (error) throw new Error('Work links could not be loaded.');
  return validateLinks(data?.value ?? []);
}
export function validateLinks(value: unknown): WorkLink[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error('Use up to 12 work links.');
  return value.map(v => {
    if (!v || typeof v.label !== 'string' || !v.label.trim() || typeof v.url !== 'string') throw new Error('Each link needs a title and HTTPS address.');
    const url = new URL(v.url); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Work links must use HTTPS.');
    return { label: v.label.trim().slice(0, 48), url: url.href.slice(0, 2048) };
  });
}
export async function voiceToken(p: Player, zone: string) {
  if (!livekit) throw new Error('Voice is not configured yet. Movement and text chat are available.');
  if (!voiceReady) throw new Error('Voice is preparing after an office restart. Please try again in a moment.');
  const token = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, { identity: p.id, name: p.name, ttl: '15s' });
  token.addGrant({ roomJoin: true, room: `ooooffice-${zone}`, canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false });
  return { token: await token.toJwt(), url: env.LIVEKIT_URL!, zone };
}
export async function evictVoice(id: string, zone: string) {
  if (!livekit) return true;
  try { await livekit.removeParticipant(`ooooffice-${zone}`, id); return true; }
  catch (error) {
    // Absent participants are already disconnected; other failures must not be treated as success.
    const e = error as { status?: number; code?: string; message?: string };
    if (e.status !== 404 && e.code !== 'not_found') throw new Error('Voice service did not confirm disconnection. Please try again.');
    return false;
  }
}
