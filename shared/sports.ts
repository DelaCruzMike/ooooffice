// Serializable game state and rules. Physics lives in the lazily loaded sports-physics module.
export type Ball={id:number;x:number;z:number;pocket:number|null};
export type PoolGame={players:string[];turn:number;phase:'aim'|'rolling'|'finished';balls:Ball[];groups:('solids'|'stripes'|null)[];break:boolean;inHand:'table'|'kitchen'|null;winner:string|null;message:string;confirm:string[];shot:number};
export const groupOf=(id:number)=>id<8?'solids':'stripes';
export const POCKETS=[{x:-1.8,z:-.85},{x:0,z:-.85},{x:1.8,z:-.85},{x:-1.8,z:.85},{x:0,z:.85},{x:1.8,z:.85}];
export function rackBalls():Ball[]{const balls:Ball[]=[{id:0,x:-1.05,z:0,pocket:null}];const order=[1,9,2,10,8,3,11,4,12,5,6,13,7,14,15];let i=0;for(let row=0;row<5;row++)for(let c=0;c<=row;c++)balls.push({id:order[i++],x:.55+row*.098,z:(c-row/2)*.113,pocket:null});return balls;}
export const newPool=():PoolGame=>({players:[],turn:0,phase:'aim',balls:rackBalls(),groups:[null,null],break:true,inHand:'kitchen',winner:null,message:'Break from behind the head string.',confirm:[],shot:0});
export type PoolOutcome={first:number|null;rail:boolean;railBalls:number[];pockets:{id:number;pocket:number}[];calledBall:number;calledPocket:number;eightAllowed?:boolean;offTable?:number[]};
export function resolvePool(g:PoolGame,o:PoolOutcome){
 const shooter=g.turn,other=1-shooter,own=g.groups[shooter],remaining=g.balls.some(b=>b.id!==0&&b.id!==8&&b.pocket===null&&groupOf(b.id)===own),eightAllowed=o.eightAllowed??(!!own&&!remaining);
 const scratched=Boolean(o.offTable?.includes(0))||o.pockets.some(b=>b.id===0),eight=o.pockets.find(b=>b.id===8)||(o.offTable?.includes(8)?{id:8,pocket:-1}:undefined),called=o.pockets.some(b=>b.id===o.calledBall&&b.pocket===o.calledPocket);
 let foul=Boolean(o.offTable?.length)||scratched||o.first===null||(!g.break&&((own&&o.first!==8&&groupOf(o.first!)!==own)||(o.first===8&&!eightAllowed)))||(!o.pockets.length&&!o.rail);
 if(g.break&&!o.pockets.some(b=>b.id!==0)&&new Set(o.railBalls.filter(id=>id>0)).size<4)foul=true;
 if(eight&&!g.break){const legal=eightAllowed&&!foul&&o.calledBall===8&&eight.pocket===o.calledPocket;g.winner=g.players[legal?shooter:other]||`side-${legal?shooter:other}`;g.phase='finished';g.message=legal?'Eight ball pocketed legally. Rack won.':'Early eight, wrong pocket, or foul on the eight. Rack lost.';return;}
 if(g.break&&eight){const b=g.balls.find(b=>b.id===8)!;b.pocket=null;b.x=.55;b.z=0;for(let n=0;n<30&&g.balls.some(q=>q!==b&&q.pocket===null&&Math.hypot(q.x-b.x,q.z-b.z)<.115);n++)b.x-=.115;}
 if(!g.break&&!own&&!foul&&called&&o.calledBall!==8){g.groups[shooter]=groupOf(o.calledBall);g.groups[other]=g.groups[shooter]==='solids'?'stripes':'solids';}
 const keep=!foul&&(g.break?o.pockets.some(b=>b.id!==0&&b.id!==8):called&&groupOf(o.calledBall)===g.groups[shooter]);
 const wasBreak=g.break;g.break=false;g.phase='aim';if(!keep)g.turn=other;g.inHand=foul?(wasBreak?'kitchen':'table'):null;
 const cue=g.balls.find(b=>b.id===0)!;if(scratched){cue.pocket=null;cue.x=-1.05;cue.z=0;}
 g.message=foul?'Foul — opponent has ball in hand.':keep?'Legal pocket — shoot again.':'Next player to shoot.';
}
export type Pin={id:number;x:number;y:number;z:number;qx:number;qy:number;qz:number;qw:number;down:boolean};
export type BowlingGame={players:string[];turn:number;phase:'lobby'|'aim'|'rolling'|'finished';rolls:Record<string,number[]>;pins:Pin[];ball:{x:number;y:number;z:number};message:string;shot:number;winner:string[]};
export const rackPins=():Pin[]=>{const p:Pin[]=[];let id=0;for(let row=0;row<4;row++)for(let c=0;c<=row;c++)p.push({id:id++,x:(c-row/2)*.29,y:.36,z:-2.7-row*.29,qx:0,qy:0,qz:0,qw:1,down:false});return p;};
export const newBowling=():BowlingGame=>({players:[],turn:0,phase:'lobby',rolls:{},pins:rackPins(),ball:{x:0,y:.24,z:4.1},message:'Join, then start a ten-frame game.',shot:0,winner:[]});
export function bowlingFrames(rolls:number[]){const frames:{rolls:number[];score:number|null;total:number|null}[]=[];let at=0,total=0,known=true;for(let f=0;f<10;f++){
 const a=rolls[at];if(a===undefined){frames.push({rolls:[],score:null,total:null});continue;}let used:number,need:number,score:number|null=null;
 if(f===9){used=a===10||a+(rolls[at+1]??0)===10?3:2;need=used;if(rolls.length>=at+need)score=rolls.slice(at,at+need).reduce((a,b)=>a+b,0);}else{used=a===10?1:2;need=a===10?3:a+(rolls[at+1]??0)===10?3:2;if(rolls.length>=at+need)score=rolls.slice(at,at+need).reduce((a,b)=>a+b,0);}
 const r=rolls.slice(at,at+used);if(score===null)known=false;else total+=score;frames.push({rolls:r,score,total:known?total:null});at+=used;
 }return frames;}
