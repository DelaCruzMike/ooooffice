import {ROOMS,entrance,type Role,type Vec} from './world.js';
export type RoomSettings={name:string;label:string;department:string;access:'team'|'department';voice:'private'|'muted'};
export type RoomSettingsMap=Record<string,RoomSettings>;
export const roomDefaults=Object.fromEntries(ROOMS.map(r=>[r.id,{name:r.name,label:r.short,department:r.name,access:'team' as const,voice:'private' as const}]));
export function cleanRoomSettings(id:string,value:unknown):RoomSettings{const base=roomDefaults[id];if(!base)throw new Error('Unknown room.');const v=(value||{}) as Partial<RoomSettings>;const text=(x:unknown,fallback:string)=>typeof x==='string'&&x.trim()?x.trim().slice(0,48):fallback;return {name:text(v.name,base.name),label:text(v.label,base.label),department:text(v.department,base.department),access:v.access==='department'?'department':'team',voice:v.voice==='muted'?'muted':'private'};}
export function applyRoomLabels(settings:RoomSettingsMap){for(const r of ROOMS){const s=settings[r.id]||roomDefaults[r.id];r.name=s.name;r.short=s.label;}}
export function signPosition(id:string):Vec{const r=ROOMS.find(r=>r.id===id)!;const e=entrance(r);return r.id==='lounge'?{x:-8.1,z:11.16}:{x:e.x+(r.side==='south'?-2:r.side==='west'?-.13:2),z:e.z+(r.side==='south'?.13:r.side==='west'?-2:-.13)};}
export function mayManage(actor:Role,target:Role,next:Role){return actor!=='member'&&target!=='owner'&&next!=='owner'&&(actor==='owner'||target==='member'&&next==='member');}
