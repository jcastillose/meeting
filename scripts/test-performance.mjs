import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {rank,days,times,validKeys,meetingStatus,meetingFits} from '../lib/domain.ts';
import {indexVotes} from '../lib/vote-index.ts';
const before=(p,votes)=>{const keys=validKeys(p);return [...keys].filter(k=>meetingFits(p,k,keys)).map(key=>{let yes=0,maybe=0,no=0;for(const v of votes){const status=meetingStatus(p,v,key);if(status==='yes')yes++;if(status==='maybe')maybe++;if(status==='no')no++;}return {key,yes,maybe,no,missing:votes.length-yes-maybe-no};}).filter(r=>r.yes+r.maybe>0).sort((a,b)=>a.no-b.no||a.missing-b.missing||b.yes-a.yes||b.maybe-a.maybe||a.key.localeCompare(b.key));};
let seed=12345;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const poll={id:'test',title:'Benchmark',mode:'dates',start:'2026-10-01',end:'2026-11-30',from:480,to:1200,step:30,duration:180,timezone:'America/Santiago',created:''};
function voters(p,n){const keys=[...validKeys(p)];return Array.from({length:n},(_,i)=>({id:String(i),name:'Person '+i,comment:'',slots:Object.fromEntries(keys.flatMap(k=>{const status=['yes','yes','maybe','no',undefined][Math.floor(random()*5)];return status?[[k,status]]:[];}))}));}
for(const mode of ['dates','week','month'])for(const step of [30,60])for(const duration of [step,step*2,step*5]){
 const p={...poll,mode,step,duration,end:'2026-10-08'};const votes=voters(p,7);assert.deepEqual(rank(p,votes),before(p,votes));
 const indexed=indexVotes(votes);for(const k of validKeys(p))for(const status of ['yes','maybe','no'])assert.equal(indexed.get(k)?.[status]||0,votes.filter(v=>v.slots[k]===status).length);
}
for(let i=0;i<30;i++){
 const p={...poll,duration:[30,60,90,180][i%4],dailyRanges:[{date:'2026-10-01',from:480,to:600},{date:'2026-10-01',from:720,to:1080},{date:'2026-10-03',from:540,to:900}]};const votes=voters(p,12);assert.deepEqual(rank(p,votes),before(p,votes));
}
assert.deepEqual(rank(poll,[]),[]);
const votes=voters(poll,300);const measure=fn=>{const results=[];for(let i=0;i<4;i++){const t=performance.now();fn();results.push(performance.now()-t);}return results.slice(1).sort((a,b)=>a-b)[1];};
assert.deepEqual(rank(poll,votes),before(poll,votes));
const oldMs=measure(()=>before(poll,votes)),newMs=measure(()=>rank(poll,votes));
const keys=[...validKeys(poll)];
const oldScan=()=>{let count=0;for(const key of keys)for(const status of ['yes','maybe','no'])count+=votes.filter(v=>v.slots[key]===status).length;return count;};
const idx=indexVotes(votes);const lookup=()=>keys.reduce((n,k)=>n+(idx.get(k)?.total||0),0);assert.equal(lookup(),oldScan());
console.log(JSON.stringify({test:'PASS: ranking equivalence, gaps, missing/no precedence, counts',scenario:{days:days(poll).length,slots:keys.length,voters:votes.length,duration:poll.duration},medianMs:{rankBefore:oldMs,rankAfter:newMs,scanBefore:measure(oldScan),lookupAfter:measure(lookup),indexBuild:measure(()=>indexVotes(votes))}},null,2));
