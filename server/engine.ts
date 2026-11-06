import { randomUUID } from 'node:crypto';
import { makePlayer, move, roomAt, SEATS, ROOMS, newGame, dropDisc, cleanAvatar, type Avatar, type Player, type Vec, type ChatMessage, type WorkLink, type Snapshot, type Role } from '../shared/world.js';
export class OfficeEngine {
  players = new Map<string, Player>();
  inputs = new Map<string, Vec & { at: number }>();
  locked = false;
  host: string | null = null;
  game = newGame();
  links: WorkLink[] = [];
  private rate = new Map<string, { chat: number; emote: number }>();
  add(id: string, userId: string, name: string, avatar: Avatar, role: Role, department: string) {
    if (this.players.size >= 50) throw new Error('The office is full. Please try again shortly.');
    const p = makePlayer(id, name, cleanAvatar(avatar));
    Object.assign(p, { userId, role, department }); this.players.set(id, p); return p;
  }
  remove(id: string) {
    this.players.delete(id); this.inputs.delete(id); this.rate.delete(id);
    if (this.host === id) { this.host = null; this.locked = false; }
    if (this.game.players.includes(id)) this.game = newGame();
  }
  input(id: string, data: unknown) {
    if (!data || typeof data !== 'object') return;
    const { x, z } = data as Vec;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    this.inputs.set(id, { x: Math.max(-1, Math.min(1, x)), z: Math.max(-1, Math.min(1, z)), at: Date.now() });
  }
  tick(dt: number, approveTransition: (p: Player, next: Vec) => boolean = () => true) {
    for (const p of this.players.values()) {
      const input = this.inputs.get(p.id);
      p.moving = false;
      if (!input || Date.now() - input.at > 300 || p.seat) continue;
      const next = move(p, input, dt, this.locked);
      if (!approveTransition(p, next)) continue;
      p.moving = Math.hypot(next.x - p.x, next.z - p.z) > .001;
      if (p.moving) { p.rotation = Math.atan2(input.x, input.z); p.emote = ''; }
      Object.assign(p, next, { room: roomAt(next) });
      if (this.host === p.id && p.room !== 'meeting') { this.host = null; this.locked = false; }
      if (this.game.players.includes(p.id) && p.room !== 'recreation') this.game = newGame();
    }
  }
  action(id: string, type: string, data: unknown): ChatMessage | null {
    const p = this.players.get(id); if (!p) return null;
    const d = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    if (type === 'status' && ['available', 'busy', 'away'].includes(String(d.status))) p.status = d.status as Player['status'];
    if (type === 'avatar') p.avatar = cleanAvatar(d.avatar);
    if (type === 'emote' && ['', 'wave', 'dance'].includes(String(d.emote))) {
      const r = this.rate.get(id) ?? { chat: 0, emote: 0 };
      if (Date.now() - r.emote > 500) { p.emote = String(d.emote); r.emote = Date.now(); this.rate.set(id, r); }
    }
    if (type === 'seat') {
      if (p.seat) { p.seat = null; p.emote = ''; }
      else {
        const s = SEATS.find(s => s.id === d.id);
        if (s && p.room === s.room && Math.hypot(s.x - p.x, s.z - p.z) < 3 && ![...this.players.values()].some(q => q.seat === s.id) && !(this.locked && p.room !== 'meeting' && s.room === 'meeting')) Object.assign(p, { seat: s.id, x: s.x, z: s.z, rotation: s.rotation, room: s.room, moving: false, emote: 'sit' });
      }
    }
    if (type === 'meeting') {
      const admin = p.role !== 'member';
      if (!this.host && p.room === 'meeting') this.host = id;
      if (admin || this.host === id) this.locked = Boolean(d.locked);
    }
    if (type === 'game:join' && p.room === 'recreation' && Math.hypot(p.x - 14, p.z - 1) < 6 && !this.game.players.includes(id) && this.game.players.length < 2) this.game.players.push(id);
    if (type === 'game:drop' && p.room === 'recreation') dropDisc(this.game, id, Number(d.column));
    if (type === 'game:reset' && this.game.players.includes(id) && (this.game.winner || this.game.draw)) { const players = [...this.game.players]; this.game = newGame(); this.game.players = players; }
    if (type === 'game:leave' && this.game.players.includes(id)) this.game = newGame();
    if (type === 'chat') {
      const text = typeof d.text === 'string' ? d.text.trim().slice(0, 500) : '';
      const r = this.rate.get(id) ?? { chat: 0, emote: 0 };
      if (!text || Date.now() - r.chat < 800) return null;
      r.chat = Date.now(); this.rate.set(id, r);
      return { id: randomUUID(), author: p.name, text, room: p.room, scope: d.scope === 'room' ? 'room' : 'office', at: Date.now() };
    }
    return null;
  }
  snapshot(): Snapshot { return { players: [...this.players.values()].map(p => ({ ...p, avatar: { ...p.avatar } })), locked: this.locked, host: this.host, game: { ...this.game, board: [...this.game.board], players: [...this.game.players] }, links: this.links.map(l => ({...l})) }; }
}
