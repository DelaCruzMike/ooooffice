import { Chess } from 'chess.js';
import { ACTIVITIES,BEDS,SEATS,EMOTES,PROTOCOL_VERSION,makePlayer,stepPlayer,jumpPlayer,groundHeight,canStand,roomAt,newLocks,newGames,newDarts,newChess,newGame,dropDisc,cleanAvatar,type Avatar,type Player,type Vec,type ChatMessage,type WorkLink,type Snapshot,type Role,type MoveInput,type Activity } from './world.js';
export function dartScore(x:number,y:number){const radius=Math.hypot(x,y);if(radius>1)return 0;if(radius<.037)return 50;if(radius<.094)return 25;const sectors=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];const angle=(Math.atan2(x,-y)+Math.PI*2+Math.PI/20)%(Math.PI*2);const base=sectors[Math.floor(angle/(Math.PI/10))];return base*(radius>.94?2:radius>.57&&radius<.63?3:1);}
export class OfficeEngine {
 players=new Map<string,Player>();inputs=new Map<string,MoveInput & {at:number}>();locks=newLocks();games=newGames();links:WorkLink[]=[];
 private rate=new Map<string,{chat:number;emote:number;dart:number}>();
 constructor(public practice=false){}
 add(id:string,userId:string,name:string,avatar:Avatar,role:Role,department:string){if(this.players.size>=50)throw new Error('The office is full. Please try again shortly.');const p=makePlayer(id,name,avatar);Object.assign(p,{userId,role,department});this.players.set(id,p);return p;}
 remove(id:string){this.leaveGames(id);this.players.delete(id);this.inputs.delete(id);this.rate.delete(id);for(const lock of Object.values(this.locks))if(lock.host===id){lock.host=null;lock.locked=false;}}
 input(id:string,data:unknown){if(!data||typeof data!=='object')return;const {forward,turn}=data as MoveInput;if(!Number.isFinite(forward)||!Number.isFinite(turn))return;this.inputs.set(id,{forward:Math.max(-1,Math.min(1,forward)),turn:Math.max(-1,Math.min(1,turn)),at:Date.now()});}
 tick(dt:number,approveTransition:(p:Player,next:Vec)=>boolean=()=>true){for(const p of this.players.values()){
  const input=this.inputs.get(p.id),i=input&&Date.now()-input.at<300?input:{forward:0,turn:0};const next={...p};stepPlayer(next,i,dt,this.locks);
  if(approveTransition(p,next))Object.assign(p,next);else{stepPlayer(p,{forward:0,turn:0},dt,this.locks);p.moving=false;}
  if(p.emote&&Date.now()-p.emoteAt>(['groove','shuffle','disco'].includes(p.emote)?6500:p.emote==='kiss'?2400:3200))p.emote='';
  for(const[room,lock]of Object.entries(this.locks))if(lock.host===p.id&&p.room!==room){lock.host=null;lock.locked=false;}
  for(const a of ACTIVITIES)if(this.isPlaying(p.id,a)&&!this.near(p,a,4.2))this.leaveGame(p.id,a);
 }}
 near(p:Player,a:Activity,distance=3.1){return p.room===a.room&&Math.hypot(p.x-a.position.x,p.z-a.position.z)<distance;}
 private isPlaying(id:string,a:Activity){return (a.kind==='darts'?this.games.darts[a.id].players:a.kind==='chess'?this.games.chess.players:this.games.connect4.players).includes(id);}
 private leaveGame(id:string,a:Activity){if(!this.isPlaying(id,a))return;if(a.kind==='darts')this.games.darts[a.id]=newDarts();else if(a.kind==='chess')this.games.chess=newChess();else this.games.connect4=newGame();}
 private leaveGames(id:string){for(const a of ACTIVITIES)this.leaveGame(id,a);}
 private stand(p:Player){const bed=BEDS.find(b=>b.id===p.bed);const candidates:Vec[]=bed?[bed.exit]:[];
  for(const radius of [.4,.7,1,1.4,1.8,2.4,3])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8)candidates.push({x:p.x+Math.sin(angle)*radius,z:p.z+Math.cos(angle)*radius});
  const exit=candidates.find(q=>canStand(q)&&roomAt(q)===p.room&&Math.abs(groundHeight(q)-groundHeight(p))<.35);if(!exit)return;
  Object.assign(p,exit,{y:groundHeight(exit),vy:0,grounded:true,seat:null,bed:null,emote:'',moving:false});
 }
 action(id:string,type:string,data:unknown):ChatMessage|null{
  const p=this.players.get(id);if(!p)return null;const d=data&&typeof data==='object'?data as Record<string,unknown>:{};
  const rate=this.rate.get(id)||{chat:0,emote:0,dart:0};this.rate.set(id,rate);
  if(type==='status'&&['available','busy','away'].includes(String(d.status)))p.status=d.status as Player['status'];
  if(type==='avatar')p.avatar=cleanAvatar(d.avatar);
  if(type==='jump')jumpPlayer(p);
  if(type==='emote'&&p.grounded&&!p.seat&&!p.bed&&(['',...EMOTES] as string[]).includes(String(d.emote))&&Date.now()-rate.emote>500){p.emote=d.emote as Player['emote'];p.emoteAt=Date.now();rate.emote=Date.now();}
  if(type==='stand'||((type==='seat'||type==='bed')&&(p.seat||p.bed)))this.stand(p);
  else if(type==='seat'&&p.grounded){const s=SEATS.find(s=>s.id===d.id);if(s&&s.room===p.room&&Math.hypot(s.x-p.x,s.z-p.z)<2.2&&!Array.from(this.players.values()).some(q=>q.seat===s.id)){this.leaveGames(id);Object.assign(p,{seat:s.id,x:s.x,z:s.z,y:s.y,rotation:s.rotation,vy:0,grounded:true,moving:false,emote:''});}}
  else if(type==='bed'&&p.grounded){const b=BEDS.find(b=>b.id===d.id);if(b&&b.room===p.room&&Math.hypot(b.exit.x-p.x,b.exit.z-p.z)<1.5&&!Array.from(this.players.values()).some(q=>q.bed===b.id)){this.leaveGames(id);Object.assign(p,{bed:b.id,x:b.x,z:b.z,y:b.y,rotation:b.rotation,vy:0,grounded:true,moving:false,emote:''});}}
  if(type==='meeting'){const room=String(d.room||p.room),lock=this.locks[room];if(lock){const admin=p.role!=='member';if(!lock.host&&p.room===room)lock.host=id;if(admin||lock.host===id)lock.locked=d.locked===true;}}
  if(type.startsWith('game:')){
   const a=ACTIVITIES.find(a=>a.id===d.activity);if(!a||!this.near(p,a)||!p.grounded||p.bed)return null;
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
    const g=this.games.darts[a.id],x=Number(d.x),y=Number(d.y),allowed=this.practice&&g.players[0]===id||g.players.length===2&&g.players[g.turn]===id;
    if(allowed&&!g.winner&&Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=1.2&&Math.abs(y)<=1.2&&Date.now()-rate.dart>=350){rate.dart=Date.now();const score=dartScore(x,y);g.throws.push({x,y,score});g.throws=g.throws.slice(-3);const left=g.scores[g.turn]-score;g.darts++;
     if(left===0){g.scores[g.turn]=0;g.winner=id;}else if(left<0){g.scores[g.turn]=g.start;g.darts=3;}else g.scores[g.turn]=left;
     if(g.darts===3&&!g.winner){g.turn=g.players.length===1?0:1-g.turn;g.darts=0;g.start=g.scores[g.turn];}
    }
   }
  }
  if(type==='chat'){const text=typeof d.text==='string'?d.text.trim().slice(0,500):'';if(!text||Date.now()-rate.chat<800)return null;rate.chat=Date.now();return {id:crypto.randomUUID(),author:p.name,text,room:p.room,scope:d.scope==='room'?'room':'office',at:Date.now()};}
  return null;
 }
 snapshot():Snapshot{return {protocol:PROTOCOL_VERSION,players:[...this.players.values()].map(p=>({...p,avatar:{...p.avatar}})),locks:structuredClone(this.locks),games:structuredClone(this.games),links:this.links.map(l=>({...l}))};}
}
