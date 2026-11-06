import type { Snapshot,Player } from './world.js';
export type Motion=[string,number,number,number,number,number,boolean,boolean];
export type Patch={updates:Player[];motion:Motion[];removed:string[];office?:Omit<Snapshot,'players'>};
const metadata=(p:Player)=>{const{x,z,y,vy,rotation,moving,grounded,...rest}=p;return JSON.stringify(rest);};
const motion=(p:Player):Motion=>[p.id,Math.round(p.x*100),Math.round(p.z*100),Math.round(p.rotation*100),Math.round(p.y*100),Math.round(p.vy*100),p.grounded,p.moving];
export class SnapshotDiffer{
 private previous=new Map<string,{metadata:string;motion:string}>();private office='';
 diff(s:Snapshot):Patch|null{const patch:Patch={updates:[],motion:[],removed:[]},ids=new Set(s.players.map(p=>p.id));for(const id of this.previous.keys())if(!ids.has(id)){patch.removed.push(id);this.previous.delete(id);}
 for(const p of s.players){const m=metadata(p),v=motion(p),key=JSON.stringify(v),old=this.previous.get(p.id);if(!old||old.metadata!==m)patch.updates.push(p);else if(old.motion!==key)patch.motion.push(v);this.previous.set(p.id,{metadata:m,motion:key});}
 const{players,...office}=s,key=JSON.stringify(office);if(this.office!==key){patch.office=office;this.office=key;}return patch.updates.length||patch.motion.length||patch.removed.length||patch.office?patch:null;}
}
export function applyPatch(s:Snapshot,patch:Patch):Snapshot{const players=new Map(s.players.filter(p=>!patch.removed.includes(p.id)).map(p=>[p.id,{...p}]));for(const p of patch.updates)players.set(p.id,{...p});for(const[id,x,z,rotation,y,vy,grounded,moving]of patch.motion){const p=players.get(id);if(p)Object.assign(p,{x:x/100,z:z/100,rotation:rotation/100,y:y/100,vy:vy/100,grounded,moving});}return {...s,...patch.office,players:[...players.values()]};}
