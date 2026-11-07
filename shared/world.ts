import {floorStep,allRooms,IT_ROOMS,type FloorId} from './building.js';
import {newElevator,type ElevatorState} from './elevator.js';
import type {NpcState} from './npcs.js';
import {cleanCosmetics,type Cosmetics} from './cosmetics.js';
import type {RoomSettingsMap} from './room-settings.js';
import { newPool, newBowling, type PoolGame, type BowlingGame } from './sports.js';
export const PROTOCOL_VERSION = 5;
export type Vec = { x: number; z: number };
export type Avatar = { cosmetics?:Cosmetics; skin: string; hair: string; style: 'crop' | 'bob' | 'bun' | 'quiff' | 'ponytail' | 'curls'; shirt: string; trousers: string; accessory: 'none' | 'glasses' | 'cap' | 'headset'; top?:'tshirt'|'polo'|'buttondown'|'hoodie'; bottom?:'trousers'|'jeans'|'shorts'; shoes?:'sneakers'|'office' };
export type Role = 'owner' | 'administrator' | 'member';
export const EMOTES = ['wave','salute','clap','kiss','groove','shuffle','disco'] as const;
export type Emote = '' | typeof EMOTES[number];
export type Player = Vec & { floor:FloorId;approved:boolean;floors:FloorId[];managedFloors:FloorId[];inElevator:boolean; id: string; userId: string; name: string; department: string; role: Role; rotation: number; y: number; vy: number; grounded: boolean; moving: boolean; room: string; status: 'available' | 'busy' | 'away'; avatar: Avatar; emote: Emote; emoteAt: number; seat: string | null; bed: string | null; voice: boolean; mic: boolean; forcedMute: boolean };
export type Rect = { x: number; z: number; w: number; d: number };
export type OfficeRoom = Rect & { id: string; name: string; short: string; color: string; seats: number; side: 'north' | 'south' | 'east' | 'west'; enclosed: boolean; doorOffset?:number };
export const DEFAULT_AVATAR: Avatar = { skin: '#d6a079', hair: '#3b2c28', style: 'crop', shirt: '#7c8871', trousers: '#384a46', accessory: 'none' };
export const ROOMS: OfficeRoom[] = [
  {id:'operations',name:'Department Manager',short:'Department Manager',x:-32,z:-17,w:9,d:10,color:'#9c896c',seats:1,side:'south',enclosed:true},
  {id:'social',name:'Social Media Managers',short:'Social Media',x:-20.5,z:-17,w:10,d:10,color:'#c29f84',seats:5,side:'south',enclosed:true},
  {id:'csr',name:'Creator Support',short:'Creator Support',x:-8.5,z:-17,w:10,d:10,color:'#91afab',seats:6,side:'south',enclosed:true},
  {id:'editor',name:'Editors',short:'Editors',x:3.5,z:-17,w:10,d:10,color:'#8b9daf',seats:6,side:'south',enclosed:true},
  {id:'meeting-small',name:'Small Meeting Room',short:'Meeting Room',x:16,z:-17,w:11,d:10,color:'#a7afa0',seats:0,side:'south',enclosed:true},
  {id:'sleeping',name:'Sleeping Quarters',short:'Sleeping Quarters',x:30,z:-18.5,w:12,d:17,color:'#b1aac0',seats:0,side:'south',enclosed:true},
  {id:'pantry',name:'Pantry',short:'Pantry',x:-30,z:2,w:14,d:16,color:'#c4b487',seats:0,side:'south',enclosed:true},
  {id:'lounge',name:'The Commons',short:'The Commons',x:-6,z:2,w:30,d:18,color:'#98a58b',seats:0,side:'south',enclosed:false},
  {id:'smoking',name:'Outdoor Veranda',short:'Veranda',x:29,z:2,w:14,d:18,color:'#92a795',seats:0,side:'west',enclosed:false},
  {id:'cdt',name:'Creator Distribution Team',short:'CDT',x:-29,z:18,w:16,d:8,color:'#9aaf91',seats:7,side:'north',enclosed:true},
  {id:'qa',name:'Quality Assurance',short:'Quality Assurance',x:-11,z:18,w:16,d:8,color:'#aea1bd',seats:7,side:'north',enclosed:true},
  {id:'poster',name:'Posters',short:'Posters',x:7,z:19,w:16,d:10,color:'#c5ae85',seats:14,side:'north',enclosed:true},
  {id:'meeting',name:'All Together Auditorium',short:'All Together',x:27,z:21,w:20,d:14,color:'#8fa8af',seats:0,side:'north',enclosed:true,doorOffset:-7.5},
];
export const SPAWN: Vec = { x:-5, z:9 };
export const BOUNDS = { minX:-38,maxX:38,minZ:-28,maxZ:29 };
export const FLOOR_AREAS:Rect[]=[{x:-8,z:3.5,w:60,d:51},{x:30,z:-18,w:16,d:20},{x:30,z:20.5,w:16,d:17},{x:29,z:2,w:14,d:18}];
export const SPEED = 3.8, SPRINT_SPEED = 6, RADIUS = .28, TURN_SPEED = 2.5, GRAVITY = 14;
export const MEETING_ROOMS = ['meeting','meeting-small'];
export type RoomLock = { locked:boolean; host:string|null };
export type Locks = Record<string,RoomLock>;
export const newLocks = ():Locks => Object.fromEntries(MEETING_ROOMS.map(id=>[id,{locked:false,host:null}]));
export const inside = (p:Vec,r:Rect,pad=0) => Math.abs(p.x-r.x)<r.w/2+pad && Math.abs(p.z-r.z)<r.d/2+pad;
export const roomAt = (p:Vec) => ROOMS.find(r=>inside(p,r))?.id ?? 'hallway';
export const voiceZone = (p:Pick<Player,'room'>) => ROOMS.find(r=>r.id===p.room)?.enclosed?p.room:'commons';
export function entrance(r:OfficeRoom): Vec { return {x:r.x+(r.side==='west'?-r.w/2:r.side==='east'?r.w/2:(r.doorOffset||0)),z:r.z+(r.side==='north'?-r.d/2:r.side==='south'?r.d/2:(r.doorOffset||0))}; }
export type DoorState={closed:boolean;until:number;version?:number;pending?:boolean};
export type Doors=Record<string,DoorState>;
export type EntryRequest={id:string;room:string;visitor:string;name:string;expires:number};
export const newDoors=():Doors=>Object.fromEntries(allRooms().filter(r=>r.enclosed).map(r=>[r.id,{closed:false,until:0}]));
export function doorRect(room:string):Rect{const r=allRooms().find(r=>r.id===room)!;return {...entrance(r),w:r.side==='north'||r.side==='south'?2.1:.18,d:r.side==='north'||r.side==='south'?.18:2.1};}
export function doorBlocks(from:Vec,to:Vec,doors:Doors){return Object.entries(doors).some(([id,d])=>d.closed&&roomAt(from)!==id&&roomAt(to)===id);}
export type Seat = Vec & { id:string; room:string; kind:'desk'|'shared'|'meeting'; rotation:number; y:number };
export type Bed = Vec & { id:string;room:string;exit:Vec;y:number;rotation:number };
export type Furniture = Rect & { id:string;kind:string;room:string;rotation?:number;h?:number;monitors?:number;headset?:boolean;count?:number;solid?:boolean };
export const SEATS:Seat[] = [], BEDS:Bed[] = [], FURNITURE:Furniture[] = [];
let nextId=0;
function prop(kind:string,room:string,x:number,z:number,w:number,d:number,extra:Partial<Furniture>={}) { const p: Furniture = {id:`${kind}-${nextId++}`,kind,room,x,z,w,d,...extra};FURNITURE.push(p);return p; }
function seat(id:string,room:string,x:number,z:number,rotation:number,kind:Seat['kind']='shared',y=0){SEATS.push({id,room,x,z,rotation,kind,y});}
function desk(room:string,i:number,x:number,z:number,w:number,facing:number,monitors=1,headset=false,kind='cubicle'){
  prop(kind,room,x,z,w,.85,{rotation:facing,monitors,headset,h:kind==='executive'?1:1.5});
  seat(`${room}-${i}`,room,x,z+(facing===0?-1.12:1.12),facing,'desk');
}
const ops=ROOMS[0];prop('executive','operations',ops.x,ops.z+.2,3,1.3,{monitors:1,h:1});seat('operations-0','operations',ops.x,ops.z-1.25,0,'desk');
seat('operations-guest-1','operations',ops.x-.95,ops.z+2,Math.PI-.15);seat('operations-guest-2','operations',ops.x+.95,ops.z+2,Math.PI+.15);
prop('motorcycle','operations',ops.x-2.85,ops.z-2.35,1.7,2.5,{h:1.5});prop('aquarium','operations',ops.x+2.6,ops.z-2.8,2,.7,{h:1.6});prop('bookshelf','operations',ops.x+.3,ops.z-4.55,3.5,.55,{h:2.6});
const social=ROOMS[1];for(let i=0;i<5;i++){const top=i<3,x=social.x+(top?i-1:i-3.5)*2.3,z=social.z+(top?-1.8:.7);desk('social',i,x,z,1.95,top?0:Math.PI,1,false,'desk');}
prop('bookshelf','social',social.x-3.75,social.z-4.45,2,.6,{h:2.4});prop('cabinet','social',social.x-4.45,social.z+1.9,.65,1.5,{h:1.5});
for(const id of ['csr','editor','poster']){const r=ROOMS.find(r=>r.id===id)!,cols=r.seats/2,pitch=id==='poster'?1.9:id==='editor'?2.5:2.2,width=id==='editor'?2.35:id==='poster'?1.78:2.05;
 for(let row=0;row<2;row++)for(let i=0;i<cols;i++)desk(id,row*cols+i,r.x+(i-(cols-1)/2)*pitch,r.z+(row? .52:-.52)-.4,width,row?Math.PI:0,id==='editor'?2:1,id==='csr');
 prop('spine',id,r.x,r.z-.4,cols*pitch,.12,{h:1.45});prop('cabinet',id,r.x+r.w/2-.65,r.z+r.d/2-1.9,.65,1.4,{h:1.4});
}
for(const id of ['cdt','qa']){const r=ROOMS.find(r=>r.id===id)!;for(let i=0;i<7;i++)desk(id,i,r.x+(i-3)*2,r.z+r.d/2-.7,1.85,0);prop('cabinet',id,r.x+r.w/2-1,r.z-r.d/2+1.1,1.4,.6,{h:1.35});}
for(let row=0;row<5;row++)for(let col=0;col<10;col++){const x=col<5?19.8+col*1.3:29+(col-5)*1.3;seat(`meeting-${row*10+col}`,'meeting',x,18.2+row*1.8,Math.PI,'meeting',row*.25);}
prop('stage','meeting',27,15.6,12,1.4,{h:.25,solid:false});prop('screen','meeting',27,14.35,8,.15,{h:2.6});
prop('meetingTable','meeting-small',16,-17,5.2,2.1,{h:.85});for(let i=0;i<3;i++){seat(`small-${i}`,'meeting-small',14+i*2,-18.9,0,'meeting');seat(`small-${i+3}`,'meeting-small',14+i*2,-15.1,Math.PI,'meeting');}seat('small-6','meeting-small',12.4,-17,Math.PI/2,'meeting');seat('small-7','meeting-small',19.6,-17,-Math.PI/2,'meeting');
prop('screen','meeting-small',16,-21.75,4,.15,{h:2.4});prop('whiteboard','meeting-small',21.2,-18,.14,2.7,{h:2.1});prop('cabinet','meeting-small',11.1,-20.6,.7,1.5,{h:1});
for(let row=0;row<3;row++)for(let col=0;col<2;col++){const x=-33.3+col*6.3,z=-1.5+row*3.7;prop('canteen','pantry',x,z,2.1,1,{h:.85});for(let side=0;side<2;side++)for(let i=0;i<2;i++)seat(`pantry-${row}-${col}-${side}-${i}`,'pantry',x+(i? .6:-.6),z+(side?1.05:-1.05),side?Math.PI:0);}
prop('counter','pantry',-29.5,-5.1,8.8,1.1,{h:1});prop('fridge','pantry',-35.7,-4.9,1,1,{h:2});prop('water','pantry',-24,-4.9,.65,.7,{h:1.3});prop('locker','pantry',-36.4,3.2,.65,7,{count:20,h:2.2});prop('bin','pantry',-24.3,8.6,.65,.65,{h:.8});
for(let row=0;row<5;row++)for(let col=0;col<4;col++){const x=30+[-4.2,-1.4,1.4,4.2][col],z=-18.5+(row-2)*3;const id=`bed-${row*4+col}`;prop('bed','sleeping',x,z,1.2,2.15,{h:.6,id});BEDS.push({id,room:'sleeping',x,z:z+.78,y:.75,rotation:0,exit:{x:x-.96,z}});prop('bedPanel','sleeping',x+.7,z,.1,2.25,{h:1.25});}
// Commons: separate circulation and activity areas, with lounge seating facing the TV.
prop('tv','lounge',-16,-6.55,6,.2,{h:2.5});prop('console','lounge',-16,-5.8,3.5,.65,{h:.65});
for(const [x,z,w,d,rotation] of [[-16,-2.4,5,1.2,Math.PI],[-20,1,1.2,4,Math.PI/2],[-12,1,1.2,4,-Math.PI/2]]){const f=prop('sofa','lounge',x,z,w,d,{h:1.1,rotation});for(let i=0;i<3;i++){const dx=w>d?(i-1)*1.3:0,dz=d>w?(i-1)*1.1:0;seat(`${f.id}-${i}`,'lounge',x+dx,z+dz,rotation);}}
prop('table','lounge',-16,.7,2.6,1.4,{h:.5});prop('billiards','lounge',-6,-2.6,4,2.15,{h:.95});prop('bowling','lounge',4.9,4.5,2.7,10,{h:.15});
prop('chess','lounge',-14,6.5,1.5,1.5,{h:.85});seat('chess-white','lounge',-15.3,6.5,Math.PI/2);seat('chess-black','lounge',-12.7,6.5,-Math.PI/2);
prop('connect4','lounge',-8.4,5,1.9,1.2,{h:.9});seat('connect4-1','lounge',-8.4,3.8,0);seat('connect4-2','lounge',-8.4,6.2,Math.PI);
prop('bookshelf','lounge',-20.5,8.5,.65,2,{h:2});
export type Activity = {id:string;kind:'darts'|'chess'|'connect4'|'pool'|'bowling';room:string;position:Vec;board:Vec;rotation:number};
export const ACTIVITIES:Activity[]=[
 {id:'pool-commons',kind:'pool',room:'lounge',position:{x:-6,z:-.55},board:{x:-6,z:-2.6},rotation:0},
 {id:'bowling-commons',kind:'bowling',room:'lounge',position:{x:2.8,z:8.5},board:{x:4.9,z:4.5},rotation:0},
 {id:'darts-commons',kind:'darts',room:'lounge',position:{x:5.9,z:-4},board:{x:8.75,z:-4},rotation:Math.PI/2},
 {id:'chess-commons',kind:'chess',room:'lounge',position:{x:-15.3,z:6.5},board:{x:-14,z:6.5},rotation:0},
 {id:'connect4-commons',kind:'connect4',room:'lounge',position:{x:-8.4,z:6.3},board:{x:-8.4,z:5},rotation:0},
];
for(const a of ACTIVITIES.filter(a=>a.kind==='darts'))prop('dartboard',a.room,a.board.x,a.board.z,.15,.75,{h:2,rotation:a.rotation});
for(const [x,z] of [[25,-3],[32,-3],[25,6],[32,6]]){prop('outdoorTable','smoking',x,z,1.2,1.2,{h:.75});seat(`terrace-${x}-${z}-1`,'smoking',x-1.2,z,Math.PI/2);seat(`terrace-${x}-${z}-2`,'smoking',x+1.2,z,-Math.PI/2);}
prop('ashtray','smoking',35.2,8.8,.5,.5,{h:1});
prop('railing','smoking',29,-7,14,.1,{h:1.45});prop('railing','smoking',29,11,14,.1,{h:1.45});prop('railing','smoking',36,2,.1,18,{h:1.45});prop('signpost','lounge',-8.1,11,.28,.28,{h:2.6});
// Planters are real obstacles; decorative leaves extend above their footprint.
for(const r of ROOMS){for(const s of [-1,1])prop('planter',r.id,r.x+s*(r.w/2-1),r.z-r.d/2+1,.65,.65,{h:.55});if(['operations','lounge','meeting','smoking'].includes(r.id))for(const s of [-1,1])prop('planter',r.id,r.x+s*(r.w/2-1),r.z+r.d/2-1,.65,.65,{h:.55});}
export const WALLS:Rect[]=[];
for(const r of ROOMS.filter(r=>r.enclosed)){
 const e=entrance(r),doorWidth=2.1;
 if(r.side==='north'||r.side==='south'){
  WALLS.push({x:r.x-r.w/2,z:r.z,w:.18,d:r.d},{x:r.x+r.w/2,z:r.z,w:.18,d:r.d},{x:r.x,z:2*r.z-e.z,w:r.w,d:.18});
  const left=r.x-r.w/2,right=r.x+r.w/2,gapLeft=e.x-doorWidth/2,gapRight=e.x+doorWidth/2;WALLS.push({x:(left+gapLeft)/2,z:e.z,w:gapLeft-left,d:.18},{x:(right+gapRight)/2,z:e.z,w:right-gapRight,d:.18});
 }
}
// Building perimeter and glazed setback separating the indoor lobby from veranda.
WALLS.push({x:-8,z:-22,w:60,d:.18},{x:30,z:BOUNDS.minZ,w:16,d:.18},{x:0,z:BOUNDS.maxZ,w:76,d:.18},{x:BOUNDS.minX,z:.5,w:.18,d:57},{x:BOUNDS.maxX,z:-18,w:.18,d:20},{x:BOUNDS.maxX,z:20.5,w:.18,d:17});
WALLS.push({x:22,z:-3.55,w:.15,d:8.9},{x:22,z:7.55,w:.15,d:8.9});
export const COLLIDERS:Rect[]=[...WALLS,...FURNITURE.filter(f=>f.solid!==false && !['screen','tv','whiteboard'].includes(f.kind))];
export function canStand(p:Vec,radius=RADIUS){return p.x>BOUNDS.minX+radius&&p.x<BOUNDS.maxX-radius&&p.z>BOUNDS.minZ+radius&&p.z<BOUNDS.maxZ-radius&&FLOOR_AREAS.some(r=>Math.abs(p.x-r.x)<=r.w/2+.001&&Math.abs(p.z-r.z)<=r.d/2+.001)&&!COLLIDERS.some(r=>inside(p,r,radius));}
export function groundHeight(p:Vec){
 if(inside(p,{x:27,z:15.6,w:12,d:1.4}))return .25;
 if(roomAt(p)!=='meeting'||p.z<17.3||p.z>27.1||p.x<18.2||p.x>35.8)return 0;
 if(Math.abs(p.x-27)<1) return Math.max(0,Math.min(1,(p.z-18.2)/7.2));
 return Math.max(0,Math.min(4,Math.floor((p.z-17.3)/1.8)))*.25;
}
export function move(p:Vec,direction:Vec,dt:number,locks:Locks|boolean=newLocks(),doors:Doors={},speed=SPEED){
 const len=Math.hypot(direction.x,direction.z),scale=len>1?1/len:1,dist=Math.min(.1,Math.max(0,dt))*Math.min(SPRINT_SPEED,Math.max(0,speed)),steps=Math.max(1,Math.ceil(dist/.12));let result={x:p.x,z:p.z};
 const allow=(q:Vec)=>canStand(q)&&!doorBlocks(p,q,doors)&&groundHeight(q)-groundHeight(result)<=.301&&!(roomAt(p)!==roomAt(q)&&(typeof locks==='boolean'?locks&&roomAt(q)==='meeting':locks[roomAt(q)]?.locked));
 for(let i=0;i<steps;i++){const a={x:result.x+direction.x*scale*dist/steps,z:result.z};if(allow(a))result=a;const b={x:result.x,z:result.z+direction.z*scale*dist/steps};if(allow(b))result=b;}return result;
}
export type MoveInput={x:number;z:number;sprint?:boolean;heading?:number};
export function relativeInput(forward:number,right:number,yaw:number,sprint=false):MoveInput{const length=Math.max(1,Math.hypot(forward,right));return {x:(Math.sin(yaw)*forward+Math.cos(yaw)*right)/length,z:(Math.cos(yaw)*forward-Math.sin(yaw)*right)/length,sprint};}
export function stepPlayer(p:Player,input:MoveInput,dt:number,locks:Locks,doors:Doors={}){
 if(p.inElevator)return;if(p.floor!=='3'){dt=Math.min(.1,Math.max(0,dt));p.moving=false;if(p.seat||p.bed)return;floorStep(p,input,dt,doors,Boolean(input.sprint));if(!p.moving&&Number.isFinite(input.heading))p.rotation=input.heading!;if(!p.grounded){p.vy-=GRAVITY*dt;p.y+=p.vy*dt;if(p.y<=0){p.y=0;p.vy=0;p.grounded=true;}}if(p.moving)p.emote='';return;}
 dt=Math.min(.1,Math.max(0,dt));p.moving=false;if(p.seat||p.bed)return;
 const length=Math.hypot(input.x,input.z);if(length>.05)p.rotation=Math.atan2(input.x,input.z);else if(Number.isFinite(input.heading))p.rotation=Math.atan2(Math.sin(input.heading!),Math.cos(input.heading!));
 const next=move(p,input,dt,locks,doors,input.sprint?SPRINT_SPEED:SPEED);
 p.moving=Math.hypot(next.x-p.x,next.z-p.z)>.001;Object.assign(p,next);p.room=roomAt(p);
 const floor=groundHeight(p);
 if(p.grounded&&p.y-floor>.31){p.grounded=false;p.vy=0;}
 if(p.grounded){p.y=floor;p.vy=0;}else{p.vy-=GRAVITY*dt;p.y+=p.vy*dt;if(p.y>1.34){p.y=1.34;p.vy=Math.min(0,p.vy);}if(p.y<=floor){p.y=floor;p.vy=0;p.grounded=true;}}
 if(p.moving)p.emote='';
}
export function jumpPlayer(p:Player){if(!p.grounded||p.seat||p.bed)return false;p.vy=Math.sqrt(2*GRAVITY*.8);p.grounded=false;p.emote='';return true;}
export function cameraBlocked(p:{x:number;y:number;z:number}){return WALLS.some(r=>inside(p,r,.15)&&p.y<3.25)||FURNITURE.some(f=>f.solid!==false&&inside(p,f,.15)&&p.y<(f.h??1)+.12);}
export function chaseCamera(p:Player){
 const bed=BEDS.find(b=>b.id===p.bed);
 const target=bed?{x:bed.x,y:bed.y+.4,z:bed.z-.78}:{x:p.x,y:p.y+(p.seat?1.05:1.12),z:p.z};
 const desired=bed?{x:bed.x+(bed.x<30?3.5:-3.5),y:2.98,z:bed.z-.38}:{x:p.x-Math.sin(p.rotation)*3.5,y:Math.min(3.02,p.y+2.05),z:p.z-Math.cos(p.rotation)*3.5};let position=desired;
 for(let t=.08;t<=1;t+=.035){const q={x:target.x+(desired.x-target.x)*t,y:target.y+(desired.y-target.y)*t,z:target.z+(desired.z-target.z)*t};if(cameraBlocked(q)){const safe=Math.max(.07,t-.045);position={x:target.x+(desired.x-target.x)*safe,y:target.y+(desired.y-target.y)*safe,z:target.z+(desired.z-target.z)*safe};break;}}return {target,position};}

