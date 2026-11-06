import { applyPatch, type Patch } from '../shared/sync';
import { emptySnapshot, PROTOCOL_VERSION } from '../shared/world';
import { createClient, type Session } from '@supabase/supabase-js';
import { Client, type Room } from 'colyseus.js';
import type { Room as VoiceRoom, RemoteParticipant } from 'livekit-client';
import { type Snapshot, type ChatMessage, type Player, type Vec, type WorkLink, voiceZone } from '../shared/world';
export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SERVER_URL);
export const auth = configured ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;
export const serverUrl = String(import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:2567').replace(/\/$/, '');
export async function api(path: string, body?: unknown) {
  const session = (await auth?.auth.getSession())?.data.session;
  if (!session) throw new Error('Please sign in before entering the team office.');
  const response = await fetch(`${serverUrl}/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000) });
  const data = await response.json().catch(() => ({ error: 'The office is starting. Please try again shortly.' }));
  if (!response.ok) throw new Error(data.error || 'The office could not complete that action.');
  return data;
}
export class OfficeConnection {
  room?: Room;
  intentional = false;
  unsubscribe?: () => void;
  async connect(session: Session, handlers: { snapshot: (s: Snapshot, id: string) => void; chat: (m: ChatMessage) => void; notice: (s: string) => void; removed: (s: string) => void; disconnected: () => void; voiceZone: () => void; muted: (s: string) => void }) {
    // Wake a free instance before starting the authenticated matchmaking request.
    await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(90000) }).then(r => { if (!r.ok) throw new Error('The office is still starting.'); });
    const { roomId } = await api('/session', {});
    this.room = await new Client(serverUrl.replace(/^http/, 'ws')).joinById(roomId, { token: session.access_token, protocol: PROTOCOL_VERSION });
    let latest: Snapshot = emptySnapshot();
    this.room.onMessage('snapshot', (s: Snapshot) => { if(s.protocol!==PROTOCOL_VERSION){handlers.removed('Your office version changed. Reload this page.');return;} latest=s; handlers.snapshot(s,this.room!.sessionId); });
    this.room.onMessage('patch', (p: Patch) => { latest=applyPatch(latest,p); handlers.snapshot(latest,this.room!.sessionId); });
    this.room.onMessage('heartbeat', () => {});
    this.room.onMessage('chat', handlers.chat); this.room.onMessage('notice', handlers.notice);
    this.room.onMessage('removed', (text: string) => { this.intentional = true; handlers.removed(text); });
    this.room.onMessage('voice:zone', handlers.voiceZone); this.room.onMessage('voice:muted', handlers.muted);
    this.room.onLeave(() => { if (!this.intentional) handlers.disconnected(); });
    this.room.onError((_code, message) => handlers.notice(message || 'The connection needs attention.'));
    this.send('sync');
    const subscription = auth?.auth.onAuthStateChange((_event, s) => { if (s && this.room) this.send('auth:refresh', { token: s.access_token }); }).data.subscription;
    this.unsubscribe = () => subscription?.unsubscribe();
  }
  send(type: string, data: unknown = {}) { if (this.room?.connection.isOpen) this.room.send(type, data); }
  async disconnect() { this.intentional = true; this.unsubscribe?.(); await this.room?.leave(); this.room = undefined; }
}
export type VoiceState = { connected: boolean; microphone: boolean; deafened: boolean; busy: boolean; speaking: string[]; error: string; wanted: boolean };
export class OfficeVoice {
  room?: VoiceRoom;
  state: VoiceState = { connected: false, microphone: false, deafened: false, busy: false, speaking: [], error: '', wanted: false };
  zone = '';
  identity = '';
  players: Player[] = [];
  volumes = new Map<string, number>();
  elements = new Set<HTMLMediaElement>();
  desiredMicrophone = false;
  constructor(public changed: (s: VoiceState) => void, public send: (type: string, data: unknown) => void) {}
  update(patch: Partial<VoiceState>) { Object.assign(this.state, patch); this.changed({ ...this.state }); }
  async connect(id: string, microphone = false) {
    if (this.state.busy) return;
    this.identity = id; this.desiredMicrophone = microphone; this.update({ busy: true, error: '', wanted: true });
    try {
      await this.closeRoom();
      const result = await api('/voice', { sessionId: id, microphone });
      const { Room: VoiceRoom, RoomEvent, Track } = await import('livekit-client');
      const room = new VoiceRoom({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); this.room = room; this.zone = result.zone;
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio) { const element = track.attach(); element.dataset.participant = participant.identity; this.elements.add(element); document.body.appendChild(element); this.updateVolumes(); }
      });
      room.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(el => { this.elements.delete(el); el.remove(); }));
      room.on(RoomEvent.ActiveSpeakersChanged, speakers => this.update({ speaking: speakers.map(p => p.identity) }));
      room.on(RoomEvent.LocalTrackUnpublished, () => this.update({ microphone: false }));
      room.on(RoomEvent.Disconnected, () => { if (this.room === room) this.update({ connected: false, microphone: false, speaking: [] }); });
      await room.connect(result.url, result.token); await room.startAudio();
      if (!this.state.wanted) throw new Error('Voice connection cancelled.');
      if (this.desiredMicrophone) await room.localParticipant.setMicrophoneEnabled(true);
      if (!this.desiredMicrophone || !this.state.wanted) await room.localParticipant.setMicrophoneEnabled(false);
      const enabled = this.desiredMicrophone && this.state.wanted;
      this.update({ connected: true, microphone: enabled, error: '' }); this.send('voice:state', { microphone: enabled }); this.updateVolumes();
    } catch (e) {
      await this.closeRoom(); this.desiredMicrophone = false;
      this.update({ connected: false, microphone: false, wanted: false, error: (e as Error).message || 'Voice is unavailable. You can still use text chat.' });
      // Retire unused credentials if permission or transport setup failed.
      void api('/voice', { sessionId: id, disconnect: true }).catch(() => {});
    } finally { this.update({ busy: false }); }
  }
  async microphone(enabled: boolean) {
    this.desiredMicrophone = enabled;
    if (this.state.busy) return;
    if (!this.state.connected) { if (enabled) return this.connect(this.identity, true); return; }
    try { await this.room?.localParticipant.setMicrophoneEnabled(enabled); this.desiredMicrophone = enabled; this.update({ microphone: enabled, error: '' }); this.send('voice:state', { microphone: enabled }); }
    catch { this.update({ error: 'Microphone access was denied or no microphone is available. Listening and text chat still work.' }); }
  }
  async zoneChanged() { await this.closeRoom(); this.update({ connected: false, microphone: false }); }
  sync(players: Player[], id: string) {
    this.players = players; this.identity = id; this.updateVolumes();
    const me = players.find(p => p.id === id);
    if (me && this.state.wanted && !this.state.busy && this.zone && voiceZone(me) !== this.zone) void this.connect(id, this.desiredMicrophone);
  }
  updateVolumes() {
    const me = this.players.find(p => p.id === this.identity);
    if (!me) return;
    for (const participant of this.room?.remoteParticipants.values() || []) {
      const p = this.players.find(p => p.id === participant.identity);
      const distance = p ? Math.hypot(p.x - me.x, p.z - me.z) : Infinity;
      const nearby = this.zone === 'commons' ? Math.max(0, Math.min(1, (14 - distance) / 10)) : 1;
      const volume = this.state.deafened ? 0 : nearby * (this.volumes.get(participant.identity) ?? 1);
      (participant as RemoteParticipant).setVolume(volume);
    }
  }
  setVolume(id: string, volume: number) { this.volumes.set(id, volume); this.updateVolumes(); }
  deafen() { this.update({ deafened: !this.state.deafened }); this.updateVolumes(); }
  async closeRoom() { const room = this.room; this.room = undefined; await room?.disconnect(); this.elements.forEach(el => el.remove()); this.elements.clear(); }
  async disconnect(notify = true) {
    this.desiredMicrophone = false; this.update({ wanted: false, connected: false, microphone: false, speaking: [] }); await this.closeRoom();
    this.send('voice:state', { microphone: false }); if (notify && this.identity) try { await api('/voice', { sessionId: this.identity, disconnect: true }); } catch (e) { this.update({ error: (e as Error).message }); }
    this.zone = '';
  }
  async forcedMute(text: string) { await this.disconnect(false); this.update({ error: text }); }
}
