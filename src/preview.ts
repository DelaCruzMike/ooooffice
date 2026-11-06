import { DEFAULT_AVATAR, makePlayer, roomAt, cleanAvatar, SEATS, newGame, dropDisc, type Snapshot, type Player, type Vec, type Avatar, type ChatMessage } from '../shared/world';
export const PREVIEW_ID = 'you-preview';
export class LocalPreview {
  snapshot: Snapshot;
  constructor(avatar?: Avatar) {
    const you = makePlayer(PREVIEW_ID, 'You', avatar || DEFAULT_AVATAR); you.role = 'owner';
    const actors: Player[] = [
      { ...makePlayer('demo-1', 'Alex · demo', { ...DEFAULT_AVATAR, skin: '#a56f50', shirt: '#cc9f79', style: 'bun' }), x: -6, z: 2, rotation: -1.3, emote: 'wave' },
      { ...makePlayer('demo-2', 'Sam · demo', { ...DEFAULT_AVATAR, shirt: '#8c9fba', hair: '#d4bd86', style: 'bob' }), x: -12, z: 4, rotation: .5 },
      { ...makePlayer('demo-3', 'Jules · demo', { ...DEFAULT_AVATAR, shirt: '#bba3c7', accessory: 'glasses' }), x: -7, z: -3, rotation: 2.4 },
    ]; this.snapshot = { players: [you, ...actors], locked: false, host: null, game: newGame(), links: [] };
  }
  get me() { return this.snapshot.players[0]; }
  move(p: Vec, direction: Vec) {
    if (this.me.seat) return;
    Object.assign(this.me, p, { room: roomAt(p), moving: Math.hypot(direction.x, direction.z) > .01 });
    if (this.me.moving) { this.me.rotation = Math.atan2(direction.x, direction.z); this.me.emote = ''; }
    if (this.snapshot.host === PREVIEW_ID && this.me.room !== 'meeting') { this.snapshot.host = null; this.snapshot.locked = false; }
  }
  action(type: string, d: Record<string, unknown>): ChatMessage | null {
    const p = this.me;
    if (type === 'avatar') p.avatar = cleanAvatar(d.avatar);
    if (type === 'status') p.status = d.status as Player['status'];
    if (type === 'emote') p.emote = String(d.emote);
    if (type === 'seat') {
      if (p.seat) { p.seat = null; p.emote = ''; }
      else { const s = SEATS.find(s => s.id === d.id); if (s && p.room === s.room && Math.hypot(s.x - p.x, s.z - p.z) < 3) Object.assign(p, { seat: s.id, ...s, id: PREVIEW_ID, emote: 'sit', moving: false }); }
    }
    if (type === 'meeting') { this.snapshot.locked = Boolean(d.locked); this.snapshot.host = PREVIEW_ID; }
    if (type === 'game:join' && p.room === 'recreation' && !this.snapshot.game.players.includes(PREVIEW_ID)) this.snapshot.game.players.push(PREVIEW_ID);
    if (type === 'game:drop') dropDisc(this.snapshot.game, PREVIEW_ID, Number(d.column));
    if (type === 'game:reset' || type === 'game:leave') this.snapshot.game = newGame();
    if (type === 'chat' && String(d.text).trim()) return { id: crypto.randomUUID(), author: 'You', text: String(d.text).trim().slice(0, 500), scope: d.scope === 'room' ? 'room' : 'office', room: p.room, at: Date.now() };
    return null;
  }
}
