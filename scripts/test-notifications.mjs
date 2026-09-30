import assert from 'node:assert/strict';
import {handle} from '../lib/api.ts';
import {resendNotifier,managementMailer} from '../lib/notifications.ts';
const poll={id:'p_'+'a'.repeat(32),title:'Prueba',creator:{name:'Creador',email:'creator@example.com'},mode:'week',start:'2026-09-23',end:'2026-09-30',from:540,to:720,step:60,timezone:'America/Santiago',created:new Date().toISOString()};
const saved=new Map();let failStorage=false,notifications=[];
const store={getPoll:async()=>poll,getVotes:async()=>[],getVote:async id=>saved.get(id),saveVote:async v=>{if(failStorage)throw Error('Test storage failure');saved.set(v.id,v)}};
const notify=async(...args)=>{notifications.push(args)};
const vote={email:'participant@example.com',token:'a'.repeat(64),name:'Ana',comment:'Mañanas',slots:{w0: 'yes'}};vote.slots={'w0@540':'yes'};
const put=(body,fn=notify)=>handle(new Request('https://meeting.test/api/polls/'+poll.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),store,poll.id,fn);
assert.equal((await put({...vote,slots:{invalid:'yes'}})).status,400);assert.equal(notifications.length,0);
assert.equal((await put(vote)).status,200);assert.equal(notifications.length,1);assert.equal(notifications[0][2],undefined);
await put(vote);assert.equal(notifications.length,1);
await put({...vote,slots:{'w0@540':'maybe'}});assert.equal(notifications.length,2);assert(notifications[1][2]);
const failure=await put({...vote,comment:'Cambio'},async()=>{throw Error('Provider unavailable')});assert.equal(failure.status,200);assert((await failure.json()).notificationWarning);assert.equal(JSON.parse([...saved.values()][0].data).comment,'Cambio');
let calls=[];
const sender=resendNotifier({apiKey:'secret',from:'at meet <test@example.com>',siteUrl:'https://atmeet.netlify.app'},async(url,options)=>{calls.push({url,...options});return calls.length===1?new Response(null,{status:503}):Response.json({id:'test-email'})});
await sender(...notifications[0]);assert.equal(calls.length,2);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);assert.equal(calls[0].body,calls[1].body);const payload=JSON.parse(calls[0].body);assert.deepEqual(payload.to,['creator@example.com']);assert.match(payload.text,/Ana registró/);assert.match(payload.text,/https:\/\/atmeet.netlify.app\/r\//);assert(!payload.text.includes(vote.token));
const noCreator={...poll,creator:undefined};calls=[];await sender(noCreator,notifications[0][1],undefined,'key');assert.equal(calls.length,0);
console.log('PASS: notification after valid save, changes only, failed delivery preserves vote, transient retries use same key, legacy skip');

let inviteCalls=[];
const invitationMailer=managementMailer({apiKey:'secret',from:'at meet <atmeet@contact.agencements.net>',siteUrl:'https://atmeet.netlify.app'},async(url,options)=>{inviteCalls.push({url,...options});return inviteCalls.length===1?new Response(null,{status:503}):Response.json({id:'invitation'});});
await invitationMailer.admin('invite','invited@example.com','https://atmeet.netlify.app/admin#invite=private-token','admin-invite/test');
assert.equal(inviteCalls.length,2);assert.equal(inviteCalls[0].body,inviteCalls[1].body);assert.equal(inviteCalls[0].headers['Idempotency-Key'],inviteCalls[1].headers['Idempotency-Key']);
const invitationPayload=JSON.parse(inviteCalls[0].body);assert.deepEqual(invitationPayload.to,['invited@example.com']);assert.equal(invitationPayload.from,'at meet <atmeet@contact.agencements.net>');assert.match(invitationPayload.text,/7 días/);assert.match(invitationPayload.text,/https:\/\/atmeet.netlify.app\/admin#invite=/);
console.log('PASS: invitation recipient, sender, private link, expiry and idempotent retry');

const deliveryCalls=[];
const confirmationMailer=managementMailer({apiKey:'secret',from:'test@example.com',siteUrl:'https://meeting.test'},async(url,options)=>{deliveryCalls.push(JSON.parse(options.body));return Response.json({id:'mock'});});
const selected={...poll,closed:true,selectedSlot:'w2@540',selectedDate:'2026-09-30',duration:60};
await confirmationMailer.group(selected,['one@example.com','two@example.com'],'Confirmación','Enlace <seguro> & detalle','confirmed-test');
const messages=deliveryCalls[0];assert.equal(messages.length,2);assert.deepEqual(messages[0].to,['one@example.com']);
assert.match(messages[0].html,/Añadir a Google Calendar/);assert.match(messages[0].html,/Calendario de macOS/);assert.match(messages[0].html,/&lt;seguro&gt; &amp; detalle/);
assert.match(messages[0].text,/calendar.google.com/);assert.match(messages[0].text,/slot=w2%40540/);assert(!messages[0].text.includes('two@example.com'));
await confirmationMailer.requestAccount('admin@example.com',{id:'request-id',name:'Solicitante',email:'applicant@example.com',message:'Necesito acceso'},'request-test');
assert.deepEqual(deliveryCalls[1].to,['admin@example.com']);assert.match(deliveryCalls[1].text,/applicant@example.com/);assert.match(deliveryCalls[1].text,/no concede acceso/);
console.log('PASS: calendar confirmation buttons, escaped HTML, individual recipients and admin request notice');

let scheduleMail;
const scheduleSender=managementMailer({apiKey:'mock',from:'test@example.com',siteUrl:'https://meeting.test'},async(_,o)=>{scheduleMail=JSON.parse(o.body);return Response.json({id:'mock'});});
await scheduleSender.schedule({...poll,scheduleRevision:2},'participant@example.com','schedule-event');
assert.deepEqual(scheduleMail.to,['participant@example.com']);assert.match(scheduleMail.text,/actualizó/);assert.match(scheduleMail.text,/Duración/);assert.match(scheduleMail.text,/Revisar consulta/);assert(!scheduleMail.text.includes('manage'));
console.log('PASS: schedule change notice, proposed ranges, duration, timezone and participant privacy');

const {notifyScheduleChanges}=await import('../lib/schedule-notifications.ts');
let queuedDone=false,queuedLease=false,queuedDelivered=[],queuedCalls=[];
const scheduleRest=async(path,method,body)=>{
 if(path==='rpc/meeting_claim_schedule_notice'){if(queuedDone||queuedLease)return null;queuedLease=true;return {id:'change-id',after_data:poll,emails:['one@example.com','two@example.com'],delivered_emails:[...queuedDelivered]};}
 if(path==='rpc/meeting_ack_schedule_notice'){if(body.p_email)queuedDelivered.push(body.p_email);if(body.p_done)queuedDone=true;return null;}throw Error(path);
};
await notifyScheduleChanges(scheduleRest,async(p,email,key)=>{queuedCalls.push({email,key});if(email==='two@example.com')throw Error('mail failed');}).catch(()=>{});
queuedLease=false;await notifyScheduleChanges(scheduleRest,async(p,email,key)=>queuedCalls.push({email,key}));
assert.deepEqual(queuedCalls.map(x=>x.email),['one@example.com','two@example.com','two@example.com']);assert.equal(queuedCalls[1].key,queuedCalls[2].key);assert(queuedDone);
console.log('PASS: schedule notice durable partial success and stable retry keys');
