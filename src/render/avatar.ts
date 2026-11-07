import {wavePose} from '../../shared/camera';
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
 const c=p.avatar.cosmetics||{},a={...p.avatar,style:c.hairstyle&&c.hairstyle!=='legacy'?'crop':p.avatar.style,top:c.topStyle&&c.topStyle!=='legacy'?'tshirt':p.avatar.top};this.appearance=JSON.stringify(p.avatar);this.root=new TransformNode(`person-${p.id}`,art.scene);this.root.position.set(p.x,p.y,p.z);this.root.rotation.y=p.rotation;
 this.root.scaling.set(c.build==='slim'?.9:c.build==='broad'?1.1:1,c.height==='short'?.95:c.height==='tall'?1.05:1,1);
 const joint=(name:string,x:number,y:number,z:number,parent=this.root)=>{const n=new TransformNode(name,art.scene);n.parent=parent;n.position.set(x,y,z);return n;};
 const tapered=(name:string,parent:TransformNode,length:number,top:number,bottom:number,color:string)=>{const m=MeshBuilder.CreateCylinder(name,{height:length,diameterTop:top,diameterBottom:bottom,tessellation:6},art.scene);m.position.y=-length/2;m.parent=parent;m.material=art.mat(color);return m;};
 const bottom=a.bottom||'trousers',legColor=a.trousers;
 // Angular torso and pelvis, with a narrower waist and shaped shoulders.
 const torso=MeshBuilder.CreateCylinder('faceted shirt',{height:.58,diameterTop:.69,diameterBottom:.49,tessellation:6},art.scene);torso.parent=this.root;torso.position.y=1.14;torso.scaling.set(.9,1,.59);torso.material=art.mat(a.shirt);
 if(a.top==='polo'||a.top==='buttondown'){for(const side of[-1,1]){const collar=art.box('shirt collar',side*.09,1.43,.14,.13,.045,.13,'#e5e1d3',this.root);collar.rotation.z=side*.4;}if(a.top==='buttondown')for(let i=0;i<5;i++)art.sphere('shirt button',0,1.33-i*.085,.2,.025,'#e5e1d3',this.root);}if(a.top==='hoodie'){art.sphere('hood',0,1.42,-.14,.35,a.shirt,this.root);for(const side of[-1,1])art.box('hoodie drawstring',side*.075,1.3,.2,.018,.22,.02,'#e4e1d0',this.root);art.box('hoodie pouch',0,1.01,.19,.27,.14,.04,a.shirt,this.root);}
 const hips=art.cyl('trouser hips',0,.83,0,.45,.22,a.trousers,this.root,.49);hips.scaling.z=.68;
 if(bottom==='jeans')for(const side of[-1,1]){art.box('denim pocket',side*.13,.85,.15,.12,.13,.025,a.trousers,this.root);art.box('denim pocket stitch',side*.13,.9,.168,.1,.012,.01,'#a5ae9b',this.root);}
 art.cyl('neck',0,1.47,0,.13,.17,a.skin,this.root);
 this.head=joint('head',0,1.65,0);const face=art.sphere('angular face',0,0,.015,.36,a.skin,this.head);face.scaling.set(c.headShape==='round'?1:c.headShape==='square'?.98:.88,c.headShape==='round'?1.05:1.22,c.face==='wide'?1.04:.9);
 const jaw=art.box('jaw',0,-.1,.025,.22,.12,.23,a.skin,this.head);jaw.rotation.y=.03;if(c.face==='angular'){jaw.scaling.x=1.15;jaw.scaling.y=1.12;}if(c.headShape==='square')jaw.scaling.x=1.2;
 for(const s of[-1,1]){art.sphere('ear',s*.163,-.01,0,.075,a.skin,this.head);art.box('brow',s*.066,.045,.163,.07,c.eyebrows==='bold'?.03:c.eyebrows==='fine'?.009:.018,.017,a.hair,this.head);art.box('eye',s*.067,.01,.17,.025,.024,.013,c.eyeTint||({blue:'#557db0',green:'#50845f',gray:'#919da2',brown:'#503629'}[c.eyeColor||'brown']),this.head);}
 const nose=art.sphere('nose',0,-.025,.18,.065,a.skin,this.head);nose.scaling.set(c.nose==='wide'?.95:c.nose==='small'?.45:.6,.85,1.1);art.box('mouth',0,-.1,.155,.065,c.mouth==='full'?.025:.013,.015,c.makeup==='rose'?'#bc686f':c.makeup==='plum'?'#754563':'#8a5946',this.head);
 if(c.mouth==='smile')for(const side of[-1,1]){const corner=art.box('smile corner',side*.035,-.095,.158,.025,.012,.015,'#8a5946',this.head);corner.rotation.z=side*.55;}
 const hair=art.sphere('faceted hairstyle',0,.12,-.015,.37,a.hair,this.head);hair.scaling.set(1,c.hairstyle==='buzz'?.25:.7,1.02);
 if(a.style==='bob'){const back=art.sphere('bob hair',0,.02,-.075,.39,a.hair,this.head);back.scaling.set(1,1.03,.74);}
 if(a.style==='quiff'){const q=art.sphere('swept quiff',0,.25,.09,.26,a.hair,this.head);q.scaling.set(1.2,.8,.8);}if(a.style==='ponytail'){const q=art.sphere('ponytail',0,-.02,-.22,.2,a.hair,this.head);q.scaling.y=2;}if(a.style==='curls')for(let i=0;i<9;i++)art.sphere('curl',Math.sin(i*2.4)*.14,.17+Math.cos(i*2.4)*.06,Math.cos(i*2.4)*.13,.16,a.hair,this.head);
 if(a.style==='bun')art.sphere('hair bun',0,.25,-.07,.18,a.hair,this.head);
 if(a.accessory==='glasses'){for(const s of[-1,1]){art.box('glasses frame',s*.071,.014,.185,.128,.083,.014,'#33453b',this.head);art.box('glasses lens',s*.071,.014,.196,.093,.052,.005,'#acbcb0',this.head);}art.box('glasses bridge',0,.02,.194,.027,.018,.012,'#33453b',this.head);}
 if(a.accessory==='cap'){art.cyl('cap',0,.17,-.01,.38,.12,a.shirt,this.head);art.box('cap peak',0,.14,.17,.35,.035,.22,a.shirt,this.head);}

 if(c.highlight)for(const side of[-1,1])art.box('hair highlight',side*.08,.19,.09,.035,.025,.2,c.highlight,this.head);
 if(c.hairstyle==='sidepart'||c.hairstyle==='messy'||c.hairstyle==='mohawk')for(let i=0;i<5;i++){const tuft=art.sphere('hair tuft',c.hairstyle==='mohawk'?0:(i-2)*.06,.24+(i%2)*.025,(i-2)*.05,.13,a.hair,this.head);tuft.scaling.y=c.hairstyle==='mohawk'?1.7:1;}
 if(c.hairstyle==='long'||c.hairstyle==='braids')for(const side of[-1,1]){if(c.hairstyle==='braids')for(let i=0;i<6;i++)art.sphere('braid',side*.18,.02-i*.07,-.06,.095,a.hair,this.head);else art.box('long hair',side*.17,-.12,-.08,.1,.5,.17,a.hair,this.head);}
 if(c.facialHair&&c.facialHair!=='none'){art.box('facial hair',0,c.facialHair==='mustache'?-.065:-.145,.15,.18,c.facialHair==='beard'?.12:.035,.04,a.hair,this.head);}
 if(c.faceAccessory==='glasses'||c.faceAccessory==='sunglasses'){for(const side of[-1,1])art.box('eyewear',side*.075,.014,.197,.13,.065,.02,c.faceAccessory==='sunglasses'?'#222b30':'#9faeaa',this.head);art.box('bridge',0,.014,.2,.04,.015,.02,'#343c35',this.head);}
 if(c.faceAccessory==='mask')art.box('face mask',0,-.075,.187,.25,.13,.03,a.shirt,this.head);
 if(c.headAccessory==='cap'||c.headAccessory==='hat'){art.cyl('hat crown',0,.22,-.01,.37,.14,a.shirt,this.head);art.box('hat brim',0,.14,.12,c.headAccessory==='hat'?.52:.34,.025,.28,a.shirt,this.head);}
 if(c.headAccessory==='beanie'){const hat=art.sphere('beanie',0,.2,-.015,.39,a.shirt,this.head);hat.scaling.y=.8;}
 for(const side of[-1,1])if(c.earAccessory&&c.earAccessory!=='none'){if(c.earAccessory==='studs')art.sphere('ear stud',side*.185,-.045,.03,.035,'#d7b45e',this.head);else{const hoop=MeshBuilder.CreateTorus('ear hoop',{diameter:.07,thickness:.012,tessellation:8},art.scene);hoop.parent=this.head;hoop.position.set(side*.18,-.09,.02);hoop.rotation.x=Math.PI/2;hoop.material=art.mat('#d7b45e');}}
 if(c.piercing==='nose'||c.piercing==='eyebrow')art.sphere('piercing',.04,c.piercing==='nose'?-.025:.065,.2,.023,'#d5d6cb',this.head);
 if(c.neckAccessory&&c.neckAccessory!=='none'){art.cyl('neck chain',0,1.45,0,.17,.025,'#d7b45e',this.root);if(c.neckAccessory==='pendant')art.sphere('pendant',0,1.31,.21,.065,'#d7b45e',this.root);}
 if(c.outerwear&&c.outerwear!=='none')for(const side of[-1,1]){const lapel=art.box('jacket front',side*.17,1.15,.185,c.outerwear==='blazer'?.13:.19,.5,.06,c.outerColor||'#46546a',this.root);lapel.rotation.z=side*.1;}
 if(c.topStyle==='jersey')art.text('07',0,1.18,.215,.2,.2,'#fff9e7','',0,this.root);
 if(c.topStyle==='office')for(let i=0;i<5;i++)art.sphere('office button',0,1.34-i*.08,.21,.025,'#e5e1d3',this.root);
 if(c.topStyle==='crop')art.box('midriff',0,.92,.03,.4,.17,.27,a.skin,this.root);
 if(c.topStyle==='oversized')torso.scaling.x=1.04;
 if(c.bottomStyle==='skirt'){const skirt=art.cyl('skirt',0,.69,0,.67,.35,a.trousers,this.root,.45);skirt.scaling.z=.7;}
 if(c.bottomStyle==='joggers'){art.box('drawstring',0,.84,.17,.025,.14,.025,'#dedbd0',this.root);}
 if(c.bottomStyle==='cargo')for(const side of[-1,1])art.box('cargo pocket',side*.22,.65,.06,.1,.17,.18,a.trousers,this.root);
 this.leftArm=joint('left shoulder',-.29,1.38,0);this.rightArm=joint('right shoulder',.29,1.38,0);
 tapered('left upper sleeve',this.leftArm,.31,.18,.145,c.topStyle==='tank'?a.skin:a.shirt);tapered('right upper sleeve',this.rightArm,.31,.18,.145,c.topStyle==='tank'?a.skin:a.shirt);
 this.leftElbow=joint('left elbow',0,-.31,0,this.leftArm);this.rightElbow=joint('right elbow',0,-.31,0,this.rightArm);
 for(const arm of[this.leftElbow,this.rightElbow]){tapered('faceted forearm',arm,.29,.14,.1,a.top==='hoodie'||a.top==='buttondown'||c.topStyle==='sweater'||c.topStyle==='office'?a.shirt:a.skin);const hand=art.sphere('hand',0,-.34,.012,.135,a.skin,arm);hand.scaling.set(.75,1.2,.75);art.box('fingers',0,-.39,.012,.075,.09,.075,a.skin,arm);}
 this.leftLeg=joint('left hip',-.125,.81,0);this.rightLeg=joint('right hip',.125,.81,0);
 tapered('left thigh',this.leftLeg,.39,.235,.17,legColor);tapered('right thigh',this.rightLeg,.39,.235,.17,legColor);
 this.leftKnee=joint('left knee',0,-.39,0,this.leftLeg);this.rightKnee=joint('right knee',0,-.39,0,this.rightLeg);
 for(const leg of[this.leftKnee,this.rightKnee]){tapered('lower trouser leg',leg,.34,.17,.125,bottom==='shorts'?a.skin:legColor);art.box('shoe',0,-.37,.065,.18,.13,.31,c.shoeColor||(a.shoes==='office'?'#373632':'#dfdfd0'),leg);art.box('shoe sole',0,-.435,.065,.19,.025,.32,'#697971',leg);}

 if(c.wristAccessory&&c.wristAccessory!=='none'){art.cyl('wrist band',0,-.26,0,.14,.045,'#c6ac72',this.leftElbow);if(c.wristAccessory==='watch')art.box('watch face',0,-.26,.08,.08,.07,.025,'#293e48',this.leftElbow);}
 for(const leg of[this.leftKnee,this.rightKnee]){if(c.bottomStyle==='joggers')art.cyl('jogger cuff',0,-.31,0,.18,.07,a.trousers,leg);if(c.shoeStyle==='casual')art.box('casual shoe strap',0,-.3,.13,.16,.03,.09,'#ad9677',leg);if(c.shoeStyle==='boots')art.cyl('boot shaft',0,-.25,0,.19,.2,c.shoeColor||'#544333',leg);if(c.shoeStyle==='heels')art.box('heel',0,-.45,-.04,.05,.12,.06,c.shoeColor||'#544333',leg);if(c.shoeStyle==='sandals')art.box('sandal foot',0,-.36,.08,.16,.1,.25,a.skin,leg);}
 const tattoo=(slot:string|undefined,parent:TransformNode,y:number,z:number)=>{if(!slot||slot==='none')return;for(let i=0;i<3;i++){const mark=art.box('original tattoo '+slot,(i-1)*.025,y+i*.025,z,slot==='bands'?.09:.025,.012,.006,'#34433d',parent);mark.rotation.z=slot==='chevron'?(i%2?-.7:.7):slot==='stars'?Math.PI/4:0;}};
 if(!['hoodie','buttondown'].includes(a.top||'')&&!['sweater','office'].includes(c.topStyle||'')){tattoo(c.leftArmTattoo,this.leftElbow,-.13,.073);tattoo(c.rightArmTattoo,this.rightElbow,-.13,.073);}tattoo(c.neckTattoo,this.root,1.44,.087);if(a.bottom==='shorts')tattoo(c.legTattoo,this.leftKnee,-.15,.089);tattoo(c.faceTattoo,this.head,-.035,.176);
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
 this.headset.setEnabled(p.avatar.cosmetics?.headAccessory==='headphones'||p.avatar.accessory==='headset'||p.room==='csr'&&Boolean(p.seat));
 this.head.rotation.set(0,0,0);this.heart.setEnabled(false);
 if(!p.grounded){this.leftLeg.rotation.x=-.3;this.rightLeg.rotation.x=.18;this.leftKnee.rotation.x=.5;this.rightKnee.rotation.x=.3;this.leftArm.rotation.z=.4;this.rightArm.rotation.z=-.4;}
 if(p.seat){this.root.position.y=p.y-.31;this.leftLeg.rotation.x=this.rightLeg.rotation.x=-Math.PI/2;this.leftKnee.rotation.x=this.rightKnee.rotation.x=Math.PI/2;this.leftArm.rotation.x=this.rightArm.rotation.x=-.4;this.leftElbow.rotation.x=this.rightElbow.rotation.x=-.7;}
 if(p.bed){this.root.position.y=p.y;this.root.rotation.x=-Math.PI/2;this.leftArm.rotation.z=.18;this.rightArm.rotation.z=-.18;return;}
 const e=Math.max(0,(Date.now()-p.emoteAt)/1000);
 if(p.emote==='wave'){const pose=wavePose(e);this.rightArm.rotation.set(0,0,pose.shoulder);this.rightElbow.rotation.set(0,0,pose.elbow);}
 if(p.emote==='salute'){this.rightArm.rotation.set(-.5,0,.9);this.rightElbow.rotation.x=-1.8;}
 if(p.emote==='clap'){const clap=Math.sin(e*10)*.16;this.leftArm.rotation.set(-.9,0,-.2-clap);this.rightArm.rotation.set(-.9,0,.2+clap);this.leftElbow.rotation.x=this.rightElbow.rotation.x=-1.3;}
 if(p.emote==='kiss'){this.rightArm.rotation.x=e<.9?-1.15:-.7;this.rightElbow.rotation.x=e<.9?-1.25:-.15;this.heart.setEnabled(e>.7&&e<2.35);this.heart.position.set(.1,1.7+(e-.7)*.12,.4+Math.max(0,e-.7)*.65);this.heart.scaling.setAll(.6+Math.min(1,e)*.6);}
 if(['groove','shuffle','disco'].includes(p.emote)){const disco=p.emote==='disco',shuffle=p.emote==='shuffle',beat=Math.sin(e*(shuffle?10:6));this.root.position.y=p.y+Math.abs(beat)*.07;this.root.rotation.z=beat*.07;this.leftArm.rotation.z=.55+beat*.3;this.rightArm.rotation.z=disco?2.3:-.55-beat*.3;this.leftElbow.rotation.x=-1;this.rightElbow.rotation.x=disco?-.2:-1;this.leftLeg.rotation.x=beat*(shuffle?.5:.15);this.rightLeg.rotation.x=-beat*(shuffle?.5:.15);this.root.rotation.y+=disco?Math.sin(e*3)*.2:0;}
 }
 fade(value:boolean){if(value===this.faded)return;this.faded=value;for(const mesh of this.root.getChildMeshes())mesh.visibility=value?.13:1;}
 dispose(){this.shadow.dispose();const mat=this.label.material as StandardMaterial;mat.diffuseTexture?.dispose();mat.dispose();this.root.dispose();}
}
