import {chatZone,cleanChat} from './chat.js';
import {Elevator} from './elevator.js';
import {NpcSystem} from './npcs.js';
import {allRooms,floorBeds,floorCanStand,floorSeats,mayEnter,mayManageFloor,roomFloor,floorRoomAt,floorConfig,resolveVoice} from './building.js';
import {dartLanding} from './aim.js';
import {cleanRoomSettings,type RoomSettingsMap} from './room-settings.js';
import {newPool,newBowling,rackPins,groupOf,bowlingProgress,type PoolGame,type BowlingGame} from './sports.js';
import type {SportsPhysics} from './sports-physics.js';
import { Chess } from 'chess.js';
import { ACTIVITIES,BEDS,SEATS,EMOTES,PROTOCOL_VERSION,makePlayer,stepPlayer,jumpPlayer,groundHeight,canStand,roomAt,newLocks,newGames,newDarts,newChess,newGame,dropDisc,cleanAvatar,type Avatar,type Player,type Vec,type ChatMessage,type WorkLink,type Snapshot,type Role,type MoveInput,type Activity,newDoors,doorRect,inside,ROOMS,type EntryRequest } from './world.js';
export function dartScore(x:number,y:number){const radius=Math.hypot(x,y);if(radius>1)return 0;if(radius<.037)return 50;if(radius<.094)return 25;const sectors=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];const angle=(Math.atan2(x,-y)+Math.PI*2+Math.PI/20)%(Math.PI*2);const base=sectors[Math.floor(angle/(Math.PI/10))];return base*(radius>.94?2:radius>.57&&radius<.63?3:1);}
export class OfficeEngine {
 roomSettings:RoomSettingsMap={};inventory='';npcs=new NpcSystem();
 players=new Map<string,Player>();inputs=new Map<string,MoveInput & {at:number}>();locks=newLocks();doors=newDoors();requests=new Map<string,EntryRequest>();private requestAt=new Map<string,number>();private physics?:SportsPhysics;private physicsLoading?:Promise<SportsPhysics>;games=newGames();links:WorkLink[]=[];
 private sports(){return this.physicsLoading??=import('./sports-physics.js').then(async m=>{await m.initSports();return this.physics=new m.SportsPhysics();});}
 elevator=new Elevator(this.players);
 private rate=new Map<string,{chat:number;emote:number;dart:number}>();
 constructor(public practice=false){}
 add(id:string,userId:string,name:string,avatar:Avatar,role:Role,department:string){if(this.players.size>=50)throw new Error('The office is full. Please try again shortly.');const p=makePlayer(id,name,avatar);Object.assign(p,{userId,role,department});this.players.set(id,p);return p;}
 remove(id:string){this.elevator.state.occupants=this.elevator.state.occupants.filter(x=>x!==id);this.leaveGames(id);this.players.delete(id);this.inputs.delete(id);this.rate.delete(id);for(const k of this.requestAt.keys())if(k.startsWith(id+':'))this.requestAt.delete(k);for(const[k,r]of this.requests)if(r.visitor===id)this.requests.delete(k);this.updateDoors();for(const lock of Object.values(this.locks))if(lock.host===id){lock.host=null;lock.locked=false;}}
 input(id:string,data:unknown){if(!data||typeof data!=='object')return;const {x,z,sprint,heading}=data as MoveInput;if(!Number.isFinite(x)||!Number.isFinite(z))return;const len=Math.max(1,Math.hypot(x,z));this.inputs.set(id,{x:x/len,z:z/len,sprint:sprint===true,heading:Number.isFinite(heading)?Math.atan2(Math.sin(heading!),Math.cos(heading!)):undefined,at:Date.now()});}
 private updateDoors(){const now=Date.now();for(const[id,d]of Object.entries(this.doors)){const occupants=[...this.players.values()].filter(p=>p.room===id);if(!occupants.length){d.closed=false;d.until=0;for(const[k,r]of this.requests)if(r.room===id)this.requests.delete(k);}else if(d.until&&now>=d.until&&!this.thresholdOccupied(id)){d.closed=true;d.until=0;}}for(const[k,r]of this.requests)if(r.expires<=now||!this.players.has(r.visitor)||this.players.get(r.visitor)?.room===r.room)this.requests.delete(k);}
 private thresholdOccupied(room:string){return [...this.players.values()].some(p=>p.floor===roomFloor(room)&&inside(p,doorRect(room),.4));}
 requestsFor(id:string){const p=this.players.get(id);return p?[...this.requests.values()].filter(r=>roomFloor(r.room)===p.floor&&(r.visitor===id||mayManageFloor(p,p.floor)||p.room===r.room)).map(r=>({...r})):[];}
 private doorAction(p:Player,type:string,d:Record<string,unknown>){const room=String(d.room),door=this.doors[room],r=allRooms().find(r=>r.id===room);if(!door||!r)return;const admin=mayManageFloor(p,p.floor),occupant=p.room===room,near=inside(p,doorRect(room),2);const authorized=admin||occupant;const locked=this.locks[room]?.locked;
 if(type==='door:request'&&!occupant&&near&&door.closed&&!locked){const key=p.id+':'+room,now=Date.now();if(this.requests.has(key)||now-(this.requestAt.get(key)||0)<10000)return;this.requestAt.set(key,now);this.requests.set(key,{id:key,room,visitor:p.id,name:p.name,expires:now+30000});}
 if(!authorized)return;
 if(type==='door:close'&&(near||admin)&&!this.thresholdOccupied(room)){door.closed=true;door.until=0;}
 if(type==='door:open'&&(near||admin)&&(!locked||occupant)){door.closed=false;door.until=0;}
 if(type==='door:admit'&&!locked){const request=this.requests.get(String(d.request));if(request?.room===room&&request.expires>Date.now()){door.closed=false;door.until=Date.now()+5000;this.requests.delete(request.id);}}
 if(type==='door:dismiss'){const request=this.requests.get(String(d.request));if(request?.room===room)this.requests.delete(request.id);}
 }
 tick(dt:number,approveTransition:(p:Player,next:Vec)=>boolean=()=>true){this.physics?.tick(dt);this.updateDoors();this.elevator.tick(dt);this.npcs.tick(dt,this.doors,[...this.players.values()]);for(const p of this.players.values()){
  if(!p.inElevator&&!mayEnter(p,p.floor)){p.moving=false;continue;}
  const input=this.inputs.get(p.id),i=input&&Date.now()-input.at<300?input:{x:0,z:0};if(p.inElevator){this.elevator.move(p,i,dt);if(p.z>1.35&&i.z>0&&this.elevator.state.phase==='open'&&approveTransition(p,{...this.elevator.exitPosition(p.floor),inElevator:false} as Vec))this.elevator.action(p,'elevator:exit',null);continue;}const next={...p};stepPlayer(next,i,dt,this.locks,this.doors);
  const settings=this.roomSettings[next.room];const access=next.room===p.room||p.role!=='member'||!settings||settings.access==='team'||settings.department===p.department;
  if(this.elevator.crossing(p,next)){if(this.elevator.state.floor===p.floor&&this.elevator.state.phase==='open'&&approveTransition(p,{...next,inElevator:true} as Vec))this.elevator.action(p,'elevator:enter',null);p.moving=false;continue;}
  if(access&&approveTransition(p,next)){if(p.room!==next.room&&this.doors[p.room]?.closed){this.doors[p.room].closed=false;this.doors[p.room].until=Date.now()+5000;}Object.assign(p,next);}else{stepPlayer(p,{x:0,z:0},dt,this.locks,this.doors);p.moving=false;}
  if(p.emote&&Date.now()-p.emoteAt>(['groove','shuffle','disco'].includes(p.emote)?6500:p.emote==='kiss'?2400:3200))p.emote='';
  for(const[room,lock]of Object.entries(this.locks))if(lock.host===p.id&&p.room!==room){lock.host=null;lock.locked=false;}
  for(const a of ACTIVITIES)if(this.isPlaying(p.id,a)&&!this.near(p,a,4.2))this.leaveGame(p.id,a);
 }}
 near(p:Player,a:Activity,distance=3.1){return p.floor==='3'&&!p.inElevator&&p.room===a.room&&Math.hypot(p.x-a.position.x,p.z-a.position.z)<distance;}
 private isPlaying(id:string,a:Activity){return (a.kind==='darts'?this.games.darts[a.id].players:a.kind==='chess'?this.games.chess.players:a.kind==='pool'?this.games.pool.players:a.kind==='bowling'?this.games.bowling.players:this.games.connect4.players).includes(id);}
 private leaveGame(id:string,a:Activity){if(!this.isPlaying(id,a))return;if(a.kind==='pool'){const g=this.games.pool;this.physics?.stopPool();if(g.phase!=='finished'){g.phase='finished';g.winner=g.players.find(p=>p!==id)||null;g.message='Opponent left. Rack forfeited.';}g.players=g.players.filter(p=>p!==id);if(!g.players.length)this.games.pool=newPool();return;}if(a.kind==='bowling'){const g=this.games.bowling,index=g.players.indexOf(id);if(index===g.turn){this.physics?.stopBowling();if(g.phase==='rolling')g.phase='aim';g.pins=rackPins();}g.players.splice(index,1);if(index<g.turn)g.turn--;g.turn%=Math.max(1,g.players.length);if(!g.players.length)this.games.bowling=newBowling();return;}if(a.kind==='darts')this.games.darts[a.id]=newDarts();else if(a.kind==='chess')this.games.chess=newChess();else this.games.connect4=newGame();}
 private leaveGames(id:string){for(const a of ACTIVITIES)this.leaveGame(id,a);}
 private stand(p:Player){const bed=floorBeds(p.floor).find(b=>b.id===p.bed);const candidates:Vec[]=bed?[bed.exit]:[];
  for(const radius of [.4,.7,1,1.4,1.8,2.4,3])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8)candidates.push({x:p.x+Math.sin(angle)*radius,z:p.z+Math.cos(angle)*radius});
  const exit=candidates.find(q=>floorCanStand(q,p.floor)&&floorRoomAt(q,p.floor)===p.room&&(p.floor!=='3'||Math.abs(groundHeight(q)-groundHeight(p))<.35));if(!exit)return;
  Object.assign(p,exit,{y:p.floor==='3'?groundHeight(exit):0,vy:0,grounded:true,seat:null,bed:null,emote:'',moving:false});
 }
 action(id:string,type:string,data:unknown):ChatMessage|null{
  const p=this.players.get(id);if(!p||(!p.inElevator&&!mayEnter(p,p.floor)))return null;if(type.startsWith('elevator:')){this.elevator.action(p,type,(data as {floor?:unknown})?.floor);return null;}const d=data&&typeof data==='object'?data as Record<string,unknown>:{};
  const rate=this.rate.get(id)||{chat:0,emote:0,dart:0};this.rate.set(id,rate);
  if(type==='room:settings'&&this.practice&&mayManageFloor(p,roomFloor(String(d.room)))&&allRooms().some(r=>r.id===d.room))this.roomSettings[String(d.room)]=cleanRoomSettings(String(d.room),d.settings);
  if(type.startsWith('door:')&&roomFloor(String(d.room))===p.floor)this.doorAction(p,type,d);
  if(type==='status'&&['available','busy','away'].includes(String(d.status)))p.status=d.status as Player['status'];
  if(type==='avatar')p.avatar=cleanAvatar(d.avatar);
  if(type==='jump')jumpPlayer(p);
  if(type==='emote'&&p.grounded&&!p.seat&&!p.bed&&(['',...EMOTES] as string[]).includes(String(d.emote))&&Date.now()-rate.emote>500){p.emote=d.emote as Player['emote'];p.emoteAt=Date.now();rate.emote=Date.now();}
  if(type==='stand'||((type==='seat'||type==='bed')&&(p.seat||p.bed)))this.stand(p);
  else if(type==='seat'&&p.grounded){const s=floorSeats(p.floor).find(s=>s.id===d.id);if(s&&s.room===p.room&&Math.hypot(s.x-p.x,s.z-p.z)<2.2&&!Array.from(this.players.values()).some(q=>q.seat===s.id)){this.leaveGames(id);Object.assign(p,{seat:s.id,x:s.x,z:s.z,y:s.y,rotation:s.rotation,vy:0,grounded:true,moving:false,emote:''});}}
  else if(type==='bed'&&p.grounded){const b=floorBeds(p.floor).find(b=>b.id===d.id);if(b&&b.room===p.room&&Math.hypot(b.exit.x-p.x,b.exit.z-p.z)<1.5&&!Array.from(this.players.values()).some(q=>q.bed===b.id)){this.leaveGames(id);Object.assign(p,{bed:b.id,x:b.x,z:b.z,y:b.y,rotation:b.rotation,vy:0,grounded:true,moving:false,emote:''});}}
  if(type==='meeting'&&p.floor==='3'&&!p.inElevator){const room=String(d.room||p.room),lock=this.locks[room];if(lock){const admin=mayManageFloor(p,p.floor);if(!lock.host&&p.room===room)lock.host=id;if(admin||lock.host===id)lock.locked=d.locked===true;}}
  if(type.startsWith('game:')){
   const a=ACTIVITIES.find(a=>a.id===d.activity);if(!a||!this.near(p,a)||!p.grounded||p.bed)return null;
   if(a.kind==='pool'||a.kind==='bowling'){this.sportsAction(p,a,type,d);return null;}
   const game=a.kind==='darts'?this.games.darts[a.id]:a.kind==='chess'?this.games.chess:this.games.connect4;
   if(type==='game:join'&&!game.players.includes(id)&&game.players.length<2){this.leaveGames(id);game.players.push(id);}
   if(type==='game:leave')this.leaveGame(id,a);
   if(type==='game:reset'&&game.players.includes(id)){
    const players=[...game.players];if(a.kind==='darts')this.games.darts[a.id]={...newDarts(),players};else if(a.kind==='chess')this.games.chess={...newChess(),players};else this.games.connect4={...newGame(),players};
   }
   if(type==='game:drop'&&a.kind==='connect4'){const g=this.games.connect4,original=g.players;if(this.practice&&original[0]===id)g.players=[id,id];dropDisc(g,id,Number(d.column));g.players=original;}
   if(type==='game:chess'&&a.kind==='chess'){
    const g=this.games.chess,index=g.turn==='w'?0:1,allowed=this.practice&&g.players[0]===id||g.players.length===2&&g.players[index]===id;
    if(!g.result&&allowed&&typeof d.from==='string'&&typeof d.to==='string')try{const chess=new Chess();for(const san of g.history)chess.move(san);const m=chess.move({from:d.from,to:d.to,promotion:['q','r','b','n'].includes(String(d.promotion))?String(d.promotion):'q'});if(m){g.fen=chess.fen();g.turn=chess.turn();g.lastMove=m.san;g.history.push(m.san);if(chess.isCheckmate()){g.result='Checkmate';g.winner=id;}else if(chess.isDraw()){g.result='Draw';g.winner=null;}else if(chess.isCheck())g.lastMove+=' · check';}}catch{ /* Illegal moves leave the board unchanged. */ }
   }
   if(type==='game:dart'&&a.kind==='darts'){
    const power=d.power===undefined?.72:Number(d.power),timing=d.timing===undefined?0:Number(d.timing);if(!Number.isFinite(power)||power<.05||power>1||!Number.isFinite(timing)||Math.abs(timing)>1)return null;const landing=dartLanding(Number(d.x),Number(d.y),power,timing);const g=this.games.darts[a.id],x=landing.x,y=landing.y,allowed=this.practice&&g.players[0]===id||g.players.length===2&&g.players[g.turn]===id;
    if(allowed&&!g.winner&&Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=1.2&&Math.abs(y)<=1.2&&Date.now()-rate.dart>=350){rate.dart=Date.now();const score=dartScore(x,y);g.throws.push({x,y,score});g.throws=g.throws.slice(-3);const left=g.scores[g.turn]-score;g.darts++;
     if(left===0){g.scores[g.turn]=0;g.winner=id;}else if(left<0){g.scores[g.turn]=g.start;g.darts=3;}else g.scores[g.turn]=left;
     if(g.darts===3&&!g.winner){g.turn=g.players.length===1?0:1-g.turn;g.darts=0;g.start=g.scores[g.turn];}
    }
   }
  }
  if(type==='chat'){const zone=chatZone(p).id,text=cleanChat(d.text);if(d.zone!==zone||!text||Date.now()-rate.chat<800)return null;rate.chat=Date.now();return {zone,floor:p.floor,cabin:p.inElevator,id:crypto.randomUUID(),author:p.name,text,room:p.room,scope:d.scope==='room'?'room':'office',at:Date.now()};}
  return null;
 }
 private sportsAction(p:Player,a:Activity,type:string,d:Record<string,unknown>){const pool=a.kind==='pool',g=pool?this.games.pool:this.games.bowling;
 if(type==='game:join'&&!g.players.includes(p.id)&&g.players.length<(pool?2:4)&&(pool?g.phase!=='rolling':g.phase==='lobby')){this.leaveGames(p.id);g.players.push(p.id);if(!pool)(g as BowlingGame).rolls[p.id]=[];return;}
 if(type==='game:leave'){this.leaveGame(p.id,a);return;}
 if(!g.players.includes(p.id))return;
 const allowed=this.practice&&g.players[0]===p.id||g.players[g.turn]===p.id;
 if(type==='game:reset'&&g.phase==='finished'){
 if(pool){const game=g as PoolGame;if(!game.confirm.includes(p.id))game.confirm.push(p.id);if(this.practice||game.players.length===2&&game.confirm.length===2)this.games.pool={...newPool(),players:[...game.players]};}
 else this.games.bowling={...newBowling(),players:[...g.players],rolls:Object.fromEntries(g.players.map(id=>[id,[]]))};return;}
 if(type==='game:start'&&!pool&&g.phase==='lobby'&&g.players[0]===p.id){g.phase='aim';g.message='Aim your first roll.';return;}
 if(!allowed||g.phase!=='aim'||(!this.practice&&pool&&g.players.length!==2))return;
 if(type==='game:place'&&pool){const game=g as PoolGame,x=Number(d.x),z=Number(d.z);if(!game.inHand||!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>1.69||Math.abs(z)>.74||game.inHand==='kitchen'&&x>-.9||game.balls.some(b=>b.id>0&&b.pocket===null&&Math.hypot(b.x-x,b.z-z)<.115))return;Object.assign(game.balls.find(b=>b.id===0)!,{x,z,pocket:null});return;}
 if(type!=='game:shot')return;const angle=Number(d.angle),power=Number(d.power);if(!Number.isFinite(angle)||!Number.isFinite(power)||power<.05||power>1||Math.abs(angle)>Math.PI)return;
 if(pool){const spinX=Number(d.spinX||0),spinY=Number(d.spinY||0);if(!Number.isFinite(spinX)||!Number.isFinite(spinY)||Math.hypot(spinX,spinY)>1.001)return;const game=g as PoolGame,ball=Number(d.ball),pocket=Number(d.pocket),cue=game.balls.find(b=>b.id===0)!;if(game.inHand==='kitchen'&&cue.x>-.9||game.inHand&&game.balls.some(b=>b.id>0&&b.pocket===null&&Math.hypot(b.x-cue.x,b.z-cue.z)<.115))return;
 if(!game.break&&(!Number.isInteger(pocket)||pocket<0||pocket>5||!game.balls.some(b=>b.id===ball&&b.id>0&&b.pocket===null)||game.groups[game.turn]&&ball!==8&&groupOf(ball)!==game.groups[game.turn]))return;
 game.phase='rolling';game.message='Setting up the game…';void this.sports().then(physics=>{if(this.games.pool!==game||game.phase!=='rolling')return;physics.startPool(game,angle,power,ball,pocket,spinX,spinY);}).catch(()=>{game.phase='aim';game.message='Physics could not load. Retry or reload the page.';});
 }else{const timing=Number(d.timing||0);if(!Number.isFinite(timing)||Math.abs(timing)>1)return;const game=g as BowlingGame,x=Number(d.x),hook=Number(d.hook);if(!Number.isFinite(x)||!Number.isFinite(hook)||Math.abs(x)>.8||Math.abs(hook)>1||Math.abs(angle)>.2||bowlingProgress(game.rolls[p.id]||[]).done)return;game.phase='rolling';game.message='Setting up the game…';void this.sports().then(physics=>{if(this.games.bowling!==game||game.phase!=='rolling')return;physics.startBowling(game,x,Math.max(-.24,Math.min(.24,angle+timing*.04)),power,hook);}).catch(()=>{game.phase='aim';game.message='Physics could not load. Retry or reload the page.';});}
 }
 dispose(){this.physics?.dispose();}
 snapshotFor(id:string,s=this.snapshot()):Snapshot{const p=this.players.get(id);if(!p||(!p.inElevator&&!mayEnter(p,p.floor)))return {...s,players:[],npcs:[],doors:{},locks:{},games:newGames(),roomSettings:{},links:[],inventory:''};const visible=(q:Player)=>p.inElevator?q.inElevator:q.floor===p.floor&&!q.inElevator;return {...s,locks:p.floor==='3'&&!p.inElevator?s.locks:{},players:s.players.filter(visible),npcs:p.inElevator?[]:s.npcs.filter(n=>n.floor===p.floor),doors:p.inElevator?{}:Object.fromEntries(Object.entries(s.doors).filter(([id])=>roomFloor(id)===p.floor)),roomSettings:p.inElevator?{}:Object.fromEntries(Object.entries(s.roomSettings).filter(([id])=>roomFloor(id)===p.floor)),games:p.floor==='3'&&!p.inElevator?s.games:newGames(),links:p.approved&&mayEnter(p,'3')?s.links:[],inventory:!p.inElevator&&p.floor==='1'&&mayEnter(p,'1')?s.inventory:''};}
 lobby(p:Player){Object.assign(p,{floor:'G',...floorConfig('G').spawn,room:'G:hallway',inElevator:false,seat:null,bed:null,y:0,vy:0,grounded:true});}
 snapshot():Snapshot{return {elevator:structuredClone(this.elevator.state),npcs:structuredClone(this.npcs.states),inventory:this.inventory,roomSettings:structuredClone(this.roomSettings),protocol:PROTOCOL_VERSION,players:[...this.players.values()].map(p=>({...p,avatar:structuredClone(p.avatar)})),locks:structuredClone(this.locks),doors:structuredClone(this.doors),games:structuredClone(this.games),links:this.links.map(l=>({...l}))};}
}
