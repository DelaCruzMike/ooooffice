import test from 'node:test';
import assert from 'node:assert/strict';
import { OfficeRoom } from '../server/OfficeRoom.js';
import { DEFAULT_AVATAR, PROTOCOL_VERSION, makePlayer, emptySnapshot, type Snapshot } from '../shared/world.js';
import { SnapshotDiffer, applyPatch } from '../shared/sync.js';
import type { Client } from '@colyseus/core';

test('voice transition holds position until the old voice session is actually retired',async()=>{
  const room=new OfficeRoom();const p=room.engine.add('a','u','Alex',DEFAULT_AVATAR,'member','Team');room.voiceSessions.set('a','commons');
  let finish!:(v:boolean)=>void;room.voiceRemoval=()=>new Promise(r=>finish=r);
  assert.equal(room.transition(p,{x:-11,z:15}),false);assert.ok(room.voiceTransitions.has('a'));assert.equal(room.voiceSessions.get('a'),'commons');
  finish(true);await new Promise(r=>setTimeout(r,0));assert.equal(room.voiceSessions.has('a'),false);assert.equal(room.voiceTransitions.has('a'),false);assert.equal(room.transition(p,{x:-11,z:15}),true);
});
test('failed voice disconnection never allows a new zone',async()=>{
  const room=new OfficeRoom();const p=room.engine.add('a','u','Alex',DEFAULT_AVATAR,'member','Team');room.voiceSessions.set('a','commons');room.voiceRemoval=async()=>{throw new Error('unavailable');};
  assert.equal(room.transition(p,{x:-11,z:15}),false);await new Promise(r=>setTimeout(r,0));assert.equal(room.voiceSessions.get('a'),'commons');assert.equal(room.transition(p,{x:-11,z:15}),false);await new Promise(r=>setTimeout(r,0));
});
test('unused voice credentials expire before movement can enter another room',async()=>{
  const room=new OfficeRoom();room.voiceSessions.set('a','commons');room.voiceExpiry.set('a',Date.now()+40);room.voiceRemoval=async()=>false;
  const start=Date.now();await room.stopVoice('a');assert.ok(Date.now()-start>=30);assert.equal(room.voiceSessions.has('a'),false);
});
test('access removal clears the live player immediately, even if voice cleanup is pending',async()=>{
  const room=new OfficeRoom();room.engine.add('a','u','Alex',DEFAULT_AVATAR,'member','Team');room.voiceSessions.set('a','commons');
  let finish!:(v:boolean)=>void;room.voiceRemoval=()=>new Promise(r=>finish=r);const removing=room.removeSession('a','Removed');assert.equal(room.engine.players.has('a'),false);finish(true);await removing;
});
test('simultaneous device joins for one account serialize and leave exactly one active character',async()=>{
  const room=new OfficeRoom();const identity={id:'same-user',email:'member@example.invalid',role:'member' as const,name:'Member',department:'Team',avatar:DEFAULT_AVATAR};
  room.identityResolver=async()=>identity;
  const fake=(id:string)=>({sessionId:id,send:()=>{},leave:()=>{}}) as unknown as Client;
  await Promise.all([room.onJoin(fake('a'),{}, {identity,token:'a'}),room.onJoin(fake('b'),{}, {identity,token:'b'})]);
  assert.equal(room.engine.players.size,1);assert.equal(room.engine.players.values().next().value?.userId,'same-user');
});
test('delta synchronization carries metadata changes, compact motion, removals, and office state',()=>{
  const a=makePlayer('a','Alex'),b=makePlayer('b','Sam');const base:Snapshot={...emptySnapshot(),players:[a,b]};
  const differ=new SnapshotDiffer();let client=applyPatch({...base,players:[]},differ.diff(base)!);assert.equal(client.players.length,2);assert.equal(differ.diff(base),null);
  a.x=2.1234;a.z=3.568;a.moving=true;const patch=differ.diff(base)!;assert.equal(patch.updates.length,0);assert.deepEqual(patch.motion[0],['a',212,357,314,0,0,true,true]);client=applyPatch(client,patch);assert.ok(Math.abs(client.players[0].x-a.x)<.01);
  a.status='busy';base.locks.meeting.locked=true;base.players=[a];client=applyPatch(client,differ.diff(base)!);assert.equal(client.players.length,1);assert.equal(client.players[0].status,'busy');assert.equal(client.locks.meeting.locked,true);
});
test('outdated browser protocol is rejected before authentication',async()=>{const room=new OfficeRoom();let called=false;room.identityResolver=async()=>{called=true;throw new Error('should not authenticate');};await assert.rejects(room.onAuth({} as Client,{token:'anything',protocol:1},{headers:{}}),/version changed/);assert.equal(called,false);});

