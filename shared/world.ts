export type Vec = { x: number; z: number };
export type Avatar = { skin: string; hair: string; style: 'crop' | 'bob' | 'bun'; shirt: string; trousers: string; accessory: 'none' | 'glasses' | 'cap' };
export type Role = 'owner' | 'administrator' | 'member';
export type Player = Vec & { id: string; userId: string; name: string; department: string; role: Role; rotation: number; moving: boolean; room: string; status: 'available' | 'busy' | 'away'; avatar: Avatar; emote: string; seat: string | null; voice: boolean; mic: boolean; forcedMute: boolean };
export type Rect = { x: number; z: number; w: number; d: number };
export type OfficeRoom = Rect & { id: string; name: string; short: string; color: string; seats: number; side: 'north' | 'south'; enclosed: boolean };
export const DEFAULT_AVATAR: Avatar = { skin: '#d6a079', hair: '#3b2c28', style: 'crop', shirt: '#7c8871', trousers: '#384a46', accessory: 'none' };
export const ROOMS: OfficeRoom[] = [
  { id: 'operations', name: 'Operations Manager', short: 'Operations', x: -29, z: -20, w: 18, d: 18, color: '#c0b4d8', seats: 2, side: 'south', enclosed: true },
  { id: 'social', name: 'Social Media Manager', short: 'Social Media', x: -9, z: -20, w: 18, d: 18, color: '#e1b69c', seats: 6, side: 'south', enclosed: true },
  { id: 'csr', name: 'CSR Room', short: 'Customer Support', x: 11, z: -20, w: 18, d: 18, color: '#9bbdb8', seats: 8, side: 'south', enclosed: true },
  { id: 'editor', name: 'Editor Room', short: 'Editors', x: 31, z: -20, w: 18, d: 18, color: '#b6c4df', seats: 8, side: 'south', enclosed: true },
  { id: 'pantry', name: 'Pantry', short: 'The pantry', x: -29, z: 1, w: 18, d: 16, color: '#e4c887', seats: 0, side: 'south', enclosed: false },
  { id: 'lounge', name: 'Central Hub', short: 'The commons', x: -9, z: 1, w: 18, d: 16, color: '#c8d5b7', seats: 0, side: 'south', enclosed: false },
  { id: 'recreation', name: 'Recreational Room', short: 'After hours', x: 11, z: 1, w: 18, d: 16, color: '#d6b4a3', seats: 0, side: 'south', enclosed: true },
  { id: 'smoking', name: 'Smoking Area', short: 'The terrace', x: 31, z: 1, w: 18, d: 16, color: '#b7c5a2', seats: 0, side: 'south', enclosed: false },
  { id: 'cdt', name: 'CDT Room', short: 'CDT', x: -29, z: 23, w: 18, d: 20, color: '#b5cbb4', seats: 8, side: 'north', enclosed: true },
  { id: 'qa', name: 'QA Room', short: 'Quality Assurance', x: -9, z: 23, w: 18, d: 20, color: '#c9bcdb', seats: 8, side: 'north', enclosed: true },
  { id: 'poster', name: 'Poster Room', short: 'Posters', x: 11, z: 23, w: 18, d: 20, color: '#dfc49c', seats: 10, side: 'north', enclosed: true },
  { id: 'meeting', name: 'Meeting Room', short: 'All together', x: 31, z: 23, w: 18, d: 20, color: '#a9bfc9', seats: 0, side: 'north', enclosed: true },
];
export const SPAWN: Vec = { x: -9, z: 6 };
export const BOUNDS = { minX: -40, maxX: 42, minZ: -31, maxZ: 35 };
export const SPEED = 5.5;
export const RADIUS = .32;
export function inside(p: Vec, r: Rect, pad = 0) { return Math.abs(p.x - r.x) < r.w / 2 + pad && Math.abs(p.z - r.z) < r.d / 2 + pad; }
export function roomAt(p: Vec) { return ROOMS.find(r => inside(p, r))?.id ?? 'hallway'; }
export function voiceZone(p: Pick<Player, 'room'>) { return ROOMS.find(r => r.id === p.room)?.enclosed ? p.room : 'commons'; }
export type Seat = Vec & { id: string; room: string; kind: 'desk' | 'shared' | 'meeting'; rotation: number };
export const SEATS: Seat[] = [];
export const FURNITURE: (Rect & { kind: 'desk' | 'sofa' | 'table' | 'counter' | 'game'; room: string })[] = [];
for (const r of ROOMS) {
  for (let i = 0; i < r.seats; i++) {
    const cols = 2, rows = Math.ceil(r.seats / cols);
    const x = r.x + (i % cols ? 4.1 : -4.1), z = r.z + (Math.floor(i / cols) - (rows - 1) / 2) * 3.2;
    SEATS.push({ id: `${r.id}-${i}`, x, z: z + 1.05, room: r.id, kind: 'desk', rotation: Math.PI });
    FURNITURE.push({ kind: 'desk', room: r.id, x, z, w: 2.6, d: 1.15 });
  }
}
for (let i = 0; i < 50; i++) SEATS.push({ id: `meeting-${i}`, room: 'meeting', x: 24.5 + i % 10 * 1.45, z: 18 + Math.floor(i / 10) * 2.5, kind: 'meeting', rotation: Math.PI });
for (const id of ['lounge', 'pantry', 'recreation', 'smoking']) {
  const r = ROOMS.find(r => r.id === id)!;
  FURNITURE.push({ kind: id === 'pantry' ? 'counter' : 'sofa', room: id, x: r.x - 4, z: r.z - 3.5, w: 4.5, d: 1.2 });
  for (let i = 0; i < 3; i++) SEATS.push({ id: `${id}-shared-${i}`, room: id, kind: 'shared', x: r.x - 5.5 + i * 1.5, z: r.z - 2.3, rotation: Math.PI });
}
FURNITURE.push({ kind: 'game', room: 'recreation', x: 14, z: 1, w: 2.5, d: 1.8 });
FURNITURE.push({ kind: 'table', room: 'lounge', x: -9, z: 1, w: 3.6, d: 2 });
FURNITURE.push({ kind: 'table', room: 'pantry', x: -26, z: 2, w: 3, d: 2 });
export const WALLS: Rect[] = [];
for (const r of ROOMS.filter(r => r.enclosed)) {
  WALLS.push({ x: r.x - r.w / 2, z: r.z, w: .22, d: r.d }, { x: r.x + r.w / 2, z: r.z, w: .22, d: r.d });
  const doorZ = r.z + (r.side === 'south' ? r.d / 2 : -r.d / 2);
  WALLS.push({ x: r.x, z: r.z - (doorZ - r.z), w: r.w, d: .22 });
  const wing = (r.w - 3.4) / 2;
  for (const sign of [-1, 1]) WALLS.push({ x: r.x + sign * (1.7 + wing / 2), z: doorZ, w: wing, d: .22 });
}
export const COLLIDERS: Rect[] = [...WALLS, ...FURNITURE];
export function canStand(p: Vec, radius = RADIUS) { return p.x > BOUNDS.minX + radius && p.x < BOUNDS.maxX - radius && p.z > BOUNDS.minZ + radius && p.z < BOUNDS.maxZ - radius && !COLLIDERS.some(r => inside(p, r, radius)); }
export function move(p: Vec, direction: Vec, dt: number, meetingLocked = false) {
  const len = Math.hypot(direction.x, direction.z), scale = len > 1 ? 1 / len : 1;
  const distance = Math.min(Math.max(dt, 0), .1) * SPEED;
  let result = { ...p };
  const allow = (q: Vec) => canStand(q) && !(meetingLocked && roomAt(p) !== 'meeting' && roomAt(q) === 'meeting');
  // Substeps prevent crossing thin walls even at low frame rates.
  const steps = Math.max(1, Math.ceil(distance / .15));
  for (let i = 0; i < steps; i++) {
    const qx = { x: result.x + direction.x * scale * distance / steps, z: result.z };
    if (allow(qx)) result = qx;
    const qz = { x: result.x, z: result.z + direction.z * scale * distance / steps };
    if (allow(qz)) result = qz;
  }
  return result;
}
export function cleanAvatar(value: unknown): Avatar {
  const a = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const color = (key: keyof Avatar) => typeof a[key] === 'string' && /^#[0-9a-f]{6}$/i.test(a[key] as string) ? a[key] as string : DEFAULT_AVATAR[key];
  return { skin: color('skin'), hair: color('hair'), shirt: color('shirt'), trousers: color('trousers'), style: ['crop', 'bob', 'bun'].includes(String(a.style)) ? a.style as Avatar['style'] : 'crop', accessory: ['none', 'glasses', 'cap'].includes(String(a.accessory)) ? a.accessory as Avatar['accessory'] : 'none' };
}
export function makePlayer(id: string, name: string, avatar = DEFAULT_AVATAR): Player { return { ...SPAWN, id, userId: id, name: name.slice(0, 32), department: 'Team', role: 'member', rotation: 0, moving: false, room: 'lounge', status: 'available', avatar: { ...avatar }, emote: '', seat: null, voice: false, mic: false, forcedMute: false }; }
export type ChatMessage = { id: string; author: string; text: string; scope: 'office' | 'room'; room: string; at: number };
export type WorkLink = { label: string; url: string };
export type Game = { board: number[]; players: string[]; turn: number; winner: number | null; draw: boolean };
export const newGame = (): Game => ({ board: Array(42).fill(0), players: [], turn: 1, winner: null, draw: false });
export function dropDisc(game: Game, player: string, col: number): boolean {
  if (!Number.isInteger(col) || col < 0 || col > 6 || game.players.length !== 2 || game.players[game.turn - 1] !== player || game.winner || game.draw) return false;
  let row = 5; while (row >= 0 && game.board[row * 7 + col]) row--;
  if (row < 0) return false;
  game.board[row * 7 + col] = game.turn;
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let count = 1;
    for (const sign of [-1, 1]) for (let n = 1; n < 4; n++) {
      const x = col + dx * n * sign, y = row + dy * n * sign;
      if (x < 0 || x > 6 || y < 0 || y > 5 || game.board[y * 7 + x] !== game.turn) break;
      count++;
    }
    if (count >= 4) game.winner = game.turn;
  }
  game.draw = !game.winner && game.board.every(Boolean);
  if (!game.winner && !game.draw) game.turn = 3 - game.turn;
  return true;
}
export type Snapshot = { players: Player[]; locked: boolean; host: string | null; game: Game; links: WorkLink[] };
