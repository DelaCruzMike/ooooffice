import R2 from '@dimforge/rapier2d-compat';
import R3 from '@dimforge/rapier3d-compat';
import { POCKETS, resolvePool, finishBowlingRoll, type PoolGame, type BowlingGame, type PoolOutcome } from './sports.js';
let initialized:Promise<void>|undefined;
export function initSports(){return initialized??=Promise.all([R2.init(),R3.init()]).then(()=>{});}
export class SportsPhysics {
 private pool?:{world:R2.World;events:R2.EventQueue;bodies:Map<number,R2.RigidBody>;ids:Map<number,number>;outcome:PoolOutcome;t:number;quiet:number;game:PoolGame};
 private bowling?:{world:R3.World;ball:R3.RigidBody;pins:Map<number,R3.RigidBody>;game:BowlingGame;t:number;hook:number;quiet:number;gutter:boolean};
 private accumulator=0;
 startPool(g:PoolGame,angle:number,power:number,calledBall:number,calledPocket:number){
 this.stopPool();const world=new R2.World({x:0,y:0}),events=new R2.EventQueue(true),bodies=new Map<number,R2.RigidBody>(),ids=new Map<number,number>();world.timestep=1/60;
 const rail=(x:number,z:number,w:number,d:number)=>{const c=world.createCollider(R2.ColliderDesc.cuboid(w/2,d/2).setTranslation(x,z).setRestitution(.82).setFriction(.05).setActiveEvents(R2.ActiveEvents.COLLISION_EVENTS));ids.set(c.handle,-1);};
 for(const z of[-.9,.9])for(const x of[-.9,.9])rail(x,z,1.54,.08);for(const x of[-1.85,1.85])rail(x,0,.08,1.4);
 for(const b of g.balls.filter(b=>b.pocket===null)){const body=world.createRigidBody(R2.RigidBodyDesc.dynamic().setTranslation(b.x,b.z).setLinearDamping(.5).setAngularDamping(1).setCcdEnabled(true));const c=world.createCollider(R2.ColliderDesc.ball(.055).setMass(1).setRestitution(.94).setFriction(.03).setActiveEvents(R2.ActiveEvents.COLLISION_EVENTS),body);bodies.set(b.id,body);ids.set(c.handle,b.id);}
 bodies.get(0)!.setLinvel({x:Math.cos(angle)*power*8,y:Math.sin(angle)*power*8},true);this.pool={world,events,bodies,ids,outcome:{first:null,rail:false,railBalls:[],pockets:[],calledBall,calledPocket,offTable:[],eightAllowed:!!g.groups[g.turn]&&!g.balls.some(b=>b.id>0&&b.id!==8&&b.pocket===null&&(b.id<8?'solids':'stripes')===g.groups[g.turn])},t:0,quiet:0,game:g};g.phase='rolling';g.message='Shot in motion.';g.shot++;
 }
 startBowling(g:BowlingGame,x:number,angle:number,power:number,hook:number){
 this.stopBowling();const world=new R3.World({x:0,y:-9.81,z:0});world.timestep=1/60;
 world.createCollider(R3.ColliderDesc.cuboid(1.35,.1,6).setTranslation(0,-.1,0).setFriction(.13).setRestitution(.08));
 for(const s of[-1,1])world.createCollider(R3.ColliderDesc.cuboid(.08,.4,5.9).setTranslation(s*1.36,.2,0).setRestitution(.15));
 const pins=new Map<number,R3.RigidBody>();for(const p of g.pins.filter(p=>!p.down)){const body=world.createRigidBody(R3.RigidBodyDesc.dynamic().setTranslation(p.x,.34,p.z).setLinearDamping(.18).setAngularDamping(.2).setCcdEnabled(true));world.createCollider(R3.ColliderDesc.cylinder(.28,.085).setMass(1.5).setFriction(.35).setRestitution(.2),body);pins.set(p.id,body);}
 const ball=world.createRigidBody(R3.RigidBodyDesc.dynamic().setTranslation(x,.22,4.1).setLinearDamping(.04).setCcdEnabled(true));world.createCollider(R3.ColliderDesc.ball(.21).setMass(6.5).setFriction(.08).setRestitution(.18),ball);const speed=5+power*6;ball.setLinvel({x:Math.sin(angle)*speed,y:0,z:-Math.cos(angle)*speed},true);ball.setAngvel({x:-speed/.21,y:hook*2,z:0},true);
 this.bowling={world,ball,pins,game:g,t:0,hook,quiet:0,gutter:false};g.phase='rolling';g.message='Ball rolling…';g.shot++;
 }
 tick(dt:number){this.accumulator=Math.min(.25,this.accumulator+dt);while(this.accumulator>=1/60){this.accumulator-=1/60;this.stepPool();this.stepBowling();}}
 private stepPool(){const s=this.pool;if(!s)return;if(s.game.phase!=='rolling'){this.stopPool();return;}s.t+=1/60;s.world.step(s.events);
 s.events.drainCollisionEvents((a,b,started)=>{if(!started)return;const x=s.ids.get(a),y=s.ids.get(b);if(x===undefined||y===undefined)return;if(x===0&&y>0&&s.outcome.first===null)s.outcome.first=y;if(y===0&&x>0&&s.outcome.first===null)s.outcome.first=x;if(x===-1||y===-1){const id=x===-1?y:x;if(id>0)s.outcome.railBalls.push(id);if(s.outcome.first!==null)s.outcome.rail=true;}});
 let moving=false;for(const b of s.game.balls){const body=s.bodies.get(b.id);if(!body||b.pocket!==null)continue;const v=body.translation();b.x=v.x;b.z=v.y;if(Math.abs(b.x)>1.98||Math.abs(b.z)>1.05){b.pocket=-1;s.outcome.offTable!.push(b.id);body.setEnabled(false);continue;}const pocket=POCKETS.findIndex(p=>Math.hypot(p.x-b.x,p.z-b.z)<.115);if(pocket>=0){b.pocket=pocket;s.outcome.pockets.push({id:b.id,pocket});body.setEnabled(false);continue;}const vel=body.linvel();if(Math.hypot(vel.x,vel.y)>.035)moving=true;}
 s.quiet=moving?0:s.quiet+1/60;if(s.t>18||s.t>.5&&s.quiet>.35){resolvePool(s.game,s.outcome);this.stopPool();}
 }
 private stepBowling(){const s=this.bowling;if(!s)return;if(s.game.phase!=='rolling'){this.stopBowling();return;}s.t+=1/60;const pre=s.ball.translation();if(Math.abs(pre.x)>1.03){s.gutter=true;s.ball.setEnabled(false);}else if(pre.z>-2.5)s.ball.applyImpulse({x:s.hook*.02,y:0,z:0},true);s.world.step();const v=s.ball.translation();s.game.ball={x:v.x,y:v.y,z:v.z};let moving=!s.gutter&&s.ball.linvel().z<-.15&&v.z>-5;
 for(const p of s.game.pins){const b=s.pins.get(p.id);if(!b)continue;const v=b.translation(),q=b.rotation();Object.assign(p,{x:v.x,y:v.y,z:v.z,qx:q.x,qy:q.y,qz:q.z,qw:q.w});const speed=b.linvel();if(s.t>1.5&&Math.hypot(speed.x,speed.y,speed.z)>.14)moving=true;}
 s.quiet=moving?0:s.quiet+1/60;if(s.t>=15||s.t>1.5&&s.quiet>.7){const down=s.game.pins.filter(p=>p.down||p.y<.22||Math.abs(p.qx*p.qx+p.qz*p.qz)*2>.25||Math.abs(p.x)>1.02||p.z< -4.2).map(p=>p.id);finishBowlingRoll(s.game,down);this.stopBowling();}
 }
 stopPool(){if(this.pool){this.pool.events.free();this.pool.world.free();this.pool=undefined;}}
 stopBowling(){if(this.bowling){this.bowling.world.free();this.bowling=undefined;}}
 dispose(){this.stopPool();this.stopBowling();}
}
