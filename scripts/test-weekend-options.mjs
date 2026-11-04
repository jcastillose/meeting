import assert from 'node:assert/strict';
import {days,validKeys,rank,add} from '../lib/domain.ts';
import {calendarWeeks,calendarMonths} from '../lib/calendar-layout.ts';
import {consultationStatus} from '../lib/consultation-status.ts';
import {calendarEvent,confirmedCalendar} from '../lib/calendar-export.ts';
import {replaceSchedule} from '../lib/schedule-extension.ts';
import {handle} from '../lib/api.ts';

const base={id:'p_'+'d'.repeat(32),title:'Weekend choices',mode:'dates',start:'2026-11-06',end:'2026-11-09',from:540,to:600,step:30,duration:30,timezone:'America/Santiago',created:'2026-11-04T12:00:00Z'};
const weekdays={...base,includeSaturdays:false,includeSundays:false};
assert.deepEqual(days(base),['2026-11-06','2026-11-07','2026-11-08','2026-11-09'],'Legacy polls still include all dates.');
assert.deepEqual(days(weekdays),['2026-11-06','2026-11-09']);
assert.deepEqual(days({...weekdays,includeSaturdays:true}),['2026-11-06','2026-11-07','2026-11-09']);
assert.deepEqual(days({...weekdays,includeSundays:true}),['2026-11-06','2026-11-08','2026-11-09']);
assert.deepEqual(days({...weekdays,includeSaturdays:true,includeSundays:true}),days(base));
assert.deepEqual(days({...weekdays,start:'2026-11-07',end:'2026-11-08'}),[]);
assert.deepEqual(days({...weekdays,start:'2026-12-31',end:'2027-01-04'}),['2026-12-31','2027-01-01','2027-01-04']);
assert.deepEqual(days({...weekdays,start:'2028-02-26',end:'2028-02-29'}),['2028-02-28','2028-02-29']);
assert.equal(days({...base,end:add(base.start,61)}).length,62);
assert.equal(days({...weekdays,mode:'week'}).length,7);
assert.equal(days({...weekdays,mode:'month'}).length,31);
assert.deepEqual(calendarWeeks(weekdays).flat(),days(weekdays));
assert(calendarMonths(weekdays).flat().includes('2026-11-07'),'The alternate calendar may display an excluded date, but it must not be selectable.');
assert(!validKeys(weekdays).has('2026-11-07@540'));
assert.throws(()=>calendarEvent(weekdays,'2026-11-07@540','https://meeting.test'));
const vote={id:'v',name:'Fixture',comment:'',slots:{'2026-11-06@540':'yes','2026-11-07@540':'yes'}};
assert.deepEqual(rank(weekdays,[vote]).map(r=>r.key),['2026-11-06@540']);
const endingOnSunday={...weekdays,end:'2026-11-08'};
assert.equal(consultationStatus(endingOnSunday,new Date('2026-11-06T13:00:00Z')),'expired','Expiry follows the last included Friday, not the excluded Sunday.');
const explicit={...weekdays,...replaceSchedule(weekdays,{ranges:[{date:'2026-11-07',from:540,to:600}]})};
assert.deepEqual(days(explicit),['2026-11-07'],'Explicit date proposals are authoritative after an admin edits the schedule.');
const recurring={...weekdays,mode:'week',selectedSlot:'w6@540',selectedDate:'2026-11-08',closed:true};
assert.match(confirmedCalendar(recurring,'https://meeting.test').ics,/STATUS:CONFIRMED/,'Recurring Sunday confirmation must ignore date-range weekend flags.');

const polls=new Map(),votes=new Map();let writes=0;
const store={createPoll:async p=>{writes++;polls.set(p.id,p);},getPoll:async id=>polls.get(id),getVotes:async()=>[],getVote:async id=>votes.get(id),saveVote:async v=>{votes.set(v.id,v);return true;}};
const input={...weekdays,creator:{name:'Fixture',email:'creator@example.invalid'}};
async function request(data,id,method='POST'){
 return handle(new Request('https://meeting.test/api/polls'+(id?'/'+id:''),{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),store,id);
}
for(const [includeSaturdays,includeSundays,count] of [[false,false,2],[true,false,3],[false,true,3],[true,true,4]]){
 const r=await request({...input,includeSaturdays,includeSundays});assert.equal(r.status,201);
 const {poll}=await r.json();assert.equal(poll.includeSaturdays,includeSaturdays);assert.equal(poll.includeSundays,includeSundays);assert.equal(days(poll).length,count);
 const publicResponse=await handle(new Request('https://meeting.test/api/polls/'+poll.id),store,poll.id);
 assert.equal((await publicResponse.json()).poll.includeSaturdays,includeSaturdays);
}
const before=writes;
let r=await request({...input,start:'2026-11-07',end:'2026-11-08'});assert.equal(r.status,400);assert.match((await r.json()).error,/no contiene fechas/);assert.equal(writes,before);
r=await request({...input,start:'2026-11-07',end:'2026-11-07',includeSaturdays:true});assert.equal(r.status,201);
r=await request({...input,includeSaturdays:'true'});assert.equal(r.status,400);
r=await request({...input,includeSaturdays:undefined,includeSundays:undefined});assert.equal(r.status,201);assert.equal(days((await r.json()).poll).length,4);
r=await request(input);const {poll:restricted}=await r.json();
const answer={name:'Fixture',email:'fixture@example.invalid',token:'e'.repeat(64),comment:'',slots:{'2026-11-07@540':'yes'}};
assert.equal((await request(answer,restricted.id,'PUT')).status,400,'The API rejects votes on excluded weekends.');
assert.equal(votes.size,0);
assert.equal((await request({...answer,slots:{'2026-11-06@540':'yes'}},restricted.id,'PUT')).status,200);
for(const mode of ['week','month']){
 r=await request({...input,mode});assert.equal(r.status,201);const {poll}=await r.json();assert.equal(poll.includeSaturdays,undefined);assert.equal(poll.includeSundays,undefined);
}
r=await request({...input,dailyRanges:[{date:'2026-11-07',from:540,to:600}]});assert.equal(r.status,201);assert.deepEqual(days((await r.json()).poll),['2026-11-07']);
console.log('PASS: independent weekend choices, legacy dates, empty range rejection, API round-trip and votes, expiry, recurring export and explicit proposals');
