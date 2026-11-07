import {useEffect,useRef} from 'react';
import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color4} from '@babylonjs/core/Maths/math.color';
import {OfficeArt} from './render/art';
import {AvatarRig} from './render/avatar';
import {makePlayer,type Avatar} from '../shared/world';
export default function AvatarPreview({avatar}:{avatar:Avatar}){const canvas=useRef<HTMLCanvasElement>(null),appearance=useRef(avatar);appearance.current=avatar;
 useEffect(()=>{if(!canvas.current)return;const engine=new Engine(canvas.current,true),scene=new Scene(engine);scene.clearColor=new Color4(.9,.91,.86,1);const camera=new ArcRotateCamera('wardrobe camera',Math.PI/2,Math.PI/2.2,3.4,new Vector3(0,1,0),scene);camera.lowerRadiusLimit=2.6;camera.upperRadiusLimit=4;camera.attachControl(canvas.current,true);new HemisphericLight('wardrobe light',new Vector3(.3,1,.4),scene);const art=new OfficeArt(scene);let p=makePlayer('wardrobe','You',appearance.current);p.x=0;p.z=0;p.rotation=0;let rig=new AvatarRig(art,p,p.id);engine.runRenderLoop(()=>{if(JSON.stringify(appearance.current)!==rig.appearance){rig.dispose();p.avatar=appearance.current;rig=new AvatarRig(art,p,p.id);}rig.update(p,0,.05,p.id,p,0);scene.render();});const resize=()=>engine.resize();window.addEventListener('resize',resize);return()=>{window.removeEventListener('resize',resize);rig.dispose();scene.dispose();engine.dispose();};},[]);
 return <div className="wardrobe-preview"><canvas ref={canvas} aria-label="Live 3D character preview. Drag to rotate."/><span>Drag to rotate your character</span></div>;
}