test('HTTP matchmaking authenticates before seat reservation and rejects mismatched protocol/origin',async()=>{await assert.rejects(OfficeRoom.onAuth('',{protocol:PROTOCOL_VERSION},{headers:{}}),/sign|auth|token/i);await assert.rejects(OfficeRoom.onAuth('',{protocol:PROTOCOL_VERSION-1},{headers:{}}),/version/);await assert.rejects(OfficeRoom.onAuth('',{protocol:PROTOCOL_VERSION},{headers:{origin:'https://evil.invalid'}}),/allowed/);});

test('voice preparation or denied-mic cleanup allows walking inside the current audio zone while protecting its boundary',()=>{const room=new OfficeRoom();const p=room.engine.add('a','a','A',DEFAULT_AVATAR,'member','Team');room.engine.doors.csr.closed=true;room.voiceTransitions.add('a');assert.equal(room.transition(p,{x:p.x+.1,z:p.z}),true);assert.equal(room.transition(p,{x:-8.5,z:-14}),false);});

test('door privacy waits for stationary outside listeners and fails closed on cleanup failure',async()=>{
 const r=new OfficeRoom();const a=r.engine.add('a','a','A',DEFAULT_AVATAR,'member','Team'),b=r.engine.add('b','b','B',DEFAULT_AVATAR,'member','Team');a.room='csr';b.room='hallway';r.voiceSessions.set('b','3:proximity:v0');const before=structuredClone(r.engine.doors);let finish!:(v:boolean)=>void;r.voiceRemoval=()=>new Promise(done=>finish=done);r.engine.doors.csr.closed=true;r.coordinateDoors(before);assert.equal(r.engine.doors.csr.closed,false);assert.equal(r.engine.doors.csr.pending,true);finish(true);await new Promise(done=>setTimeout(done,0));assert.equal(r.engine.doors.csr.closed,true);assert.equal(r.engine.doors.csr.version,1);assert.equal(r.voiceSessions.size,0);
 const old=structuredClone(r.engine.doors);r.voiceSessions.set('a','3:private:csr:v1');r.voiceRemoval=async()=>{throw new Error('offline');};r.engine.doors.csr.closed=false;r.coordinateDoors(old);await new Promise(done=>setTimeout(done,0));assert.equal(r.engine.doors.csr.closed,true);assert.equal(r.doorTransaction,false);
});
test('full snapshot resets delta baseline so earlier floor occupants are removed',()=>{const r=new OfficeRoom(),p=r.engine.add('a','a','A',DEFAULT_AVATAR,'member','Team');r.engine.add('b','b','B',DEFAULT_AVATAR,'member','Team');let snapshot!:Snapshot;const c={sessionId:'a',send:(_t:string,s:Snapshot)=>snapshot=s} as unknown as Client;r.sendSnapshot(c);assert.equal(snapshot.players.length,2);r.engine.lobby(p);r.sendSnapshot(c);assert.equal(snapshot.players.length,1);assert.equal(snapshot.players[0].floor,'G');});