export function cleanAvatar(value:unknown):Avatar{const a=value&&typeof value==='object'?value as Record<string,unknown>:{};const color=(key:'skin'|'hair'|'shirt'|'trousers')=>typeof a[key]==='string'&&/^#[0-9a-f]{6}$/i.test(a[key] as string)?a[key] as string:DEFAULT_AVATAR[key];return {cosmetics:cleanCosmetics(a.cosmetics),skin:color('skin'),hair:color('hair'),shirt:color('shirt'),trousers:color('trousers'),top:['tshirt','polo','buttondown','hoodie'].includes(String(a.top))?a.top as Avatar['top']:'tshirt',bottom:['trousers','jeans','shorts'].includes(String(a.bottom))?a.bottom as Avatar['bottom']:'trousers',shoes:a.shoes==='office'?'office':'sneakers',style:['crop','bob','bun','quiff','ponytail','curls'].includes(String(a.style))?a.style as Avatar['style']:'crop',accessory:['none','glasses','cap','headset'].includes(String(a.accessory))?a.accessory as Avatar['accessory']:'none'};}
export function makePlayer(id:string,name:string,avatar=DEFAULT_AVATAR):Player{return {floor:'3',approved:true,floors:['3'],managedFloors:[],inElevator:false,...SPAWN,id,userId:id,name:name.slice(0,32),department:'Team',role:'member',rotation:Math.PI,y:0,vy:0,grounded:true,moving:false,room:'lounge',status:'available',avatar:cleanAvatar(avatar),emote:'',emoteAt:0,seat:null,bed:null,voice:false,mic:false,forcedMute:false};}
export type ChatMessage={floor:FloorId;cabin:boolean;id:string;author:string;text:string;scope:'office'|'room';room:string;at:number};
export type WorkLink={label:string;url:string};
export type Game={board:number[];players:string[];turn:number;winner:number|null;draw:boolean};
export const newGame=():Game=>({board:Array(42).fill(0),players:[],turn:1,winner:null,draw:false});
export function dropDisc(g:Game,p:string,col:number){if(!Number.isInteger(col)||col<0||col>6||g.players.length!==2||g.players[g.turn-1]!==p||g.winner||g.draw)return false;let row=5;while(row>=0&&g.board[row*7+col])row--;if(row<0)return false;g.board[row*7+col]=g.turn;for(const[dx,dy]of[[1,0],[0,1],[1,1],[1,-1]]){let n=1;for(const sign of[-1,1])for(let k=1;k<4;k++){const x=col+dx*k*sign,y=row+dy*k*sign;if(x<0||x>6||y<0||y>5||g.board[y*7+x]!==g.turn)break;n++;}if(n>=4)g.winner=g.turn;}g.draw=!g.winner&&g.board.every(Boolean);if(!g.winner&&!g.draw)g.turn=3-g.turn;return true;}
export type DartsGame={players:string[];scores:number[];turn:number;darts:number;start:number;winner:string|null;throws:{x:number;y:number;score:number}[]};
export type ChessGame={players:string[];fen:string;turn:'w'|'b';lastMove:string;history:string[];result:string;winner:string|null};
export type ActivityGames={connect4:Game;darts:Record<string,DartsGame>;chess:ChessGame;pool:PoolGame;bowling:BowlingGame};
export const newDarts=():DartsGame=>({players:[],scores:[301,301],turn:0,darts:0,start:301,winner:null,throws:[]});
export const newChess=():ChessGame=>({players:[],fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',turn:'w',lastMove:'',history:[],result:'',winner:null});
export const newGames=():ActivityGames=>({connect4:newGame(),darts:{'darts-commons':newDarts()},chess:newChess(),pool:newPool(),bowling:newBowling()});
export type Snapshot={elevator:ElevatorState;npcs:NpcState[];inventory:string;roomSettings:RoomSettingsMap;protocol:number;players:Player[];locks:Locks;doors:Doors;games:ActivityGames;links:WorkLink[]};
export const emptySnapshot=():Snapshot=>({elevator:newElevator(),npcs:[],inventory:'',roomSettings:{},protocol:PROTOCOL_VERSION,players:[],locks:newLocks(),doors:newDoors(),games:newGames(),links:[]});
