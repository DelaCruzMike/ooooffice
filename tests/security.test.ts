import test from 'node:test';
import assert from 'node:assert/strict';
import { OfficeRoom } from '../server/OfficeRoom.js';
import { DEFAULT_AVATAR, makePlayer, newGame, type Snapshot } from '../shared/world.js';
import { SnapshotDiffer, applyPatch } from '../shared/sync.js';
import type { Client } from '@colyseus/core';

test('voice transition holds position until the old voice session is actually retired',async()=>{
  const room=new OfficeRoom();const p=room.engine.add('a','u','Alex',DEFAULT_AVATAR,'member','Team');room.voiceSessions.set('a','commons');
  let finish!:(v:boolean)=>void;room.voiceRemoval=()=>new Promise(r=>finish=r);
  assert.equal(room.transition(p,{x:-9,z:14}),false);assert.ok(room.voiceTransitions.has('a'));assert.equal(room.voiceSessions.get('a'),'commons');
  finish(true);await new Promise(r=>setTimeout(r,0));assert.equal(room.voiceSessions.has('a'),false);assert.equal(room.voiceTransitions.has('a'),false);assert.equal(room.transition(p,{x:-9,z:14}),true);
});
test('failed voice disconnection never allows a new zone',async()=>{
  const room=new OfficeRoom();const p=room.engine.add('a','u','Alex',DEFAULT_AVATAR,'member','Team');room.voiceSessions.set('a','commons');room.voiceRemoval=async()=>{throw new Error('unavailable');};
  assert.equal(room.transition(p,{x:-9,z:14}),false);await new Promise(r=>setTimeout(r,0));assert.equal(room.voiceSessions.get('a'),'commons');assert.equal(room.transition(p,{x:-9,z:14}),false);await new Promise(r=>setTimeout(r,0));
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
  const a=makePlayer('a','Alex'),b=makePlayer('b','Sam');const base:Snapshot={players:[a,b],locked:false,host:null,game:newGame(),links:[]};
  const differ=new SnapshotDiffer();let client=applyPatch({...base,players:[]},differ.diff(base)!);assert.equal(client.players.length,2);assert.equal(differ.diff(base),null);
  a.x=2.1234;a.z=3.568;a.moving=true;const patch=differ.diff(base)!;assert.equal(patch.updates.length,0);assert.deepEqual(patch.motion[0],['a',212,357,0,true]);client=applyPatch(client,patch);assert.ok(Math.abs(client.players[0].x-a.x)<.01);
  a.status='busy';base.locked=true;base.players=[a];client=applyPatch(client,differ.diff(base)!);assert.equal(client.players.length,1);assert.equal(client.players[0].status,'busy');assert.equal(client.locked,true);
});
