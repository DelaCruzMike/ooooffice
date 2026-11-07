import {glass,decorateFloor,cityBackdrop} from './office-life';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {FLOORS,floorConfig,floorRooms,floorWalls,floorFurniture,floorSeats,type FloorId} from '../../shared/building';
import {entrance,type Furniture,type Snapshot} from '../../shared/world';
import type {OfficeArt} from './art';
export function buildFloor(a:OfficeArt,floor:FloorId){const f=floorConfig(floor),b=f.bounds,height=floor==='G'?7:3.4;
 a.box('stone floor',b.x,-.1,b.z,b.w,.2,b.d,'#c0c9c4');a.box('ceiling',b.x,height,b.z,b.w,.15,b.d,'#e3e5de');if(floor==='1')a.box('corridor runner',0,.015,0,53,.025,3,'#8d9f9c');
 for(const r of floorRooms(floor)){a.box('room carpet',r.x,.012,r.z,r.w-.2,.025,r.d-.2,r.color);a.placard(r);}
 for(const w of floorWalls(floor)){const outside=Math.abs(w.x-(b.x-b.w/2))<.1||Math.abs(w.x-(b.x+b.w/2))<.1||Math.abs(w.z-(b.z-b.d/2))<.1||Math.abs(w.z-(b.z+b.d/2))<.1;const rear=floorRooms(floor).some(r=>!['it-server','it-storage','it-sleeping'].includes(r.id)&&Math.abs(w.z-(2*r.z-entrance(r).z))<.1&&w.w>2);const veranda=floor==='1'&&(w.x===54.5||w.x===57.5);if((floor==='G'&&outside&&w.z>0)||(floor==='1'&&(outside||rear||veranda)))glass(a,w.x,w.z,w.w,w.d,veranda?1.2:height-.2);else a.box('wall',w.x,(height-.2)/2,w.z,w.w,height-.2,w.d,'#e1e3da');}
 decorateFloor(a,floor);if(floor==='G'||floor==='1')cityBackdrop(a,floor);
 for(const p of floorFurniture(floor))special(a,p);
 for(const s of floorSeats(floor))a.chair(s.x,s.z,s.rotation,0,s.room==='it-manager');
 for(let x=b.x-b.w/2+4;x<b.x+b.w/2;x+=8)for(let z=b.z-b.d/2+4;z<b.z+b.d/2;z+=8){a.box('ceiling light',x,height-.25,z,2.3,.06,.4,'#f8f2d8');}
 if(floor==='G'){a.text('ooooffice\nA LITTLE CLOSER',8,2.2,-8.8,5,1,'#53654f','',Math.PI);a.text('WELCOME\nReception',8,1.2,-3.95,3,.6,'#fff9e7','',Math.PI);for(const x of[6,10])a.chair(x,-6,Math.PI);a.box('inactive lift',-7,1.4,-9,2.2,2.8,.2,'#a0aaa5');a.text('SERVICE\nNot in use',-7,2,-8.86,1.8,.5,'#edf0e6','',Math.PI);}
 if(!f.prepared)a.text(`${f.name}\nFloor under preparation`,0,1.8,1,8,1.1,'#405950','',Math.PI);
 a.batch();for(const r of floorRooms(floor)){const e=entrance(r),door=new TransformNode(`door-${r.id}`,a.scene);door.position.set(e.x,0,e.z);a.box('door panel',0,1.35,0,2,2.7,.12,'#7a8e8b',door);a.box('glass inset',0,1.68,.07,1.6,1.5,.025,'#bfd5cf',door,.55);a.doors.set(r.id,door);}
 elevatorLanding(a,floor);
}
function special(a:OfficeArt,f:Furniture){const{x,z}=f;
 if(f.id==='lobby-aquarium'){const before=new Set(a.scene.meshes),nodes=new Set(a.scene.transformNodes);a.aquarium({...f,w:8,d:2});const root=new TransformNode('statement aquarium',a.scene);for(const node of [...a.scene.meshes,...a.scene.transformNodes])if(node!==root&&!before.has(node as Mesh)&&!nodes.has(node as TransformNode)&&!node.parent){node.parent=root;}root.scaling.y=1.8;return;}
 if(f.kind==='lamp'){a.cyl('bed lamp',x,.65,z,.035,1.3,'#697c76');a.cyl('warm lampshade',x,1.3,z,.35,.3,'#e3d6ad');return;}
 if(f.kind==='printer'){a.box('printer cabinet',x,.4,z,1.2,.8,.8,'#8e9f98');a.box('office printer',x,1,z,.9,.4,.65,'#d1d8cf');a.box('paper tray',x,1.05,z+.4,.7,.08,.3,'#3f5659');return;}
 if(f.kind==='reception'){a.box('reception stone base',x,.5,z,f.w,1,f.d,'#b7beb2');a.box('oak reception top',x,1.08,z,f.w+.15,.15,f.d+.1,'#a58c67');return;}
 if(f.kind==='rack'){a.box('rack enclosure',x,1.25,z,1.2,2.5,1.4,'#34434b');for(let i=0;i<9;i++){a.box('rack panel',x,.25+i*.24,z+.72,1.05,.19,.04,'#607279');for(let j=0;j<5;j++){const led=a.box('status LED',x-.4+j*.1,.25+i*.24,z+.75,.035,.035,.025,j%2?'#a9d98c':'#c3dd96');a.effects.push(led);}a.box('cable tray',x,.25+i*.24,z-.74,1.1,.08,.06,'#809d9b');}a.text('RACK / NETWORK',x,2.32,z+.76,1,.18);return;}
 if(f.kind==='stockShelf'){a.box('shelf back',x,1.2,z,f.w,2.4,.1,'#647b80');for(let i=0;i<4;i++){a.box('storage shelf',x,.15+i*.6,z+.3,f.w,.06,.8,'#aebbb7');for(let j=0;j<3;j++){a.box('equipment bin',x+(j-1)*.6,.36+i*.6,z+.3,.5,.35,.55,i%2?'#b8a382':'#819ca4');a.text(['CABLES','PARTS','SPARES'][j],x+(j-1)*.6,.36+i*.6,z+.59,.45,.12);}}return;}
 if(f.kind==='catTower'){a.box('cat tower base',x,.08,z,1.4,.16,1.4,'#a69c85');for(let i=0;i<3;i++){a.cyl('scratch post',x+(i%2?.35:-.35),.32+i*.52,z,.15,.6,'#bda780');a.box('cat platform',x,.53+i*.52,z,1.1,.12,.85,'#c1bbaa');}return;}
 if(['food','waterBowl'].includes(f.kind)){a.cyl('cat bowl',x,.08,z,.45,.16,'#c6c1ac');a.cyl('bowl contents',x,.17,z,.32,.015,f.kind==='food'?'#8c6444':'#85b6c8');return;}
 if(f.kind==='litter'||f.kind==='catBed'){a.box(f.kind,x,.12,z,f.w,.24,f.d,f.kind==='litter'?'#c5bda7':'#ac9ab7');a.box('soft inset',x,.25,z,f.w-.15,.03,f.d-.15,'#d7cdbb');return;}
 if(f.kind==='cooling'){a.box('cooling unit',x,2.4,z,4,.6,.5,'#bdc7c6');for(let i=0;i<8;i++)a.box('cooling vent',x,2.2+i*.04,z+.27,3.7,.015,.02,'#61777c');return;}
 if(f.kind==='inventory'){a.text('INVENTORY\nE — Open computer',x,2.15,z,2.5,.55,'#f3efe3','#465e60',Math.PI);return;}
 a.buildFurniture(f);
}
function liftDoors(a:OfficeArt,parent:TransformNode,z:number){for(const side of[-1,1]){const m=a.box('lift sliding panel',side*.55,1.4,z,1.08,2.8,.07,'#aab7b6',parent);m.metadata={liftDoor:side};}}
export function elevatorLanding(a:OfficeArt,floor:FloorId){const f=floorConfig(floor),e=f.landing,root=new TransformNode('lift landing',a.scene);root.position.set(e.x,0,e.z);if(floor==='1'||floor==='3')root.rotation.y=Math.PI/2;
 a.box('lift recess',0,1.4,-.15,2.3,2.8,.05,'#263a3e',root);for(const side of[-1,1])a.box('lift jamb',side*1.3,1.5,0,.3,3,.3,'#627475',root);a.box('lift lintel',0,2.95,0,2.9,.15,.3,'#627475',root);liftDoors(a,root,.18);
 a.text(`${f.id} — ${f.name}`,0,3.05,.25,5,.28,'#edf0e6','#445a50',Math.PI,root);a.box('call panel',1.8,1.25,.2,.25,.55,.12,'#384d50',root);a.text('CALL',1.8,1.3,.28,.25,.18,'#edf0e6','',Math.PI,root);
}
export function buildCabin(a:OfficeArt){a.box('cabin floor',0,-.08,0,4,.16,4,'#c2b398');for(const x of[-2,2]){a.box('oak cabin wall',x,1.5,0,.12,3,4,'#b59d79');a.box('hand rail',x*.96,1,0,.06,.06,3.5,'#8b9b9c');}a.box('back wall',0,1.5,-2,4,3,.12,'#b59d79');for(const x of[-1.65,1.65])a.box('front cabin wall',x,1.5,2,.7,3,.1,'#9aa9a8');a.text('ooooffice\nBUILDING ELEVATOR',0,2,-1.92,2.4,.6,'#edf0e6','',Math.PI);a.box('ceiling light',0,2.95,0,2,.06,1.3,'#f5ebcc');for(let i=0;i<5;i++)a.cyl('floor button',1.9,1.8-i*.18,.6,.12,.03,'#d9d9c7').rotation.z=Math.PI/2;a.batch();liftDoors(a,new TransformNode('cabin entrance',a.scene),2);}
export function syncLift(a:OfficeArt,s:Snapshot['elevator'],floor:FloorId,cabin:boolean){const phase=cabin||s.floor===floor?s.phase:'idle';const progress=Math.max(0,Math.min(1,(s.now-s.at)/1000));const open=phase==='open'?1:phase==='opening'?progress:phase==='closing'?1-progress:0;for(const mesh of a.scene.meshes)if(mesh.metadata?.liftDoor)mesh.position.x=mesh.metadata.liftDoor*(.55+open*1.1);}

export function decorateSocial(a:OfficeArt){decorateFloor(a,'3');}
