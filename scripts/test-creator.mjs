import assert from 'node:assert/strict';
import {handle} from '../lib/api.ts';
const polls=new Map();
const store={getPoll:async id=>polls.get(id)||null,createPoll:async p=>polls.set(p.id,p),getVotes:async()=>[]};
const config={title:'Consulta de prueba',creator:{name:'  Persona de prueba  ',email:' TEST@example.com '},mode:'month',start:'2026-09-23',end:'2026-09-30',from:540,to:720,step:60,timezone:'America/Santiago'};
const post=body=>handle(new Request('https://meeting.test/api/polls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),store);
const created=await post(config);assert.equal(created.status,201);
const {poll}=await created.json();assert(!('creator' in poll));
assert.deepEqual(polls.get(poll.id).creator,{name:'Persona de prueba',email:'test@example.com',notify:true});
const read=await handle(new Request('https://meeting.test/api/polls/'+poll.id),store,poll.id);
assert(!('creator' in (await read.json()).poll));
for(const creator of [undefined,{name:' ',email:'test@example.com'},{name:'Name',email:'invalid'}])assert.equal((await post({...config,creator})).status,400);
// Existing polls without creator details remain readable.
const legacy={...poll,id:'p_'+'a'.repeat(32)};polls.set(legacy.id,legacy);
assert.equal((await handle(new Request('https://meeting.test/api/polls/'+legacy.id),store,legacy.id)).status,200);
assert.equal(polls.size,2);
console.log('PASS: creator validation, persistence, public response privacy and legacy compatibility');
