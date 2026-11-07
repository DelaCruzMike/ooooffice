import {floorConfig,mayEnter,type FloorId,FLOOR_IDS} from './building.js';
import type {Player,Vec} from './world.js';
export type ElevatorState={now:number;floor:FloorId;destination:FloorId|null;phase:'idle'|'opening'|'open'|'closing'|'moving';direction:number;queue:FloorId[];occupants:string[];at:number;arrival:number;notice:string};
export const newElevator=():ElevatorState=>({now:0,floor:'G',destination:null,phase:'open',direction:0,queue:[],occupants:[],at:0,arrival:0,notice:''});
export class Elevator {
 state=newElevator();time=0;
 constructor(private players:Map<string,Player>){}
 near(p:Player){const e=floorConfig(p.floor).landing;return Math.hypot(p.x-e.x,p.z-e.z)<3.5;}
 action(p:Player,type:string,value:unknown){const s=this.state;if(!p.inElevator&&!this.near(p))return;
 if(type==='elevator:call'){if(!s.queue.includes(p.floor)&&s.destination!==p.floor)s.queue.push(p.floor);if(s.floor===p.floor&&s.phase==='idle')this.open();}
 if(type==='elevator:enter'){if(p.inElevator||s.floor!==p.floor||s.phase!=='open')return;if(s.occupants.length>=5){s.notice='Elevator full — 5/5';return;}s.occupants.push(p.id);Object.assign(p,{inElevator:true,x:(s.occupants.length%3-1)*.8,z:-.6+Math.floor(s.occupants.length/3)*1.1,room:'elevator',seat:null,bed:null,y:0,vy:0,grounded:true});s.at=this.time;s.notice='';}
 if(!p.inElevator)return;
 if(type==='elevator:exit'&&s.phase==='open'){s.occupants=s.occupants.filter(id=>id!==p.id);Object.assign(p,{inElevator:false,...this.exitPosition(s.floor),floor:s.floor,room:`${s.floor}:hallway`,y:0});s.at=this.time;}
 if(type==='elevator:select'&&s.phase!=='moving'&&FLOOR_IDS.includes(value as FloorId)){const target=value as FloorId;if(!s.occupants.every(id=>{const q=this.players.get(id);return q&&mayEnter(q,target);})){s.notice='Destination locked for a passenger.';return;}if(target!==s.floor&&!s.queue.includes(target))s.queue.push(target);s.at=this.time;s.notice='';}
 if(type==='elevator:open'&&s.phase!=='moving')this.open();
 if(type==='elevator:close'&&s.phase==='open')s.at=this.time-5000;
 }
 exitPosition(floor:FloorId){const e=floorConfig(floor).landing;return floor==='1'||floor==='3'?{x:e.x+1.5,z:e.z}:{x:e.x,z:e.z+1.5};}
 crossing(p:Player,next:Vec){const e=floorConfig(p.floor).landing,west=p.floor==='1'||p.floor==='3';const depth=west?next.x-e.x:next.z-e.z,width=west?next.z-e.z:next.x-e.x;const old=west?p.x-e.x:p.z-e.z;return Math.abs(width)<1&&depth<.7&&old>=.7;}
 open(){this.state.phase='opening';this.state.at=this.time;}
 tick(dt:number){this.time+=dt*1000;const s=this.state;s.now=this.time;s.occupants=s.occupants.filter(id=>this.players.get(id)?.inElevator);
 const blocked=[...this.players.values()].some(p=>!p.inElevator&&p.floor===s.floor&&Math.hypot(p.x-floorConfig(p.floor).landing.x,p.z-floorConfig(p.floor).landing.z)<.65);
 if(s.phase==='opening'&&this.time-s.at>=1000){s.phase='open';s.at=this.time;s.arrival++;}
 if(s.phase==='open'&&this.time-s.at>=5000){if(blocked){s.notice='Doorway occupied';return;}s.phase='closing';s.at=this.time;}
 if(s.phase==='closing'){if(blocked){this.open();return;}if(this.time-s.at>=1000){if(!s.destination)s.destination=s.queue.shift()||null;if(s.destination&&!s.occupants.every(id=>mayEnter(this.players.get(id)!,s.destination!))){s.destination='G';s.notice='Access changed. Returning to lobby.';}if(s.destination&&s.destination!==s.floor){s.phase='moving';s.direction=Math.sign(floorConfig(s.destination).number-floorConfig(s.floor).number);s.at=this.time;}else{s.destination=null;s.phase='idle';s.direction=0;}}}
 if(s.phase==='idle'&&(s.destination||s.queue.length)){s.destination=s.destination||s.queue.shift()!;if(s.destination===s.floor){s.destination=null;this.open();}else{s.phase='closing';s.at=this.time-1000;}}
 if(s.phase==='moving'&&s.destination&&this.time-s.at>=Math.abs(floorConfig(s.destination).number-floorConfig(s.floor).number)*2000){const destination=s.occupants.every(id=>mayEnter(this.players.get(id)!,s.destination!))?s.destination:'G';s.floor=destination;s.destination=null;s.direction=0;s.queue=s.queue.filter(f=>f!==destination);for(const id of s.occupants){const p=this.players.get(id)!;p.floor=destination;}this.open();}
 }
 move(p:Player,input:Vec,dt:number){const d=Math.min(.1,dt)*3.8/Math.max(1,Math.hypot(input.x,input.z));p.x=Math.max(-1.6,Math.min(1.6,p.x+input.x*d));p.z=Math.max(-1.6,Math.min(1.6,p.z+input.z*d));p.moving=Math.hypot(input.x,input.z)>.05;if(p.moving)p.rotation=Math.atan2(input.x,input.z);p.room='elevator';p.y=0;p.grounded=true;}
}
