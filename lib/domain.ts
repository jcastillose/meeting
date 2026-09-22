export type Mode = "dates"|"week"|"month";
export type Status = "yes"|"maybe"|"no";
export type Poll = {id:string; title:string; mode:Mode; start:string; end:string; from:number; to:number; step:number; duration?:number; timezone:string; created:string};
export type Vote = {id:string; name:string; comment:string; slots:Record<string,Status>};
export const weekdays=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
export const modes={dates:"Fechas concretas",week:"Semana habitual",month:"Días habituales del mes"};
export const statuses={yes:"Disponible",maybe:"Si hace falta",no:"Ocupado"};
export function iso(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
export function date(s:string){return new Date(s+"T12:00:00");}
export function add(s:string,n:number){const d=date(s);d.setDate(d.getDate()+n);return iso(d);}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function times(p:Poll){return Array.from({length:(p.to-p.from)/p.step},(_,i)=>p.from+i*p.step);}
export function clock(n:number){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
export function days(p:Poll){if(p.mode==='week')return weekdays.map((_,i)=>`w${i}`);if(p.mode==='month')return Array.from({length:31},(_,i)=>`m${i+1}`);let out:string[]=[];for(let s=p.start;s<=p.end;s=add(s,1)){out.push(s);if(out.length>62)break;}return out;}
export function dayLabel(p:Poll,k:string){return p.mode==='week'?weekdays[Number(k.slice(1))]:p.mode==='month'?`Día ${k.slice(1)} de cada mes`:date(k).toLocaleDateString('es-CL',{weekday:'short',day:'numeric',month:'short'});}
export function slotLabel(p:Poll,k:string,duration=p.step){const [d,t]=k.split('@');return `${dayLabel(p,d)}, ${clock(Number(t))}–${clock(Number(t)+duration)}`;}
export function validKeys(p:Poll){return new Set(days(p).flatMap(d=>times(p).map(t=>`${d}@${t}`)));}
export function meetingStatus(p:Poll,v:Vote,key:string):Status|undefined{const [d,t]=key.split('@');const states=Array.from({length:(p.duration||p.step)/p.step},(_,i)=>v.slots[`${d}@${Number(t)+i*p.step}`]);if(states.includes('no'))return 'no';if(states.some(s=>!s))return undefined;return states.includes('maybe')?'maybe':'yes';}
export function rank(p:Poll,votes:Vote[]){return [...validKeys(p)].filter(key=>Number(key.split('@')[1])+(p.duration||p.step)<=p.to).map(key=>{let yes=0,maybe=0,no=0;for(const v of votes){const status=meetingStatus(p,v,key);if(status==='yes')yes++;if(status==='maybe')maybe++;if(status==='no')no++;}return {key,yes,maybe,no,missing:votes.length-yes-maybe-no};}).filter(x=>x.yes+x.maybe>0).sort((a,b)=>a.no-b.no||a.missing-b.missing||b.yes-a.yes||b.maybe-a.maybe||a.key.localeCompare(b.key));}
