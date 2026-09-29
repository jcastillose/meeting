import assert from 'node:assert/strict';
import {handle} from '../lib/api.ts';
import {days,times,validKeys,rank} from '../lib/domain.ts';
import {calendarEvent} from '../lib/calendar-export.ts';
const polls=new Map(),votes=new Map();
const store={createPoll:async p=>polls.set(p.id,p),getPoll:async id=>polls.get(id),getVotes:async()=>[...votes.values()].map(v=>JSON.parse(v.data)),getVote:async id=>votes.get(id),saveVote:async v=>votes.set(v.id,v)};
const body={creator:{name:'Test',email:'creator@example.com'},title:'Different days',mode:'dates',start:'2026-09-28',end:'2026-10-10',from:540,to:1080,step:30,duration:60,timezone:'America/Santiago',dailyRanges:[{date:'2026-10-02',from:900,to:1080},{date:'2026-09-28',from:540,to:660}]};
const request=(data,id,method='POST')=>handle(new Request('https://meeting.test/api/polls'+(id?'/'+id:''),{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),store,id);
const response=await request(body);assert.equal(response.status,201);const {poll}=await response.json();assert.equal(poll.start,'2026-09-28');assert.equal(poll.end,'2026-10-02');assert.deepEqual(poll.dailyRanges,[...body.dailyRanges].sort((a,b)=>a.date.localeCompare(b.date)));assert.equal(poll.creator,undefined);
assert.deepEqual(days(poll),['2026-09-28','2026-10-02']);assert.deepEqual(times(poll,'2026-09-28'),[540,570,600,630]);assert.equal(validKeys(poll).size,10);assert(!validKeys(poll).has('2026-09-28@900'));assert(!validKeys(poll).has('2026-09-29@540'));
const vote={email:'v@example.com',name:'V',comment:'',token:'a'.repeat(64),slots:Object.fromEntries([...validKeys(poll)].map(k=>[k,'yes']))};
assert.equal((await request(vote,poll.id,'PUT')).status,200);assert.equal((await request({...vote,slots:{'2026-09-28@900':'yes'}},poll.id,'PUT')).status,400);
const ranked=rank(poll,[{...vote,id:'v'}]);assert.equal(ranked.length,8);assert(!ranked.some(r=>r.key==='2026-09-28@630'));assert.throws(()=>calendarEvent(poll,'2026-09-28@630','https://meeting.test'));assert.match(calendarEvent(poll,'2026-10-02@900','https://meeting.test'),/BEGIN:VEVENT/);
for(const patch of [{dailyRanges:[]},{mode:'week'},{dailyRanges:[body.dailyRanges[0],body.dailyRanges[0]]},{dailyRanges:[{date:'2026-02-30',from:540,to:660}]},{dailyRanges:[{date:'2026-09-28',from:555,to:660}]},{dailyRanges:[{date:'2026-09-28',from:600,to:570}]},{dailyRanges:[{date:'2026-09-28',from:540,to:570}]},{dailyRanges:[body.dailyRanges[0],{date:'2027-01-01',from:540,to:660}]}])assert.equal((await request({...body,...patch})).status,400,JSON.stringify(patch));
for(const mode of ['dates','week','month']){const r=await request({...body,mode,dailyRanges:undefined});assert.equal(r.status,201);const {poll:p}=await r.json();assert(validKeys(p).size>0);}
console.log('PASS: daily bounds, serialization, date/time validation, voting, full-duration ranking/export and legacy modes');
