import test from 'node:test';
import assert from 'node:assert/strict';
import { OfficeEngine } from '../server/engine.js';
import { DEFAULT_AVATAR, ROOMS, SEATS, SPAWN, WALLS, canStand, move, roomAt, newGame, dropDisc, cleanAvatar } from '../shared/world.js';
import { validateLinks, authenticate } from '../server/services.js';
const engine = () => { const e = new OfficeEngine(); e.add('a','user-a','Alex',DEFAULT_AVATAR,'owner','Team'); e.add('b','user-b','Sam',DEFAULT_AVATAR,'member','Team'); return e; };
test('one floor contains the 11 requested spaces plus commons, 50 workstations and 50 meeting seats',()=>{
  assert.equal(ROOMS.length,12); assert.equal(SEATS.filter(s=>s.kind==='desk').length,50); assert.equal(SEATS.filter(s=>s.kind==='meeting').length,50);
  for(const s of SEATS) assert.ok(canStand(s),`seat ${s.id} is reachable without overlapping a wall or table`);
});
test('every room and seat is reachable from the commons through the collision map',()=>{
  // Flood-fill half-meter cells using the same collision rules as clients and server.
  const step=.5, key=(x:number,z:number)=>`${x},${z}`; const start={x:SPAWN.x,z:SPAWN.z}; const seen=new Set([key(start.x,start.z)]),queue=[start];
  for(let i=0;i<queue.length;i++)for(const [dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]]){
    const q={x:queue[i].x+dx,z:queue[i].z+dz};if(!seen.has(key(q.x,q.z))&&canStand(q)){seen.add(key(q.x,q.z));queue.push(q);}
  }
  for(const r of ROOMS) assert.ok(queue.some(p=>roomAt(p)===r.id),`${r.name} has a walkable doorway`);
  for(const s of SEATS) assert.ok(queue.some(p=>Math.hypot(p.x-s.x,p.z-s.z)<.7),`${s.id} is reachable`);
});
test('movement clamps time, normalizes diagonals, rejects invalid inputs, and cannot tunnel through walls',()=>{
  const e=engine(); const p=e.players.get('a')!;
  e.input('a',{x:NaN,z:0}); assert.equal(e.inputs.size,0); e.input('a',{x:999,z:999});e.tick(.05);assert.ok(Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)<=.276);
  const r=ROOMS[0]; let q={x:r.x+4,z:r.z+r.d/2+1};for(let i=0;i<100;i++)q=move(q,{x:0,z:-1},1);assert.ok(q.z>r.z+r.d/2);
  const w=WALLS[0];assert.equal(canStand(w),false);
});
test('seat claims are exclusive, proximity checked, and released on disconnect',()=>{
  const e=engine(),s=SEATS[0];e.action('a','seat',{id:s.id});assert.equal(e.players.get('a')!.seat,null);
  Object.assign(e.players.get('a')!,s,{id:'a',room:s.room});Object.assign(e.players.get('b')!,s,{id:'b',room:s.room});
  e.action('a','seat',{id:s.id});e.action('b','seat',{id:s.id});assert.equal(e.players.get('a')!.seat,s.id);assert.equal(e.players.get('b')!.seat,null);
  e.remove('a');e.action('b','seat',{id:s.id});assert.equal(e.players.get('b')!.seat,s.id);
});
test('meeting host locks, unauthorized members cannot unlock, and host departure clears lock',()=>{
  const e=engine();const p=e.players.get('a')!;p.room='meeting';e.action('a','meeting',{locked:true});assert.equal(e.locked,true);
  e.action('b','meeting',{locked:false});assert.equal(e.locked,true);
  let q={x:31,z:12};for(let i=0;i<10;i++)q=move(q,{x:0,z:1},.1,e.locked);assert.notEqual(roomAt(q),'meeting');
  e.remove('a');assert.equal(e.locked,false);assert.equal(e.host,null);
});
test('office capacity is 50, snapshots cannot mutate player coordinates or appearance',()=>{
  const e=engine();for(let i=2;i<50;i++)e.add(String(i),String(i),'Pilot',DEFAULT_AVATAR,'member','Test');assert.throws(()=>e.add('51','51','Pilot',DEFAULT_AVATAR,'member','Test'));
  const s=e.snapshot();s.players[0].x=999;s.players[0].avatar.shirt='#ffffff';assert.notEqual(e.players.get('a')!.x,999);assert.notEqual(e.players.get('a')!.avatar.shirt,'#ffffff');
});
test('chat is bounded, rate limited, scoped, and has no saved history in snapshots',()=>{
  const e=engine();const m=e.action('a','chat',{text:' hello ',scope:'room'});assert.equal(m?.text,'hello');assert.equal(m?.scope,'room');assert.equal(e.action('a','chat',{text:'spam'}),null);assert.equal('messages' in e.snapshot(),false);
});
test('Connect Four enforces turn order, columns, gravity, wins, and completed-game rejection',()=>{
  const g=newGame();g.players=['a','b'];assert.equal(dropDisc(g,'b',0),false);assert.equal(dropDisc(g,'a',1.5),false);
  for(let i=0;i<3;i++){assert.ok(dropDisc(g,'a',0));assert.ok(dropDisc(g,'b',1));}assert.ok(dropDisc(g,'a',0));assert.equal(g.winner,1);assert.equal(dropDisc(g,'b',2),false);
  const h=newGame();h.players=['a','b'];for(let i=0;i<6;i++)assert.ok(dropDisc(h,i%2?'b':'a',3));assert.equal(dropDisc(h,'a',3),false);
});
test('Connect Four rejects spectators and resets when a player leaves',()=>{
  const e=engine();e.action('a','game:join',{});assert.equal(e.game.players.length,0);
  for(const p of e.players.values())Object.assign(p,{room:'recreation',x:14,z:3});e.action('a','game:join',{});e.action('b','game:join',{});assert.equal(e.game.players.length,2);e.remove('a');assert.equal(e.game.players.length,0);
});
test('avatar and work links are sanitized; executable or credential-bearing links are rejected',()=>{
  assert.equal(cleanAvatar({skin:'red',style:'<script>'}).skin,DEFAULT_AVATAR.skin);
  assert.throws(()=>validateLinks([{label:'bad',url:'javascript:alert(1)'}]));assert.throws(()=>validateLinks([{label:'bad',url:'https://name:password@example.com'}]));
  assert.equal(validateLinks([{label:' Docs ',url:'https://example.com'}])[0].label,'Docs');
});
test('server denies unauthenticated entry when services are unconfigured',async()=>{await assert.rejects(authenticate(''));});

test('seat interactions cannot bypass room walls or voice-zone transitions',()=>{
  const e=engine(),p=e.players.get('a')!,s=SEATS.find(s=>s.room==='meeting')!;
  Object.assign(p,{x:s.x-2,z:s.z,room:'hallway'});e.action('a','seat',{id:s.id});assert.equal(p.seat,null);
});
