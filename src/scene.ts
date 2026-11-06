import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3,Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { OfficeArt } from './render/art';
import { AvatarRig } from './render/avatar';
import { chaseCamera,emptySnapshot,type Snapshot,type Player,type Vec,type MoveInput } from '../shared/world';
export type SceneControls={interact:()=>void;emote:(e:string)=>void;jump:()=>void;onStep:(dt:number,input:MoveInput)=>Player|undefined;onFps:(fps:number)=>void;paused?:boolean};
export class OfficeScene {
 engine:Engine;scene:Scene;camera:FreeCamera;art:OfficeArt;players:Player[]=[];myId='';snapshot=emptySnapshot();keys=new Set<string>();stick:Vec={x:0,z:0};rigs=new Map<string,AvatarRig>();private previous=performance.now();private time=0;private frame=0;private low=false;private disposed=false;private down:(e:KeyboardEvent)=>void;private up:(e:KeyboardEvent)=>void;private resize:()=>void;private blur:()=>void;private noWheel:(e:WheelEvent)=>void;
 constructor(public canvas:HTMLCanvasElement,public controls:SceneControls){
 this.engine=new Engine(canvas,true,{stencil:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.engine.setHardwareScalingLevel(window.innerWidth<900?1.5:Math.max(1,devicePixelRatio/1.5));
 this.scene=new Scene(this.engine);this.scene.clearColor=new Color4(.65,.76,.79,1);this.scene.fogMode=Scene.FOGMODE_LINEAR;this.scene.fogColor=Color3.FromHexString('#afc2c4');this.scene.fogStart=110;this.scene.fogEnd=340;
 this.camera=new FreeCamera('locked chase camera',new Vector3(-5,2.05,12.5),this.scene);this.camera.minZ=.08;this.camera.fov=.98;this.camera.inputs.clear();
 const sky=new HemisphericLight('soft office fill',new Vector3(.2,1,-.15),this.scene);sky.intensity=.92;sky.groundColor=Color3.FromHexString('#c4c9bb');const sun=new DirectionalLight('daylight',new Vector3(-.6,-1,.5),this.scene);sun.intensity=.28;sun.diffuse=Color3.FromHexString('#f5ead6');
 this.art=new OfficeArt(this.scene);this.art.build();
 this.down=e=>{if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')||controls.paused)return;const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();this.keys.add(key);if(!e.repeat){if(key==='e')controls.interact();if(e.code==='Space')controls.jump();if(key==='1')controls.emote('wave');if(key==='2')controls.emote('groove');if(key==='3')controls.emote('kiss');}};
 this.up=e=>this.keys.delete(e.key.toLowerCase());this.blur=()=>{this.keys.clear();this.stick={x:0,z:0};};this.resize=()=>this.engine.resize();this.noWheel=e=>e.preventDefault();
 window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);window.addEventListener('blur',this.blur);window.addEventListener('resize',this.resize);canvas.addEventListener('wheel',this.noWheel,{passive:false});this.engine.runRenderLoop(()=>this.render());
 }
 sync(s:Snapshot,id:string){this.snapshot=s;this.myId=id;const old=this.players.find(p=>p.id===id);this.players=s.players.map(p=>{if(old&&!old.seat&&!old.bed&&p.id===id&&!p.seat&&!p.bed&&Math.hypot(p.x-old.x,p.z-old.z)<.75&&Math.abs(p.y-old.y)<.3)return {...p,x:old.x,z:old.z,y:old.y,rotation:old.rotation,vy:old.vy,grounded:old.grounded};return {...p};});for(const[id,rig]of this.rigs)if(!s.players.some(p=>p.id===id)){rig.dispose();this.rigs.delete(id);}}
 setQuality(low:boolean){this.low=low;this.engine.setHardwareScalingLevel(low?2:Math.max(1,devicePixelRatio/1.5));}
 render(){if(this.disposed)return;const now=performance.now(),dt=Math.min(.06,(now-this.previous)/1000);this.previous=now;this.time+=dt;
 const forward=Number(this.keys.has('w')||this.keys.has('arrowup'))-Number(this.keys.has('s')||this.keys.has('arrowdown'))-this.stick.z;
 const turn=Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft'))+this.stick.x;
 const input=this.controls.paused?{forward:0,turn:0}:{forward:Math.max(-1,Math.min(1,forward)),turn:Math.max(-1,Math.min(1,turn))};
 const updated=this.controls.onStep(dt,input);const me=this.players.find(p=>p.id===this.myId);if(me&&updated&&me!==updated)Object.assign(me,updated);
 if(me){const view=chaseCamera(me),position=new Vector3(view.position.x,view.position.y,view.position.z),target=new Vector3(view.target.x,view.target.y,view.target.z);const obstructionDistance=Vector3.Distance(position,target);this.camera.position=obstructionDistance<3.1?position:Vector3.Lerp(this.camera.position,position,Math.min(1,dt*12));this.camera.setTarget(target);}
 for(const p of this.players){let rig=this.rigs.get(p.id);if(rig&&rig.appearance!==JSON.stringify(p.avatar)){rig.dispose();this.rigs.delete(p.id);rig=undefined;}if(!rig){rig=new AvatarRig(this.art,p,this.myId);this.rigs.set(p.id,rig);}rig.update(p,this.time,dt,this.myId,me,this.frame);rig.fade(Vector3.Distance(this.camera.position,new Vector3(p.x,p.y+1.1,p.z))<.85);}
 this.art.animate(this.time,this.low);if(++this.frame%60===0)this.controls.onFps(Math.round(this.engine.getFps()));this.scene.render();
 }
 dispose(){this.disposed=true;this.engine.stopRenderLoop();window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);window.removeEventListener('blur',this.blur);window.removeEventListener('resize',this.resize);this.canvas.removeEventListener('wheel',this.noWheel);this.scene.dispose();this.engine.dispose();}
}
