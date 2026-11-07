import {ROOMS,FURNITURE,SEATS,WALLS,inside,entrance,canStand,type OfficeRoom,type Furniture,type Seat,type Rect,type Vec,type Player,type Doors} from './world.js';
export type FloorId='G'|'1'|'2'|'3'|'4';
export const FLOOR_IDS:FloorId[]=['G','1','2','3','4'];
export type FloorConfig={id:FloorId;number:number;name:string;department:string;spawn:Vec;landing:Vec;bounds:Rect;prepared:boolean};
export const FLOORS:FloorConfig[]=[
 {id:'G',number:0,name:'Lobby',department:'Building',spawn:{x:0,z:7},landing:{x:0,z:-9},bounds:{x:0,z:0,w:30,d:26},prepared:true},
 {id:'1',number:1,name:'IT Department',department:'IT',spawn:{x:-24,z:0},landing:{x:-28,z:0},bounds:{x:0,z:0,w:60,d:38},prepared:true},
 {id:'2',number:2,name:'Administration & HR',department:'Administration & HR',spawn:{x:0,z:5},landing:{x:0,z:-9},bounds:{x:0,z:0,w:26,d:24},prepared:false},
 {id:'3',number:3,name:'Social Media / Marketing',department:'Social Media / Marketing',spawn:{x:-35,z:12},landing:{x:-38,z:12},bounds:{x:0,z:.5,w:76,d:57},prepared:true},
 {id:'4',number:4,name:'Chatting / Sales',department:'Chatting / Sales',spawn:{x:0,z:5},landing:{x:0,z:-9},bounds:{x:0,z:0,w:26,d:24},prepared:false},
];
export const floorConfig=(id:FloorId)=>FLOORS.find(f=>f.id===id)!;
const room=(id:string,name:string,x:number,z:number,w:number,d:number,seats=0):OfficeRoom=>({id,name,short:name,x,z,w,d,seats,side:z<0?'south':'north',enclosed:true,color:'#a3b6ba'});
export const IT_ROOMS:OfficeRoom[]=[room('it-manager','IT Department Manager',-20,-11,12,14,1),room('it-server','Server Room',-21,10,14,12),room('it-storage','Storage Room',-5,10,14,12,1),room('it-engineering','Engineering & Developers',12,-11,32,14,14),room('it-lead','Lead Engineer Office',8,10,10,12,1),room('it-krams','EA — Krams',19,10,10,12,1),room('it-augustine','EA — Augustine',-8,-11,10,14,1)];
export const floorRooms=(floor:FloorId)=>floor==='3'?ROOMS:floor==='1'?IT_ROOMS:[];
export const allRooms=()=>[...ROOMS,...IT_ROOMS];
export const roomFloor=(id:string):FloorId=>id.startsWith('it-')?'1':'3';
export function floorRoomAt(p:Vec,floor:FloorId){return floorRooms(floor).find(r=>inside(p,r))?.id||`${floor}:hallway`;}
export function cleanFloors(value:unknown):FloorId[]{return Array.isArray(value)?FLOOR_IDS.filter(f=>f!=='G'&&value.includes(f)):[];}
export function mayEnter(p:Pick<Player,'role'|'approved'|'floors'>,floor:FloorId){return floor==='G'||p.approved&&(p.role!=='member'||p.floors.includes(floor));}
export function mayManageFloor(p:Pick<Player,'role'|'approved'|'floors'|'managedFloors'>,floor:FloorId){return mayEnter(p,floor)&&p.approved&&(p.role!=='member'||p.managedFloors.includes(floor));}
export const NEW_FURNITURE:Furniture[]=[];export const NEW_SEATS:Seat[]=[];
function prop(kind:string,room:string,x:number,z:number,w:number,d:number,h=1){const p={id:`${room}-${kind}-${NEW_FURNITURE.length}`,kind,room,x,z,w,d,h};NEW_FURNITURE.push(p);return p;}
function desk(id:string,x:number,z:number,index:number,rotation=0,kind='desk'){const f=prop(kind,id,x,z,kind==='executive'?3:2,.85,1.5);Object.assign(f,{rotation,monitors:1});NEW_SEATS.push({id:`${id}-${index}`,room:id,x,z:z+(rotation?1.12:-1.12),rotation,y:0,kind:'desk'});}
for(const id of ['it-manager','it-lead','it-krams','it-augustine','it-storage']){const r=IT_ROOMS.find(r=>r.id===id)!;desk(id,r.x,r.z,0,0,id==='it-manager'?'executive':'desk');prop('cabinet',id,r.x+r.w/2-1,r.z-r.d/2+1,1.3,.7,1.4);}
for(let i=0;i<7;i++)for(let row=0;row<2;row++)desk('it-engineering',1+i*3.4,-11+(row?.5:-.5),i*2+row,row?Math.PI:0,'cubicle');
prop('tv','it-engineering',12,-17.6,5,.15,2.5);prop('whiteboard','it-engineering',27.6,-11,.15,3,2.2);
prop('bookshelf','it-manager',-20,-17.5,6,.6,2.4);prop('catTower','it-manager',-24,-14,1.4,1.4,1.7);prop('litter','it-manager',-15.5,-15,1,.8,.3);prop('food','it-manager',-15.5,-13,.5,.5,.15);prop('waterBowl','it-manager',-15.5,-12,.5,.5,.15);prop('catBed','it-manager',-24,-8,1.2,1,.2);
for(let row=0;row<2;row++)for(let i=0;i<4;i++)prop('rack','it-server',-25+i*2.6,7+row*6,1.2,1.4,2.5);
prop('cooling','it-server',-21,15.4,4,.5,2);prop('desk','it-server',-16,10,2,.8,1);
for(let i=0;i<4;i++)prop('stockShelf','it-storage',-10+i*3,15,2,.8,2.4);
prop('inventory','it-storage',-5,10,2,.85,1);
export const floorFurniture=(f:FloorId)=>f==='3'?FURNITURE:f==='1'?NEW_FURNITURE: f==='G'?LOBBY_FURNITURE:[];
export const floorSeats=(f:FloorId)=>f==='3'?SEATS:f==='1'?NEW_SEATS:[];
const LOBBY_FURNITURE:Furniture[]=[{id:'reception',room:'G:hallway',kind:'reception',x:8,z:-5,w:7,d:2,h:1.15},{id:'lobby-sofa',room:'G:hallway',kind:'sofa',x:-9,z:4,w:5,d:1.2,h:1},{id:'lobby-table',room:'G:hallway',kind:'table',x:-9,z:7,w:3,d:1.3,h:.5},...[-1,1].map((s,i)=>({id:`lobby-plant-${i}`,room:'G:hallway',kind:'planter',x:s*12,z:-8,w:1,d:1,h:1.5}))];
const wallCache=new Map<FloorId,Rect[]>();
export function floorWalls(floor:FloorId):Rect[]{if(floor==='3')return WALLS;if(wallCache.has(floor))return wallCache.get(floor)!;const b=floorConfig(floor).bounds;const walls:Rect[]=[{x:b.x-b.w/2,z:b.z,w:.18,d:b.d},{x:b.x+b.w/2,z:b.z,w:.18,d:b.d},{x:b.x,z:b.z-b.d/2,w:b.w,d:.18},{x:b.x,z:b.z+b.d/2,w:b.w,d:.18}];for(const r of floorRooms(floor)){const e=entrance(r),left=r.x-r.w/2,right=r.x+r.w/2;walls.push({x:left,z:r.z,w:.18,d:r.d},{x:right,z:r.z,w:.18,d:r.d},{x:r.x,z:2*r.z-e.z,w:r.w,d:.18},{x:(left+e.x-1.05)/2,z:e.z,w:e.x-1.05-left,d:.18},{x:(right+e.x+1.05)/2,z:e.z,w:right-e.x-1.05,d:.18});}wallCache.set(floor,walls);return walls;}
export function floorCanStand(p:Vec,floor:FloorId,radius=.28){if(floor==='3')return canStand(p,radius);return inside(p,floorConfig(floor).bounds,-radius)&&![...floorWalls(floor),...floorFurniture(floor).filter(f=>!['tv','whiteboard','inventory'].includes(f.kind))].some(r=>inside(p,r,radius));}
export function floorStep(p:Player,input:Vec,dt:number,doors:Doors,sprint=false){const len=Math.max(1,Math.hypot(input.x,input.z)),dist=Math.min(.1,dt)*(sprint?6:3.8),start={x:p.x,z:p.z};for(let n=0;n<4;n++)for(const axis of ['x','z'] as const){const q={x:p.x,z:p.z};q[axis]+=input[axis]/len*dist/4;if(floorCanStand(q,p.floor)&&!floorRooms(p.floor).some(r=>doors[r.id]?.closed&&inside(q,{...entrance(r),w:2.1,d:.18},.28)))Object.assign(p,q);}p.moving=Math.hypot(start.x-p.x,start.z-p.z)>.001;if(p.moving)p.rotation=Math.atan2(input.x,input.z);p.room=floorRoomAt(p,p.floor);}
export const ROOM_ENTRANCES:Record<string,string[]>={};
export const roomEntrances=(id:string)=>ROOM_ENTRANCES[id]||[id];
export function resolveVoice(p:Pick<Player,'floor'|'room'|'inElevator'>,doors:Doors,settings:Record<string,{voice:string}>={}){if(p.inElevator)return 'elevator';if(settings[p.room]?.voice==='muted')return 'muted';const r=allRooms().find(r=>r.id===p.room);return r?.enclosed&&roomEntrances(r.id).every(id=>doors[id]?.closed)?`${p.floor}:private:${r.id}:v${roomEntrances(r.id).reduce((n,id)=>n+(doors[id]?.version||0),0)}`:`${p.floor}:proximity:v${Object.entries(doors).filter(([id])=>roomFloor(id)===p.floor).reduce((n,[,d])=>n+(d.version||0),0)}`;}
export function inventoryUrl(value:unknown){if(value==='')return '';if(typeof value!=='string'||value.length>2048)throw new Error('Enter a valid inventory URL.');const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');return u.href;}
