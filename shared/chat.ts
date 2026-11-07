import {floorConfig,floorRooms} from './building.js';
import type {Player,ChatMessage} from './world.js';
export function chatZone(p:Pick<Player,'floor'|'room'|'inElevator'>){if(p.inElevator)return {id:'cabin:main',name:'Elevator Chat'};const room=floorRooms(p.floor).find(r=>r.id===p.room),department=p.floor==='3'?'Social Media':p.floor==='1'?'IT':floorConfig(p.floor).name;return {id:room?`${p.floor}:room:${room.id}`:`${p.floor}:hallway`,name:room?`${department} · ${room.name}`:`${floorConfig(p.floor).name} Chat`};}
export const canReceiveChat=(p:Player,m:ChatMessage)=>chatZone(p).id===m.zone;
export function cleanChat(value:unknown){return typeof value==='string'?value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').trim().slice(0,500):'';}
