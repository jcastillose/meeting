export type Mode = "dates"|"week"|"month";
export type Status = "yes"|"maybe"|"no";
export type DailyRange = {date:string;from:number;to:number};
export type Poll = {selectedDate?:string;selectedSlot?:string;ownerId?:string;scheduleRevision?:number;id:string; title:string; mode:Mode; start:string; end:string; from:number; to:number; step:number; duration?:number;dailyRanges?:DailyRange[]; timezone:string; created:string; closed?:boolean;closedAt?:string;manageHash?:string;creator?:{name:string;email:string;notify?:boolean}};
export type Vote = {id:string; name:string; email?:string; comment:string; slots:Record<string,Status>};
export const weekdays=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
export const modes={dates:"Fechas concretas",week:"Semana habitual",month:"Días habituales del mes"};
export const statuses={yes:"Disponible",maybe:"Si hace falta",no:"Ocupado"};
export function iso(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
export function date(s:string){return new Date(s+"T12:00:00");}
export function add(s:string,n:number){const d=date(s);d.setDate(d.getDate()+n);return iso(d);}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function times(p:Poll,day?:string){
  const ranges=day&&p.dailyRanges?p.dailyRanges.filter(r=>r.date===day):[p];
  return [...new Set(ranges.flatMap(r=>Array.from({length:Math.max(0,Math.floor((r.to-r.from)/p.step))},(_,i)=>r.from+i*p.step)))].sort((a,b)=>a-b);
}
export function clock(n:number){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
export function days(p:Poll){if(p.dailyRanges)return [...new Set(p.dailyRanges.map(r=>r.date))].sort();if(p.mode==='week')return weekdays.map((_,i)=>`w${i}`);if(p.mode==='month')return Array.from({length:31},(_,i)=>`m${i+1}`);let out:string[]=[];for(let s=p.start;s<=p.end;s=add(s,1)){out.push(s);if(out.length>62)break;}return out;}
const dayFormatter=new Intl.DateTimeFormat("es-CL",{weekday:"short",day:"numeric",month:"short"});
export function dayLabel(p:Poll,k:string){return p.mode==='week'?weekdays[Number(k.slice(1))]:p.mode==='month'?`Día ${k.slice(1)} de cada mes`:dayFormatter.format(date(k));}
export function slotLabel(p:Poll,k:string,duration=p.step){const [d,t]=k.split('@');return `${dayLabel(p,d)}, ${clock(Number(t))}–${clock(Number(t)+duration)}`;}
export function validKeys(p:Poll){return new Set(days(p).flatMap(d=>times(p,d).map(t=>`${d}@${t}`)));}
export function meetingStatus(p:Poll,v:Vote,key:string):Status|undefined{const [d,t]=key.split('@');const states=Array.from({length:(p.duration||p.step)/p.step},(_,i)=>v.slots[`${d}@${Number(t)+i*p.step}`]);if(states.includes('no'))return 'no';if(states.some(s=>!s))return undefined;return states.includes('maybe')?'maybe':'yes';}
export function meetingFits(p:Poll,key:string,keys=validKeys(p)){const [d,t]=key.split('@');return Array.from({length:(p.duration||p.step)/p.step},(_,i)=>`${d}@${Number(t)+i*p.step}`).every(k=>keys.has(k));}
export function rank(p:Poll,votes:Vote[]){
 const width=(p.duration||p.step)/p.step;
 const results:{key:string;yes:number;maybe:number;no:number;missing:number}[]=[];
 for(const day of days(p)){
  const minutes=times(p,day),keys=minutes.map(t=>`${day}@${t}`);
  const rows=keys.map(key=>({key,yes:0,maybe:0,no:0,missing:0}));
  const fits=minutes.map((t,i)=>i+width<=minutes.length&&minutes[i+width-1]===t+(width-1)*p.step);
  for(const vote of votes){
   let no=0,maybe=0,missing=0;
   const adjust=(i:number,delta:number)=>{const status=vote.slots[keys[i]];if(status==='no')no+=delta;else if(status==='maybe')maybe+=delta;else if(!status)missing+=delta;};
   for(let i=0;i<minutes.length;i++){
    adjust(i,1);if(i>=width)adjust(i-width,-1);
    const start=i-width+1;if(start<0||!fits[start])continue;
    const row=rows[start];if(no)row.no++;else if(missing)row.missing++;else if(maybe)row.maybe++;else row.yes++;
   }
  }
  for(let i=0;i<rows.length;i++)if(fits[i]&&rows[i].yes+rows[i].maybe>0)results.push(rows[i]);
 }
 return results.sort((a,b)=>a.no-b.no||a.missing-b.missing||b.yes-a.yes||b.maybe-a.maybe||a.key.localeCompare(b.key));
}
