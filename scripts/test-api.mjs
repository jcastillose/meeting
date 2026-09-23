import assert from 'node:assert/strict';
const base='http://localhost:5173';
async function req(path,method='GET',body,expected=200,extra={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});const raw=await r.text();assert.equal(r.status,expected,path+': '+raw);if(expected===403)return raw;return JSON.parse(raw);}
const config={creator:{name:'Creador de prueba',email:'creator@example.com'},title:'Prueba local de persistencia',mode:'dates',start:'2026-09-21',end:'2026-09-30',from:540,to:1080,step:30,timezone:'America/Santiago'};
const {poll}=await req('/api/polls','POST',config,201);const path='/api/polls/'+poll.id;
const a={email:'participant@example.com',token:'a'.repeat(64),name:'Participante A (prueba)',comment:'Prefiero temprano',slots:{'2026-09-21@540':'yes','2026-09-21@570':'no'}};
const b={email:'participant-b@example.com',token:'b'.repeat(64),name:'Participante B (prueba)',comment:'Puedo a primera hora',slots:{'2026-09-21@540':'yes','2026-09-22@540':'maybe'}};
const av=await req(path,'PUT',a);const bv=await req(path,'PUT',b);assert.notEqual(av.vote.id,bv.vote.id);
let data=await req(path);assert.equal(data.votes.length,2);assert(!JSON.stringify(data).includes('edit_hash'));assert(!JSON.stringify(data).includes(a.token));
await req(path,'PUT',{...a,comment:'Comentario actualizado',slots:{'2026-09-21@540':'maybe'}});data=await req(path);assert.equal(data.votes.length,2);assert.equal(data.votes.find(v=>v.id===bv.vote.id).comment,b.comment);assert.equal(data.votes.find(v=>v.id===av.vote.id).comment,'Comentario actualizado');
await req(path,'PUT',{...a,name:''},400);await req(path,'PUT',{...a,slots:{'2026-10-01@540':'yes'}},400);await req(path,'PUT',{...a,slots:{'2026-09-21@541':'yes'}},400);
await req('/api/polls','POST',{...config,end:'2026-02-30'},400);await req('/api/polls','POST',{...config,to:540},400);await req('/api/polls','POST',{...config,end:'2027-09-21'},400);await req(path,'PUT',a,403,{Origin:'https://elsewhere.example'});
for(const [mode,key] of [['week','w6@540'],['month','m31@540']]){const {poll:p}=await req('/api/polls','POST',{...config,mode},201);await req('/api/polls/'+p.id,'PUT',{...a,slots:{[key]:'yes'}});assert.equal((await req('/api/polls/'+p.id)).votes.length,1);}
await req('/api/polls/p_'+'0'.repeat(32),'GET',undefined,404);
console.log('PASS: persistencia, dos participantes, edición aislada, validación, origen, fechas y ambos modos abstractos.');console.log('Consulta local de prueba: '+base+'/?p='+poll.id);
