import assert from 'node:assert/strict';
import {durationWindow,availabilityDurationErrors} from '../lib/availability-draft.ts';
import {handle} from '../lib/api.ts';
import {validKeys} from '../lib/domain.ts';

const poll={id:'p_'+'c'.repeat(32),title:'Duration rule',mode:'dates',start:'2026-11-05',end:'2026-11-05',from:540,to:720,step:30,duration:90,timezone:'America/Santiago',created:''};
const keys=[540,570,600].map(t=>'2026-11-05@'+t);
const slots=(minutes,status='yes')=>Object.fromEntries(minutes.map(t=>['2026-11-05@'+t,status]));
assert.deepEqual(durationWindow(poll,keys[0]),keys);
assert.deepEqual(durationWindow(poll,'2026-11-05@690'),[630,660,690].map(t=>'2026-11-05@'+t),'A final half hour selects a whole meeting within the proposed range.');
const gaps={...poll,dailyRanges:[{date:'2026-11-05',from:540,to:600},{date:'2026-11-05',from:630,to:720}]};
assert.deepEqual(durationWindow(gaps,'2026-11-05@570'),[],'Do not bridge a pause to make a meeting.');
assert.deepEqual(durationWindow(gaps,'2026-11-05@690'),[630,660,690].map(t=>'2026-11-05@'+t));
assert.deepEqual(durationWindow({...poll,from:1350,to:1440},'2026-11-05@1410'),[1350,1380,1410].map(t=>'2026-11-05@'+t));
for(const duration of [30,60,90,120]){
 const p={...poll,duration};const selected=durationWindow(p,keys[0]);
 assert.equal(selected.length,duration/p.step);
 assert.deepEqual(availabilityDurationErrors(p,Object.fromEntries(selected.map(k=>[k,'yes']))),[]);
}
assert.deepEqual(availabilityDurationErrors(poll,{}),[],'No availability must remain a valid response.');
assert.deepEqual(availabilityDurationErrors(poll,slots([540],'no')),[],'A short occupied interval may rule out longer meetings.');
assert.equal(availabilityDurationErrors(poll,slots([540,570])).length,1);
assert.deepEqual(availabilityDurationErrors(poll,{...slots([540,570]),...slots([600],'maybe')}),[],'Tentative and confirmed intervals can form a complete tentative meeting.');
assert.equal(availabilityDurationErrors(poll,{...slots([540,570]),...slots([600],'no')}).length,1);
assert.equal(availabilityDurationErrors(poll,slots([540,570,630,660])).length,2,'Disjoint short intervals cannot be added together.');
assert.deepEqual(availabilityDurationErrors(poll,slots([540,570,600,630])),[],'A longer continuous range need not be a multiple of the meeting duration.');
assert.equal(availabilityDurationErrors(gaps,slots([540,570,630,660,690])).length,1);
assert.deepEqual(availabilityDurationErrors({...poll,mode:'week'},Object.fromEntries([540,570,600].map(t=>['w0@'+t,'yes']))),[]);

let saved=0,notified=0;
const records=new Map();
const store={getPoll:async()=>poll,getVotes:async()=>[],getVote:async id=>records.get(id),saveVote:async v=>{saved++;records.set(v.id,v);return true}};
const vote={name:'Fixture',email:'fixture@example.invalid',comment:'',token:'c'.repeat(64),slots:slots([540])};
async function put(body){return handle(new Request('https://meeting.test/api/polls/'+poll.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),store,poll.id,async()=>{notified++;});}
let response=await put(vote);
assert.equal(response.status,400);
assert.match((await response.json()).error,/90 minutos continuos/);
assert.equal(saved,0);
response=await put({...vote,slots:slots([540,570,600])});
assert.equal(response.status,200);assert.equal(saved,1);
const snapshot=[...records.values()][0].data;
response=await put({...vote,comment:'Must not replace saved availability',slots:slots([570])});
assert.equal(response.status,400);assert.equal(saved,1);assert.equal([...records.values()][0].data,snapshot);
response=await put({...vote,slots:slots([540],'no')});
assert.equal(response.status,200);assert.equal(saved,2);
response=await put({...vote,slots:{}});
assert.equal(response.status,200);assert.equal(saved,3);
assert.equal(notified,0);
assert.equal(validKeys(poll).size,6);
console.log('PASS: duration windows, boundaries, gaps, mixed availability, incomplete response rejection and saved response preservation');
