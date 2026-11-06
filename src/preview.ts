import { OfficeEngine } from '../shared/engine';
import { DEFAULT_AVATAR, ROOMS, canStand, entrance, roomAt, type Avatar, type MoveInput, type Player } from '../shared/world';
export const PREVIEW_ID='you-preview';
export class LocalPreview {
 engine=new OfficeEngine(true);
 constructor(avatar?:Avatar,options?:{room?:string;crowd?:boolean}){this.engine.add(PREVIEW_ID,PREVIEW_ID,'You',avatar||DEFAULT_AVATAR,'owner','Team');
  const actors:Partial<Player>[]=[{id:'demo-1',name:'Alex · demo',x:-10,z:7,rotation:1.2,avatar:{...DEFAULT_AVATAR,skin:'#a56f50',shirt:'#cc9f79',style:'bun'}},{id:'demo-2',name:'Sam · demo',x:-17,z:3.5,rotation:.5,avatar:{...DEFAULT_AVATAR,shirt:'#8c9fba',hair:'#d4bd86',style:'bob'}},{id:'demo-3',name:'Jules · demo',x:-3,z:1.5,rotation:2.4,avatar:{...DEFAULT_AVATAR,shirt:'#bba3c7',accessory:'glasses'}}];
  for(const a of actors){const p=this.engine.add(a.id!,a.id!,a.name!,a.avatar!,'member','Demo');Object.assign(p,a);}
  if(options?.room){const r=ROOMS.find(r=>r.id===options.room);if(r){const e=entrance(r);const candidates=r.id==='lounge'?[{x:-5,z:9}]:r.id==='smoking'?[{x:24,z:2}]:[{x:e.x,z:e.z+(r.side==='south'?-1.2:1.2)}];const point=candidates.find(p=>canStand(p));if(point)Object.assign(this.me,point,{room:roomAt(point),rotation:r.side==='north'?0:r.side==='west'?Math.PI/2:Math.PI});}}
  if(options?.crowd){for(let i=0;i<400&&this.engine.players.size<50;i++){const q={x:this.me.x+(i%20-10)*.72,z:this.me.z+(Math.floor(i/20)-10)*.72};if(!canStand(q)||roomAt(q)!=='lounge')continue;const id=`crowd-${i}`,p=this.engine.add(id,id,`Demo ${i}`,{...DEFAULT_AVATAR,shirt:['#7c8871','#8c9fba','#cc9f79','#bba3c7'][i%4]},'member','Demo');Object.assign(p,q,{room:'lounge'});}}

 }
 get me(){return this.engine.players.get(PREVIEW_ID)!;}
 get snapshot(){return this.engine.snapshot();}
 step(dt:number,input:MoveInput){this.engine.input(PREVIEW_ID,input);this.engine.tick(dt);return this.me;}
 action(type:string,d:Record<string,unknown>){return this.engine.action(PREVIEW_ID,type,d);}
}