export function bowlingProgress(rolls:number[]){let at=0;for(let f=0;f<9;f++){if(rolls[at]===undefined)return {frame:f,done:false,newRack:true};if(rolls[at]===10){at++;continue;}if(rolls[at+1]===undefined)return {frame:f,done:false,newRack:false};at+=2;}
 const r=rolls.slice(at);const done=r.length>=2&&r[0]!==10&&r[0]+r[1]<10||r.length>=3;
 return {frame:9,done,newRack:r.length===0||r.length===1&&r[0]===10||r.length===2&&(r[0]!==10&&r[0]+r[1]===10||r[0]===10&&r[1]===10)};}
export function finishBowlingRoll(g:BowlingGame,down:number[]){const id=g.players[g.turn];if(!id)return;const before=bowlingProgress(g.rolls[id]||[]),fresh=down.filter(id=>!g.pins.find(p=>p.id===id)?.down);g.rolls[id]??=[];g.rolls[id].push(fresh.length);g.pins.forEach(p=>{if(down.includes(p.id))p.down=true;});const after=bowlingProgress(g.rolls[id]);
 const frameEnded=after.done||after.frame!==before.frame;
 if(g.players.every(id=>bowlingProgress(g.rolls[id]||[]).done)){g.phase='finished';const scores=g.players.map(id=>bowlingFrames(g.rolls[id]).at(-1)!.total||0),max=Math.max(...scores);g.winner=g.players.filter((_,i)=>scores[i]===max);g.message=`Game complete. Top score: ${max}.`;return;}
 if(frameEnded){for(let n=1;n<=g.players.length;n++){const next=(g.turn+n)%g.players.length;if(!bowlingProgress(g.rolls[g.players[next]]||[]).done){g.turn=next;break;}}g.pins=rackPins();}else if(after.newRack)g.pins=rackPins();
 g.phase='aim';g.message=`${fresh.length} pin${fresh.length===1?'':'s'} down.`;g.ball={x:0,y:.24,z:4.1};
}
