import {Server} from '@colyseus/core';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {office} from './OfficeRoom.js';
// Expose only admission to the already-created office. Colyseus' generic create/
// joinOrCreate endpoints must never create additional offices or replace global authority.
export class OfficeServer extends Server {
 protected async handleMatchMakeRequest(req:IncomingMessage,res:ServerResponse){
  const origin=req.headers.origin,allowed=(process.env.FRONTEND_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173').split(',').map(s=>s.trim());
  const headers:Record<string,string>={'Content-Type':'application/json','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization'};
  if(origin&&allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  if(origin&&!allowed.includes(origin)){res.writeHead(403,headers);res.end(JSON.stringify({error:'This website is not an allowed office client.'}));return;}
  if(!office){res.writeHead(503,headers);res.end(JSON.stringify({error:'The office is starting.'}));return;}
  const path=(req.url||'').split('?')[0];
  if(path!==`/matchmake/joinById/${office.roomId}`||!['POST','OPTIONS'].includes(req.method||'')){res.writeHead(403,headers);res.end(JSON.stringify({error:'Use approved office admission. Creating additional offices is disabled.'}));return;}
  if(Number(req.headers['content-length']||0)>16384){res.writeHead(413,headers);res.end(JSON.stringify({error:'Admission request is too large.'}));return;}
  let bytes=0;req.on('data',chunk=>{bytes+=chunk.length;if(bytes>16384)req.destroy();});
  await super.handleMatchMakeRequest(req,res);
 }
}
