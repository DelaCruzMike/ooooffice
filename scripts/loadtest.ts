import { applyPatch, type Patch } from '../shared/sync.js';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Client, type Room } from 'colyseus.js';
import { canStand, PROTOCOL_VERSION, type Snapshot } from '../shared/world.js';
const seconds=Number(process.env.LOAD_TEST_SECONDS||3600);
if(!Number.isFinite(seconds)||seconds<10||seconds>7200)throw new Error('Choose LOAD_TEST_SECONDS between 10 and 7200. Default is a 60-minute soak.');
const port=Number(process.env.LOAD_TEST_PORT||2579), url=`http://127.0.0.1:${port}`, key=randomBytes(24).toString('hex');
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',ENABLE_LOAD_TEST:'true',LOAD_TEST_KEY:key,PORT:String(port),SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',LIVEKIT_URL:'',LIVEKIT_API_KEY:'',LIVEKIT_API_SECRET:''},stdio:['ignore','pipe','pipe']});
let failure='',stopping=false;child.stderr.on('data',b=>{failure+=b.toString().slice(0,2000);});child.on('exit',code=>{if(!stopping)failure=`Server exited with code ${code}. ${failure}`;});
const rooms:Room[]=[],latest=new Map<number,Snapshot>(),patches=new Map<number,number>(),lastAt=new Map<number,number>();let inputTimer:ReturnType<typeof setInterval>|undefined;
let inputTick=0;
const report:{kind:string;connections:number;durationSeconds:number;passed:boolean;snapshots:number;checks:string[];error?:string}={kind:'local-multiplayer-soak',connections:50,durationSeconds:seconds,passed:false,snapshots:0,checks:[]};
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function request(token:string){const r=await fetch(`${url}/api/session`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error(`Matchmaking returned ${r.status}`);return r.json();}
async function connect(i:number){const token=`${key}:pilot-${i}`,{roomId}=await request(token);const room=await new Client(url).joinById(roomId,{token,protocol:PROTOCOL_VERSION});room.onMessage('snapshot',(s:Snapshot)=>{latest.set(i,s);patches.set(i,(patches.get(i)||0)+1);lastAt.set(i,Date.now());});room.onMessage('patch',(p:Patch)=>{const s=latest.get(i);if(s){latest.set(i,applyPatch(s,p));patches.set(i,(patches.get(i)||0)+1);lastAt.set(i,Date.now());}});room.onMessage('heartbeat',()=>lastAt.set(i,Date.now()));room.send('sync');room.onMessage('notice',()=>{});room.onMessage('removed',()=>{});room.onLeave(()=>{if(!stopping)failure=`Client ${i} unexpectedly disconnected`;});room.onError((code,msg)=>{failure=`Client ${i}: ${code} ${msg}`;});rooms.push(room);if(rooms.length%10===0)console.log(`${rooms.length}/50 clients joined.`);return room;}
try{
  let ready=false;for(let i=0;i<100;i++){if(failure)throw new Error(failure);try{const h=await fetch(`${url}/health`);if(h.ok){ready=true;break;}}catch{}await pause(100);}if(!ready)throw new Error('Test server did not become ready.');
  const denied=await fetch(`${url}/api/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(denied.status!==401)throw new Error('Unauthenticated matchmaking was not rejected.');report.checks.push('Unauthenticated matchmaking rejected.');
  for(let i=0;i<50;i++)await connect(i);
  // The room is explicitly joined by ID, preventing accidental creation of a second office.
  const extra=await request(`${key}:extra`);let rejected=false;try{await new Client(url).joinById(extra.roomId,{token:`${key}:extra`,protocol:PROTOCOL_VERSION});}catch{rejected=true;}if(!rejected)throw new Error('The 51st client was admitted.');report.checks.push('50 admitted; the 51st connection rejected.');
  await pause(300);
  inputTimer=setInterval(()=>{inputTick++;rooms.forEach((room,i)=>{const phase=Date.now()/2500+i;room.send('input',{forward:Math.cos(phase),turn:Math.sin(phase)});if(inputTick%30===0)room.send('jump');});},75);
  const start=Date.now();let progress=0;
  while(Date.now()-start<seconds*1000){
    await pause(1000);if(failure)throw new Error(failure);
    for(let i=0;i<50;i++){const s=latest.get(i);if(!s||s.players.length!==50)throw new Error(`Client ${i} has divergent player count.`);if(Date.now()-(lastAt.get(i)||0)>3000)throw new Error(`Client ${i} stopped receiving snapshots.`);for(const p of s.players)if((!p.seat&&!p.bed&&!canStand(p,.265))||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isFinite(p.y)||p.y<-.02||p.y>1.36)throw new Error('Invalid or colliding server position.');}
    const elapsed=Math.floor((Date.now()-start)/1000);if(elapsed-progress>=30){progress=elapsed;console.log(`${elapsed}/${seconds}s: 50 clients connected, snapshots current, positions valid.`);}
  }
  if(inputTimer){clearInterval(inputTimer);inputTimer=undefined;}
  await pause(1200);
  const signature=(s:Snapshot)=>JSON.stringify(s.players.map(p=>[p.id,p.room,p.seat,p.status,p.grounded,Math.round(p.y*100),Math.round(p.x*100),Math.round(p.z*100)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  const expected=signature(latest.get(0)!);for(let i=1;i<50;i++)if(signature(latest.get(i)!)!==expected)throw new Error('Clients did not converge after movement stopped.');
  report.checks.push('All clients converged after movement stopped.','All clients received current snapshots containing the same 50 identities.','All authoritative positions stayed finite, in bounds, and outside walls/furniture within 1.5cm network quantization tolerance.','Jump height and grounded state stayed valid and converged after landing.','No unplanned client disconnections or server exits.');
  report.passed=true;report.snapshots=[...patches.values()].reduce((a,b)=>a+b,0);
}catch(e){report.error=(e as Error).message;process.exitCode=1;}
finally{stopping=true;if(inputTimer)clearInterval(inputTimer);await Promise.allSettled(rooms.map(r=>r.leave()));child.kill('SIGTERM');await writeFile('loadtest-report.json',JSON.stringify({...report,completedAt:new Date().toISOString(),voiceTested:false,realMobileHardwareTested:false},null,2)+'\n');console.log(JSON.stringify(report,null,2));}
