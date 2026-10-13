import {add,date,days,times,type Poll} from './domain';

/** Show every proposed date, grouped by civil week without empty weeks. */
export function calendarWeeks(p:Poll):string[][]{
 const proposed=days(p);
 if(p.mode==='week')return [proposed];
 if(p.mode==='month')return Array.from({length:Math.ceil(proposed.length/7)},(_,i)=>proposed.slice(i*7,i*7+7));
 const weeks=new Map<string,string[]>();
 for(const day of proposed){const monday=add(day,-((date(day).getDay()+6)%7));const group=weeks.get(monday)||[];group.push(day);weeks.set(monday,group);}
 return [...weeks.values()];
}
export function calendarTimes(p:Poll,columns:string[]):number[]{
 return [...new Set(columns.flatMap(day=>times(p,day)))].sort((a,b)=>a-b);
}
export function calendarMonths(p:Poll):(string|null)[][]{
 if(p.mode!=='dates')return [days(p)];
 const months=new Map<string,string[]>();
 for(const day of days(p)){const month=day.slice(0,7);const group=months.get(month)||[];group.push(day);months.set(month,group);}
 return [...months.values()].map(proposed=>{
  const first=proposed[0],last=proposed.at(-1)!;
  const cells:(string|null)[]=Array((date(first).getDay()+6)%7).fill(null);
  for(let day=first;day<=last;day=add(day,1))cells.push(day);
  return cells;
 });
}
