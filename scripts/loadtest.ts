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
let inputTick=0;const runStarted=Date.now();
const report:{kind:string;connections:number;durationSeconds:number;passed:boolean;snapshots:number;checks:string[];error?:string}={kind:'local-multiplayer-soak',connections:50,durationSeconds:seconds,passed:false,snapshots:0,checks:[]};
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function request(token:string){const r=await fetch(`${url}/api/session`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error(`Matchmaking returned ${r.status}`);return r.json();}
async function connect(i:number){const token=`${key}:pilot-${i}`,{roomId}=await request(token);const room=await new Client(url).joinById(roomId,{token,protocol:PROTOCOL_VERSION});room.onMessage('snapshot',(s:Snapshot)=>{latest.set(i,s);patches.set(i,(patches.get(i)||0)+1);lastAt.set(i,Date.now());});room.onMessage('patch',(p:Patch)=>{const s=latest.get(i);if(s){latest.set(i,applyPatch(s,p));patches.set(i,(patches.get(i)||0)+1);lastAt.set(i,Date.now());}});room.onMessage('heartbeat',()=>lastAt.set(i,Date.now()));room.send('sync');room.onMessage('door:requests',()=>{});room.onMessage('notice',()=>{});room.onMessage('removed',()=>{});room.onLeave(()=>{if(!stopping)failure=`Client ${i} unexpectedly disconnected`;});room.onError((code,msg)=>{failure=`Client ${i}: ${code} ${msg}`;});rooms.push(room);if(rooms.length%10===0)console.log(`${rooms.length}/50 clients joined.`);return room;}
try{
  let ready=false;for(let i=0;i<100;i++){if(failure)throw new Error(failure);try{const h=await fetch(`${url}/health`);if(h.ok){ready=true;break;}}catch{}await pause(100);}if(!ready)throw new Error('Test server did not become ready.');
  const denied=await fetch(`${url}/api/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(denied.status!==401)throw new Error('Unauthenticated matchmaking was not rejected.');report.checks.push('Unauthenticated matchmaking rejected.');
  const initial=await request(`${key}:admission-probe`);
  for(const method of['create','joinOrCreate','join']){const r=await fetch(`${url}/matchmake/${method}/office`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:`${key}:admission-probe`,protocol:PROTOCOL_VERSION})});if(r.status!==403)throw new Error('An extra-office matchmaking route was exposed.');}
  const anonymous=await fetch(`${url}/matchmake/joinById/${initial.roomId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({protocol:PROTOCOL_VERSION})}).then(r=>r.json());if(anonymous.sessionId||!anonymous.error)throw new Error('Anonymous client obtained a seat reservation.');report.checks.push('Anonymous direct seat reservations rejected before consuming capacity.');
  const large=await fetch(`${url}/matchmake/joinById/${initial.roomId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({padding:'x'.repeat(17000)})});if(large.status!==413)throw new Error('Oversized admission accepted.');
  const same=await request(`${key}:admission-probe`);if(initial.roomId!==same.roomId)throw new Error('Direct matchmaking replaced the active office.');report.checks.push('Direct creation/joinOrCreate routes rejected without replacing the single office.');
  for(let i=0;i<50;i++)await connect(i);
  // The room is explicitly joined by ID, preventing accidental creation of a second office.
  const extra=await request(`${key}:extra`);let rejected=false;try{await new Client(url).joinById(extra.roomId,{token:`${key}:extra`,protocol:PROTOCOL_VERSION});}catch{rejected=true;}if(!rejected)throw new Error('The 51st client was admitted.');report.checks.push('50 admitted; the 51st connection rejected.');
  rooms.slice(0,6).forEach((r,i)=>r.send('test:place',{slot:i}));await pause(300);
  rooms[0].send('game:join',{activity:'pool-commons'});rooms[1].send('game:join',{activity:'pool-commons'});rooms[2].send('game:join',{activity:'bowling-commons'});rooms[3].send('game:join',{activity:'bowling-commons'});await pause(300);rooms[2].send('game:start',{activity:'bowling-commons'});
  inputTimer=setInterval(()=>{inputTick++;rooms.forEach((room,i)=>{if(i<6)return;const phase=Date.now()/2500+i;room.send('input',{x:Math.cos(phase),z:Math.sin(phase),sprint:i%2===0});if(inputTick%30===0)room.send('jump');});},75);
  const start=Date.now();let progress=0,poolShots=0,bowlingShots=0,doorCycles=0;let lastDoor=0,previousPoll=Date.now();
  while(Date.now()-start<seconds*1000){
    await pause(1000);const gap=Date.now()-previousPoll;previousPoll=Date.now();if(gap>10000)throw new Error(`Test host paused for ${Math.round(gap/1000)} seconds; continuous-capacity run is inconclusive.`);if(failure)throw new Error(failure);
    for(let i=0;i<50;i++){const s=latest.get(i);if(!s||s.players.length!==50)throw new Error(`Client ${i} has divergent player count.`);if(Date.now()-(lastAt.get(i)||0)>3000)throw new Error(`Client ${i} stopped receiving snapshots.`);for(const p of s.players)if((!p.seat&&!p.bed&&!canStand(p,.265))||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isFinite(p.y)||p.y<-.02||p.y>1.36)throw new Error('Invalid or colliding server position.');}
    const state=latest.get(0)!;const pool=state.games.pool,bowling=state.games.bowling;
    if(pool.phase==='aim'&&pool.players.length===2){const i=rooms.findIndex(r=>r.sessionId===pool.players[pool.turn]);if(i>=0){const ball=pool.balls.find(b=>b.id>0&&b.pocket===null&&(b.id===8||!pool.groups[pool.turn]||(b.id<8?'solids':'stripes')===pool.groups[pool.turn]))?.id||8;rooms[i].send('game:shot',{activity:'pool-commons',angle:Math.sin(poolShots++)*.8,power:.75,ball,pocket:2});}}
    if(pool.phase==='finished'){rooms[0].send('game:reset',{activity:'pool-commons'});rooms[1].send('game:reset',{activity:'pool-commons'});}
    if(bowling.phase==='aim'){const i=rooms.findIndex(r=>r.sessionId===bowling.players[bowling.turn]);if(i>=0)rooms[i].send('game:shot',{activity:'bowling-commons',angle:0,power:.8,x:Math.sin(bowlingShots++)*.2,hook:0});}
    if(bowling.phase==='finished'){rooms[2].send('game:reset',{activity:'bowling-commons'});await pause(80);rooms[2].send('game:start',{activity:'bowling-commons'});}
    if(Date.now()-lastDoor>12000){lastDoor=Date.now();rooms[4].send('door:close',{room:'social'});await pause(80);rooms[5].send('door:request',{room:'social'});await pause(80);rooms[4].send('door:admit',{room:'social',request:rooms[5].sessionId+':social'});doorCycles++;}
    const elapsed=Math.floor((Date.now()-start)/1000);if(elapsed-progress>=30){progress=elapsed;console.log(`${elapsed}/${seconds}s: 50 clients connected, snapshots current, positions valid.`);}
  }
  if(inputTimer){clearInterval(inputTimer);inputTimer=undefined;}
  await pause(20000);
  const signature=(s:Snapshot)=>JSON.stringify({players:s.players.map(p=>[p.id,p.room,p.seat,p.status,p.grounded,Math.round(p.y*100),Math.round(p.x*100),Math.round(p.z*100)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),doors:s.doors,locks:s.locks,games:s.games});
  const expected=signature(latest.get(0)!);for(let i=1;i<50;i++)if(signature(latest.get(i)!)!==expected)throw new Error('Clients did not converge after movement stopped.');
  report.checks.push('All clients converged on players, doors, locks, and game state after movement and physics settled.','All clients received current snapshots containing the same 50 identities.','All authoritative positions stayed finite, in bounds, and outside walls/furniture within 1.5cm network quantization tolerance.','Jump height and grounded state stayed valid and converged after landing.','No unplanned client disconnections or server exits.');
  report.checks.push(`Physics shots submitted: pool ${poolShots}, bowling ${bowlingShots}; door request/admission cycles: ${doorCycles}.`);if(poolShots<1||bowlingShots<1||doorCycles<1)throw new Error('Game or door scenarios did not execute.');report.passed=true;report.snapshots=[...patches.values()].reduce((a,b)=>a+b,0);
}catch(e){report.error=(e as Error).message;process.exitCode=1;}
finally{stopping=true;if(inputTimer)clearInterval(inputTimer);await Promise.allSettled(rooms.map(r=>r.leave()));child.kill('SIGTERM');await writeFile(process.env.LOAD_TEST_REPORT||'loadtest-report.json',JSON.stringify({...report,completedAt:new Date().toISOString(),totalRunSeconds:Math.round((Date.now()-runStarted)/1000),snapshots:[...patches.values()].reduce((a,b)=>a+b,0),voiceTested:false,realMobileHardwareTested:false},null,2)+'\n');console.log(JSON.stringify(report,null,2));}
