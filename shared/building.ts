import {ROOMS,FURNITURE,SEATS,WALLS,inside,entrance,canStand,type OfficeRoom,type Furniture,type Seat,type Rect,type Vec,type Player,type Doors,type Bed,doorRect,BEDS} from './world.js';
export type FloorId='G'|'1'|'2'|'3'|'4';
export const FLOOR_IDS:FloorId[]=['G','1','2','3','4'];
export type FloorConfig={id:FloorId;number:number;name:string;department:string;spawn:Vec;landing:Vec;bounds:Rect;prepared:boolean};
export const FLOORS:FloorConfig[]=[
 {id:'G',number:0,name:'Lobby',department:'Building',spawn:{x:0,z:7},landing:{x:0,z:-9},bounds:{x:0,z:0,w:44,d:34},prepared:true},
 {id:'1',number:1,name:'IT Department',department:'IT',spawn:{x:-24,z:0},landing:{x:-28,z:0},bounds:{x:13.75,z:8,w:87.5,d:64},prepared:true},
 {id:'2',number:2,name:'Administration & HR',department:'Administration & HR',spawn:{x:0,z:5},landing:{x:0,z:-9},bounds:{x:0,z:0,w:26,d:24},prepared:false},
 {id:'3',number:3,name:'Social Media / Marketing',department:'Social Media / Marketing',spawn:{x:-35,z:12},landing:{x:-38,z:12},bounds:{x:0,z:.5,w:76,d:57},prepared:true},
 {id:'4',number:4,name:'Chatting / Sales',department:'Chatting / Sales',spawn:{x:0,z:5},landing:{x:0,z:-9},bounds:{x:0,z:0,w:26,d:24},prepared:false},
];
export const floorConfig=(id:FloorId)=>FLOORS.find(f=>f.id===id)!;
const room=(id:string,name:string,x:number,z:number,w:number,d:number,seats=0):OfficeRoom=>({id,name,short:name,x,z,w,d,seats,side:z<0?'south':'north',enclosed:true,color:'#a3b6ba'});
export const IT_ROOMS:OfficeRoom[]=[room('it-manager','IT Department Manager',-20,-11,12,14,1),room('it-server','Server Room',-21,10,14,12),room('it-storage','Storage Room',-5,10,14,12,1),room('it-engineering','Engineering & Developers',12,-13,32,18,14),room('it-lead','Lead Engineer Office',8,10,10,12,1),room('it-krams','EA — Krams',19,10,10,12,1),room('it-augustine','EA — Augustine',-8,-11,10,14,1),room('it-pantry','Pantry',-19,29,16,18),room('it-common','Common Area',-1,29,16,18),room('it-sleeping','Sleeping Quarters',17,29,16,18),room('it-employees','IT Employees Room',41,29,28,18,14),{...room('it-veranda','Veranda',56,-2,3,40),enclosed:true}];
for(const r of IT_ROOMS){r.roomType=r.id==='it-veranda'?'veranda':r.id==='it-pantry'?'pantry':r.id==='it-sleeping'?'rest':r.id==='it-common'?'lounge':r.id==='it-server'?'server':r.id==='it-storage'?'storage':'office';r.npcAccess=['it-veranda','it-server','it-storage','it-manager','it-lead','it-krams','it-augustine'].includes(r.id)?[]:['guard','custodian','musician'];}
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
export const floorSeats=(f:FloorId)=>f==='3'?SEATS:f==='1'?NEW_SEATS:f==='G'?LOBBY_SEATS:[];
export const LOBBY_FURNITURE:Furniture[]=[{id:'reception',room:'G:hallway',kind:'reception',x:8,z:-5,w:7,d:2,h:1.15},{id:'lobby-sofa',room:'G:hallway',kind:'sofa',x:-9,z:4,w:5,d:1.2,h:1},{id:'lobby-table',room:'G:hallway',kind:'table',x:-9,z:7,w:3,d:1.3,h:.5},...[-1,1].map((s,i)=>({id:`lobby-plant-${i}`,room:'G:hallway',kind:'planter',x:s*12,z:-8,w:1,d:1,h:1.5}))];
const wallCache=new Map<FloorId,Rect[]>();
export function floorWalls(floor:FloorId):Rect[]{if(floor==='3')return WALLS;if(wallCache.has(floor))return wallCache.get(floor)!;const b=floorConfig(floor).bounds;const walls:Rect[]=[{x:b.x-b.w/2,z:b.z,w:.18,d:b.d},{x:b.x+b.w/2,z:b.z,w:.18,d:b.d},{x:b.x,z:b.z-b.d/2,w:b.w,d:.18},{x:b.x,z:b.z+b.d/2,w:b.w,d:.18}];for(const r of floorRooms(floor)){const e=entrance(r),horizontal=r.side==='north'||r.side==='south',lo=horizontal?r.x-r.w/2:r.z-r.d/2,hi=horizontal?r.x+r.w/2:r.z+r.d/2,center=horizontal?e.x:e.z;const segment=(c:number,length:number,opposite=false):Rect=>horizontal?{x:c,z:opposite?2*r.z-e.z:e.z,w:length,d:.18}:{x:opposite?2*r.x-e.x:e.x,z:c,w:.18,d:length};walls.push(segment((lo+center-1.05)/2,center-1.05-lo),segment((hi+center+1.05)/2,hi-center-1.05),segment((lo+hi)/2,hi-lo,true));if(horizontal)walls.push({x:lo,z:r.z,w:.18,d:r.d},{x:hi,z:r.z,w:.18,d:r.d});else walls.push({x:r.x,z:lo,w:r.w,d:.18},{x:r.x,z:hi,w:r.w,d:.18});}wallCache.set(floor,walls);return walls;}
export function floorCanStand(p:Vec,floor:FloorId,radius=.28){if(floor==='3')return canStand(p,radius);return inside(p,floorConfig(floor).bounds,-radius)&&![...floorWalls(floor),...floorFurniture(floor).filter(f=>f.solid!==false&&!['tv','whiteboard','inventory'].includes(f.kind))].some(r=>inside(p,r,radius));}
export function floorStep(p:Player,input:Vec,dt:number,doors:Doors,sprint=false){const len=Math.max(1,Math.hypot(input.x,input.z)),dist=Math.min(.1,dt)*(sprint?6:3.8),start={x:p.x,z:p.z};for(let n=0;n<4;n++)for(const axis of ['x','z'] as const){const q={x:p.x,z:p.z};q[axis]+=input[axis]/len*dist/4;if(floorCanStand(q,p.floor)&&!floorRooms(p.floor).some(r=>doors[r.id]?.closed&&inside(q,doorRect(r.id),.28)))Object.assign(p,q);}p.moving=Math.hypot(start.x-p.x,start.z-p.z)>.001;if(p.moving)p.rotation=Math.atan2(input.x,input.z);p.room=floorRoomAt(p,p.floor);}
export const ROOM_ENTRANCES:Record<string,string[]>={};
export const roomEntrances=(id:string)=>ROOM_ENTRANCES[id]||[id];
export function resolveVoice(p:Pick<Player,'floor'|'room'|'inElevator'>,doors:Doors,settings:Record<string,{voice:string}>={}){if(p.inElevator)return 'elevator';if(settings[p.room]?.voice==='muted')return 'muted';const r=allRooms().find(r=>r.id===p.room);return r?.enclosed&&roomEntrances(r.id).every(id=>doors[id]?.closed)?`${p.floor}:private:${r.id}:v${roomEntrances(r.id).reduce((n,id)=>n+(doors[id]?.version||0),0)}`:`${p.floor}:proximity:v${Object.entries(doors).filter(([id])=>roomFloor(id)===p.floor).reduce((n,[,d])=>n+(d.version||0),0)}`;}
export function inventoryUrl(value:unknown){if(value==='')return '';if(typeof value!=='string'||value.length>2048)throw new Error('Enter a valid inventory URL.');const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');return u.href;}

export const IT_BEDS:Bed[]=[];
export const floorBeds=(f:FloorId):Bed[]=>f==='1'?IT_BEDS:f==='3'?BEDS:[];
function seatAt(room:string,x:number,z:number,rotation=0){NEW_SEATS.push({id:`${room}-seat-${NEW_SEATS.length}`,room,x,z,rotation,y:0,kind:'shared'});}
for(let i=0;i<7;i++)for(let row=0;row<2;row++)desk('it-employees',31+i*3.3,29+(row?.5:-.5),i*2+row,row?Math.PI:0,'cubicle');
for(const id of ['it-engineering','it-employees']){const r=IT_ROOMS.find(r=>r.id===id)!;prop('spine',id,r.x,r.z,24,.12,1.45);prop('tv',id,r.x,r.z+(r.side==='north'?1:-1)*(r.d/2-.3),5,.15,2.5);prop('whiteboard',id,r.x+r.w/2-.3,r.z, .15,3,2.2);prop('cabinet',id,r.x-r.w/2+1,r.z+r.d/2-2,1.4,.7,1.4);prop('printer',id,r.x+r.w/2-2,r.z+r.d/2-2,1.2,.8,1.1);}
// The same pantry furniture builders and seating semantics as Social Media.
prop('counter','it-pantry',-19,36.8,8.8,1.1,1);prop('fridge','it-pantry',-25.5,36.5,1,1,2);prop('water','it-pantry',-12.5,36.5,.65,.7,1.3);
for(const x of [-23,-15])for(const z of [26,31]){prop('canteen','it-pantry',x,z,2.1,1,.85);for(const side of [-1,1])seatAt('it-pantry',x,z+side*1.1,side===1?Math.PI:0);}
for(const x of [-26,-12])prop('bin','it-pantry',x,22,.6,.6,.8);prop('stockShelf','it-pantry',-26,33,1,.8,2.4);
for(const z of [25,33]){prop('sofa','it-common',-1,z,5,1.2,1);for(const x of [-2.3,-1,.3])seatAt('it-common',x,z,Math.PI);}
prop('table','it-common',-1,28,3,1.5,.5);prop('tv','it-common',-1,37.5,5,.15,2.5);prop('canteen','it-common',4,24,2,1,.85);seatAt('it-common',4,22.8);seatAt('it-common',4,25.2,Math.PI);
for(let i=0;i<6;i++){const x=12+(i%3)*4,z=25+Math.floor(i/3)*7;const f=prop('bed','it-sleeping',x,z,1.2,2.15,.6);IT_BEDS.push({id:f.id,room:'it-sleeping',x,z:z+.78,y:.75,rotation:0,exit:{x:x-.96,z}});prop('bedPanel','it-sleeping',x+.75,z,.1,2.25,1.3);prop('lamp','it-sleeping',x-1,z-1,.3,.3,1.3);}
prop('locker','it-sleeping',24,29,.65,7,2.2);prop('table','it-sleeping',17,36.5,2,1,.5);seatAt('it-sleeping',15,36.5,Math.PI/2);
for(const z of [-17,12])prop('planter','it-veranda',56,z,.7,.7,1.2);seatAt('it-veranda',56,8,Math.PI/2);seatAt('it-veranda',56,10,Math.PI/2);
for(const id of ['it-manager','it-lead','it-krams','it-augustine']){const r=IT_ROOMS.find(r=>r.id===id)!;prop('planter',id,r.x-r.w/2+1,r.z+r.d/2-1,.7,.7,1.2);prop('bookshelf',id,r.x,r.z+(r.side==='north'?1:-1)*(r.d/2-.5),id==='it-manager'?4:2,.5,2);prop('table',id,r.x+r.w/2-2,r.z+2,1.1,.8,.5);seatAt(id,r.x+2,r.z+2,Math.PI);}
for(const x of [-10,0])for(const z of [6,9])prop('stockShelf','it-storage',x,z,2,.8,2.4);
for(const [x,z] of [[-15,4],[-15,11],[15,8],[15,12]]){LOBBY_FURNITURE.push({id:`lobby-cluster-${x}-${z}`,room:'G:hallway',kind:'sofa',x,z,w:5,d:1.2,h:1},{id:`lobby-coffee-${x}-${z}`,room:'G:hallway',kind:'table',x,z:z-2,w:2.5,d:1.2,h:.5});}
LOBBY_FURNITURE.push({id:'lobby-aquarium',room:'G:hallway',kind:'aquarium',x:-12,z:-6,w:8,d:2,h:3.3},{id:'lobby-bar',room:'G:hallway',kind:'counter',x:14,z:-13,w:8.8,d:1.1,h:1},{id:'lobby-fridge',room:'G:hallway',kind:'fridge',x:20,z:-13,w:1,d:1,h:2},{id:'lobby-water',room:'G:hallway',kind:'water',x:8,z:-13,w:.7,d:.7,h:1.3});
export const LOBBY_SEATS:Seat[]=LOBBY_FURNITURE.filter(f=>f.kind==='sofa').flatMap(f=>[-1,0,1].map(i=>({id:`${f.id}-seat-${i}`,room:'G:hallway',x:f.x+i*1.3,z:f.z,rotation:Math.PI,y:0,kind:'shared' as const})));
export const npcAllowedRoom=(id:string,profile:string)=>profile==='cat'?id==='it-manager':(allRooms().find(r=>r.id===id)?.npcAccess?.includes(profile)??true);
