import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { OfficeArt } from './art';
import { groundHeight,type Player } from '../../shared/world';
export class AvatarRig {
 root:TransformNode;head:TransformNode;leftArm:TransformNode;rightArm:TransformNode;leftElbow:TransformNode;rightElbow:TransformNode;leftLeg:TransformNode;rightLeg:TransformNode;leftKnee:TransformNode;rightKnee:TransformNode;heart:TransformNode;headset:TransformNode;shadow:Mesh;label:Mesh;private faded=false;appearance:string;
 constructor(public art:OfficeArt,p:Player,myId:string){
 const a=p.avatar;this.appearance=JSON.stringify(a);this.root=new TransformNode(`person-${p.id}`,art.scene);this.root.position.set(p.x,p.y,p.z);this.root.rotation.y=p.rotation;
 const joint=(name:string,x:number,y:number,z:number,parent=this.root)=>{const n=new TransformNode(name,art.scene);n.parent=parent;n.position.set(x,y,z);return n;};
 const tapered=(name:string,parent:TransformNode,length:number,top:number,bottom:number,color:string)=>{const m=MeshBuilder.CreateCylinder(name,{height:length,diameterTop:top,diameterBottom:bottom,tessellation:6},art.scene);m.position.y=-length/2;m.parent=parent;m.material=art.mat(color);return m;};
 // Angular torso and pelvis, with a narrower waist and shaped shoulders.
 const torso=MeshBuilder.CreateCylinder('faceted shirt',{height:.58,diameterTop:.69,diameterBottom:.49,tessellation:6},art.scene);torso.parent=this.root;torso.position.y=1.14;torso.scaling.set(.9,1,.59);torso.material=art.mat(a.shirt);
 const hips=art.cyl('trouser hips',0,.83,0,.45,.22,a.trousers,this.root,.49);hips.scaling.z=.68;
 art.cyl('neck',0,1.47,0,.13,.17,a.skin,this.root);
 this.head=joint('head',0,1.65,0);const face=art.sphere('angular face',0,0,.015,.36,a.skin,this.head);face.scaling.set(.88,1.22,.9);
 const jaw=art.box('jaw',0,-.1,.025,.22,.12,.23,a.skin,this.head);jaw.rotation.y=.03;
 for(const s of[-1,1]){art.sphere('ear',s*.163,-.01,0,.075,a.skin,this.head);art.box('brow',s*.066,.045,.163,.07,.018,.017,a.hair,this.head);art.box('eye',s*.067,.01,.17,.025,.024,.013,'#26342d',this.head);}
 const nose=art.sphere('nose',0,-.025,.18,.065,a.skin,this.head);nose.scaling.set(.6,.85,1.1);art.box('mouth',0,-.1,.155,.065,.013,.015,'#8a5946',this.head);
 const hair=art.sphere('faceted hairstyle',0,.12,-.015,.37,a.hair,this.head);hair.scaling.set(1,.7,1.02);
 if(a.style==='bob'){const back=art.sphere('bob hair',0,.02,-.075,.39,a.hair,this.head);back.scaling.set(1,1.03,.74);}
 if(a.style==='bun')art.sphere('hair bun',0,.25,-.07,.18,a.hair,this.head);
 if(a.accessory==='glasses'){for(const s of[-1,1]){art.box('glasses frame',s*.071,.014,.185,.128,.083,.014,'#33453b',this.head);art.box('glasses lens',s*.071,.014,.196,.093,.052,.005,'#acbcb0',this.head);}art.box('glasses bridge',0,.02,.194,.027,.018,.012,'#33453b',this.head);}
 if(a.accessory==='cap'){art.cyl('cap',0,.17,-.01,.38,.12,a.shirt,this.head);art.box('cap peak',0,.14,.17,.35,.035,.22,a.shirt,this.head);}
 this.leftArm=joint('left shoulder',-.29,1.38,0);this.rightArm=joint('right shoulder',.29,1.38,0);
 tapered('left upper sleeve',this.leftArm,.31,.18,.145,a.shirt);tapered('right upper sleeve',this.rightArm,.31,.18,.145,a.shirt);
 this.leftElbow=joint('left elbow',0,-.31,0,this.leftArm);this.rightElbow=joint('right elbow',0,-.31,0,this.rightArm);
 for(const arm of[this.leftElbow,this.rightElbow]){tapered('faceted forearm',arm,.29,.14,.1,a.skin);const hand=art.sphere('hand',0,-.34,.012,.135,a.skin,arm);hand.scaling.set(.75,1.2,.75);art.box('fingers',0,-.39,.012,.075,.09,.075,a.skin,arm);}
 this.leftLeg=joint('left hip',-.125,.81,0);this.rightLeg=joint('right hip',.125,.81,0);
 tapered('left thigh',this.leftLeg,.39,.235,.17,a.trousers);tapered('right thigh',this.rightLeg,.39,.235,.17,a.trousers);
 this.leftKnee=joint('left knee',0,-.39,0,this.leftLeg);this.rightKnee=joint('right knee',0,-.39,0,this.rightLeg);
 for(const leg of[this.leftKnee,this.rightKnee]){tapered('lower trouser leg',leg,.34,.17,.125,a.trousers);art.box('shoe',0,-.37,.065,.18,.13,.31,'#dfdfd0',leg);art.box('shoe sole',0,-.435,.065,.19,.025,.32,'#697971',leg);}
 this.headset=joint('call-center headset',0,0,0,this.head);art.box('headset band',0,.23,0,.43,.045,.12,'#303c42',this.headset);for(const s of[-1,1]){art.box('headset band side',s*.2,.11,0,.045,.28,.12,'#303c42',this.headset);art.box('oversized ear cushion',s*.21,-.01,0,.13,.22,.19,'#26343b',this.headset);}art.box('headset boom',.17,-.08,.2,.04,.035,.35,'#38494d',this.headset);this.headset.setEnabled(false);
 this.heart=joint('flying kiss',0,1.68,.35);for(const s of[-1,1])art.sphere('heart lobe',s*.045,.035,0,.12,'#ce7c7a',this.heart);const tip=art.box('heart point',0,-.02,0,.11,.11,.065,'#ce7c7a',this.heart);tip.rotation.z=Math.PI/4;this.heart.setEnabled(false);
 const shadow=MeshBuilder.CreateGround('character contact shadow',{width:.65,height:.65},art.scene);shadow.material=art.shadowMaterial();shadow.isPickable=false;this.shadow=shadow;
 this.label=art.text(p.id===myId?'You':p.name,0,2.04,0,1.45,.25,'#eef0e3','#3d5148',0,this.root);this.label.billboardMode=Mesh.BILLBOARDMODE_ALL;
 }
 update(p:Player,t:number,dt:number,myId:string,me:Player|undefined,frame:number){
 this.shadow.position.set(p.x,groundHeight(p)+.065,p.z);this.shadow.setEnabled(!p.bed);this.shadow.visibility=.65/(1+Math.max(0,p.y-groundHeight(p)));
 const distance=me?Math.hypot(me.x-p.x,me.z-p.z):0;this.root.setEnabled(distance<28||p.id===myId);if(!this.root.isEnabled()){this.shadow.setEnabled(false);return;}this.label.setEnabled(p.id!==myId&&distance<14);
 this.root.position.x+=(p.x-this.root.position.x)*Math.min(1,dt*18);this.root.position.z+=(p.z-this.root.position.z)*Math.min(1,dt*18);
 const angle=Math.atan2(Math.sin(p.rotation-this.root.rotation.y),Math.cos(p.rotation-this.root.rotation.y));this.root.rotation.y+=angle*Math.min(1,dt*16);
 this.root.rotation.x=0;this.root.rotation.z=0;this.root.position.y=p.y;
 if(distance>18&&frame%3)return;
 const walk=p.moving&&p.grounded?Math.sin(t*10)*.54:0;
 this.leftArm.rotation.set(walk,0,.08);this.rightArm.rotation.set(-walk,0,-.08);this.leftElbow.rotation.set(-.12-Math.abs(walk)*.25,0,0);this.rightElbow.rotation.copyFrom(this.leftElbow.rotation);
 this.leftLeg.rotation.set(-walk,0,0);this.rightLeg.rotation.set(walk,0,0);this.leftKnee.rotation.set(Math.max(0,walk)*.8,0,0);this.rightKnee.rotation.set(Math.max(0,-walk)*.8,0,0);
 this.headset.setEnabled(p.room==='csr'&&Boolean(p.seat));
 this.head.rotation.set(0,0,0);this.heart.setEnabled(false);
 if(!p.grounded){this.leftLeg.rotation.x=-.3;this.rightLeg.rotation.x=.18;this.leftKnee.rotation.x=.5;this.rightKnee.rotation.x=.3;this.leftArm.rotation.z=.4;this.rightArm.rotation.z=-.4;}
 if(p.seat){this.root.position.y=p.y-.31;this.leftLeg.rotation.x=this.rightLeg.rotation.x=-Math.PI/2;this.leftKnee.rotation.x=this.rightKnee.rotation.x=Math.PI/2;this.leftArm.rotation.x=this.rightArm.rotation.x=-.4;this.leftElbow.rotation.x=this.rightElbow.rotation.x=-.7;}
 if(p.bed){this.root.position.y=p.y;this.root.rotation.x=-Math.PI/2;this.leftArm.rotation.z=.18;this.rightArm.rotation.z=-.18;return;}
 const e=Math.max(0,(Date.now()-p.emoteAt)/1000);
 if(p.emote==='wave'){this.rightArm.rotation.z=-2.45;this.rightElbow.rotation.z=Math.sin(e*8)*.25;}
 if(p.emote==='salute'){this.rightArm.rotation.set(-.5,0,-1.3);this.rightElbow.rotation.x=-1.8;}
 if(p.emote==='clap'){const clap=Math.sin(e*10)*.16;this.leftArm.rotation.set(-.9,0,-.2-clap);this.rightArm.rotation.set(-.9,0,.2+clap);this.leftElbow.rotation.x=this.rightElbow.rotation.x=-1.3;}
 if(p.emote==='kiss'){this.rightArm.rotation.x=e<.9?-1.15:-.7;this.rightElbow.rotation.x=e<.9?-1.25:-.15;this.heart.setEnabled(e>.7&&e<2.35);this.heart.position.set(.1,1.7+(e-.7)*.12,.4+Math.max(0,e-.7)*.65);this.heart.scaling.setAll(.6+Math.min(1,e)*.6);}
 if(['groove','shuffle','disco'].includes(p.emote)){const disco=p.emote==='disco',shuffle=p.emote==='shuffle',beat=Math.sin(e*(shuffle?10:6));this.root.position.y=p.y+Math.abs(beat)*.07;this.root.rotation.z=beat*.07;this.leftArm.rotation.z=.55+beat*.3;this.rightArm.rotation.z=disco?-2.3:-.55-beat*.3;this.leftElbow.rotation.x=-1;this.rightElbow.rotation.x=disco?-.2:-1;this.leftLeg.rotation.x=beat*(shuffle?.5:.15);this.rightLeg.rotation.x=-beat*(shuffle?.5:.15);this.root.rotation.y+=disco?Math.sin(e*3)*.2:0;}
 }
 fade(value:boolean){if(value===this.faded)return;this.faded=value;for(const mesh of this.root.getChildMeshes())mesh.visibility=value?.13:1;}
 dispose(){this.shadow.dispose();const mat=this.label.material as StandardMaterial;mat.diffuseTexture?.dispose();mat.dispose();this.root.dispose();}
}
