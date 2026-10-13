import assert from 'node:assert/strict';
import {calendarWeeks,calendarTimes,calendarMonths,calendarHours} from '../lib/calendar-layout.ts';
import {days,validKeys,rank} from '../lib/domain.ts';
const base={id:'test',title:'Prueba',mode:'dates',start:'2026-10-05',end:'2026-10-20',from:540,to:600,step:30,duration:30,timezone:'America/Santiago',created:''};
function check(p){const weeks=calendarWeeks(p);assert.deepEqual(weeks.flat(),days(p));const rendered=weeks.flatMap(group=>calendarTimes(p,group).flatMap(t=>group.map(d=>`${d}@${t}`).filter(k=>validKeys(p).has(k))));assert.equal(new Set(rendered).size,rendered.length);assert.deepEqual([...rendered].sort(),[...validKeys(p)].sort());return weeks;}
assert.equal(check(base).length,3);
assert.deepEqual(check({...base,start:'2026-10-11',end:'2026-10-12'}),[['2026-10-11'],['2026-10-12']]);
const cross={...base,start:'2026-12-31',end:'2027-01-02'};check(cross);assert.equal(calendarMonths(cross).length,2);
const sparse={...base,start:'2026-10-05',end:'2026-10-23',dailyRanges:[{date:'2026-10-05',from:540,to:600},{date:'2026-10-23',from:900,to:960}]};
const sparseWeeks=check(sparse);assert.equal(sparseWeeks.length,2);assert.deepEqual(calendarTimes(sparse,sparseWeeks[0]),[540,570]);assert.deepEqual(calendarTimes(sparse,sparseWeeks[1]),[900,930]);
check({...base,mode:'month'});check({...base,mode:'week'});
const midnight={...base,start:'2026-10-05',end:'2026-10-05',from:1410,to:1440};check(midnight);assert.equal(rank(midnight,[{id:'v',name:'Prueba',comment:'',slots:{'2026-10-05@1410':'yes'}}])[0].key,'2026-10-05@1410');
console.log('PASS: all dates and slots exactly once, civil weeks, sparse dates, month/year boundary, recurring modes, 30-minute midnight meeting');

assert.deepEqual(calendarHours(base,['2026-10-05']),[540]);
assert.deepEqual(calendarHours({...base,from:570,to:630},['2026-10-05']),[540,600]);
assert.deepEqual(calendarHours(midnight,['2026-10-05']),[1380]);
const grouped=calendarWeeks(sparse).flatMap(cols=>calendarHours(sparse,cols).flatMap(h=>cols.flatMap(d=>[h,h+30].map(t=>`${d}@${t}`).filter(k=>validKeys(sparse).has(k)))));
assert.deepEqual(grouped.sort(),[...validKeys(sparse)].sort());
console.log('PASS: visual hour groups preserve half-hour keys, partial first/last hour and midnight');
