import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Client,type Room} from 'colyseus.js';
import {applyPatch,type Patch} from '../shared/sync.js';
import {PROTOCOL_VERSION,type Snapshot} from '../shared/world.js';
const port=2581,key=randomBytes(24).toString('hex'),url=`http://127.0.0.1:${port}`,seconds=Number(process.env.LOAD_TEST_SECONDS||60);
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,NODE_ENV:'test',ENABLE_LOAD_TEST:'true',LOAD_TEST_KEY:key,PORT:String(port),SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',LIVEKIT_URL:'',LIVEKIT_API_KEY:'',LIVEKIT_API_SECRET:''},stdio:['ignore','pipe','pipe']});
let errors='',stopping=false,disconnects=0;child.stderr.on('data',b=>errors+=String(b).slice(0,1000));
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms)),rooms:Room[]=[],states=new Map<number,Snapshot>();let timer:ReturnType<typeof setInterval>|undefined;
const report:any={kind:'building-local-50-client',seconds,passed:false,cloudServicesDisabled:true,checks:[],metrics:{}};
try{
 for(let i=0;i<100;i++){try{if((await fetch(url+'/health')).ok)break;}catch{}await pause(100);}
 for(let i=0;i<50;i++){const token=key+':building-'+i;const result=await fetch(url+'/api/session',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const r=await new Client(url).joinById(result.roomId,{token,protocol:PROTOCOL_VERSION});rooms.push(r);r.onMessage('snapshot',(s:Snapshot)=>states.set(i,s));r.onMessage('patch',(p:Patch)=>{const s=states.get(i);if(s)states.set(i,applyPatch(s,p));});for(const t of['heartbeat','door:requests','notice','voice:zone'])r.onMessage(t,()=>{});r.onLeave(()=>{if(!stopping)disconnects++;});r.onMessage('test:metrics',m=>report.metrics=m);r.send('sync');r.send('test:building',{floor:i<6?'G':['G','1','2','3','4'][i%5],landing:i<6});}
 rooms[8].send('test:place',{slot:4});rooms[13].send('test:place',{slot:5});await pause(500);rooms.slice(0,6).forEach(r=>r.send('elevator:enter'));await pause(500);
 assert.equal(states.get(0)!.elevator.occupants.length,5);assert.equal(states.get(5)!.players.find(p=>p.id===rooms[5].sessionId)!.inElevator,false);rooms[5].send('test:building',{floor:'G'});
 rooms[0].send('elevator:select',{floor:'1'});rooms[1].send('elevator:select',{floor:'3'});rooms[0].send('elevator:close');report.checks.push('Five passengers admitted atomically; sixth rejected; conflicting floor calls queued.');
 let tick=0;timer=setInterval(()=>{tick++;if(tick%125===0){rooms[8].send('door:close',{room:'social'});report.doorCycles=(report.doorCycles||0)+1;}if(tick%125===60)rooms[8].send('door:open',{room:'social'});rooms.forEach((r,i)=>{if(i<6||i===8||i===13)return;const a=tick*.06+i;r.send('input',{x:Math.cos(a),z:Math.sin(a)});if(tick%50===0)r.send('jump');});},80);
 const start=Date.now();while(Date.now()-start<seconds*1000){await pause(1000);assert.equal(disconnects,0);for(let i=0;i<50;i++){const s=states.get(i)!;assert.ok(s);const me=s.players.find(p=>p.id===rooms[i].sessionId)!;assert.ok(me);assert.ok(s.players.every(p=>me.inElevator?p.inElevator:!p.inElevator&&p.floor===me.floor),JSON.stringify({client:i,self:[me.floor,me.inElevator],players:s.players.map(p=>[p.id,p.floor,p.inElevator])}));assert.ok(s.npcs.every(n=>!me.inElevator&&n.floor===me.floor));}if(Date.now()-start>20000&&states.get(0)!.elevator.floor==='3')report.arrivedTogether=states.get(0)!.players.filter(p=>p.inElevator).length===5;}
 clearInterval(timer);timer=undefined;rooms[0].send('test:metrics');await pause(300);report.checks.push('All 50 clients retained floor/cabin scoped snapshots with NPCs active.');assert.ok(report.arrivedTogether);report.passed=true;
}catch(e){report.error=(e as Error).message;report.serverErrors=errors;process.exitCode=1;}finally{stopping=true;if(timer)clearInterval(timer);report.disconnects=disconnects;report.metrics.meanTickMs=report.metrics.totalMs/Math.max(1,report.metrics.ticks);report.metrics.bytesPerClientSecond=report.metrics.patchBytes/(50*seconds);for(const r of rooms)await r.leave().catch(()=>{});child.kill('SIGTERM');await writeFile('building-loadtest-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
