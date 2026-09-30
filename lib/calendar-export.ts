import {pollPath} from './links';
import {validMeetingSelection} from './selected-meeting';
import {add,meetingFits,type Poll} from './domain';

const text=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line:string){
  const encoder=new TextEncoder();let out='',length=0;
  for(const char of line){const size=encoder.encode(char).length;if(length+size>75){out+='\r\n ';length=1;}out+=char;length+=size;}
  return out;
}
// Convert the meeting's wall clock to UTC, independent of the viewer's timezone.
export function zonedInstant(day:string,minutes:number,timezone:string):Date{
  if(minutes===1440){day=add(day,1);minutes=0;}
  const [year,month,date]=day.split('-').map(Number);
  const wall=Date.UTC(year,month-1,date,Math.floor(minutes/60),minutes%60);
  const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const local=(ms:number)=>{const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);};
  const offsets=new Set([-2,-1,0,1,2].map(n=>{const t=wall+n*86400000;return local(t)-t;}));
  const matches=[...offsets].map(offset=>wall-offset).filter(t=>local(t)===wall).sort((a,b)=>a-b);
  if(!matches.length)throw Error('Ese horario no existe en esta zona horaria por el cambio de hora. Elige otro bloque.');
  return new Date(matches[0]);
}
const stamp=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendarEvent(poll:Poll,key:string,link:string,now=new Date()):string{
  if(poll.mode!=='dates'||!meetingFits(poll,key))throw Error('Selecciona un horario con una fecha concreta.');
  const [day,minute]=key.split('@');
  const start=zonedInstant(day,+minute,poll.timezone),end=zonedInstant(day,+minute+(poll.duration||poll.step),poll.timezone);
  if(end<=start)throw Error('El bloque coincide con un cambio de hora. Elige otro horario.');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//at meet//Horarios compartidos//ES','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    `UID:${poll.id}-${day}-${minute}@atmeet.netlify.app`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,
    `SUMMARY:${text(poll.title)}`,`DESCRIPTION:${text('Horario propuesto en at meet. Zona horaria: '+poll.timezone+'\nConsulta: '+link)}`,
    'STATUS:TENTATIVE','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}

export function confirmedCalendar(poll:Poll,link:string,message=''){
 if(!poll.selectedSlot||!validMeetingSelection(poll,poll.selectedSlot,poll.selectedDate))throw Error('Confirma una fecha y un horario válidos antes de compartir el evento.');
 const [day,minute]=poll.selectedSlot.split('@'),concreteDay=poll.mode==='dates'?day:poll.selectedDate!;
 const concrete:Poll={...poll,mode:'dates',start:concreteDay,end:concreteDay,dailyRanges:poll.dailyRanges?.filter(r=>r.date===day).map(r=>({...r,date:concreteDay}))};
 const start=zonedInstant(concreteDay,+minute,poll.timezone),end=zonedInstant(concreteDay,+minute+(poll.duration||poll.step),poll.timezone);
 if(end<=start)throw Error('El horario coincide con un cambio de hora.');
 const google=new URL('https://calendar.google.com/calendar/render');
 google.search=new URLSearchParams({action:'TEMPLATE',text:poll.title,dates:stamp(start)+'/'+stamp(end),ctz:poll.timezone,details:message+'\nConsulta: '+link}).toString();
 const ics=calendarEvent(concrete,concreteDay+'@'+minute,link,new Date(poll.closedAt||poll.created)).replace('STATUS:TENTATIVE','STATUS:CONFIRMED');
 return {google:google.href,ics};
}
export async function downloadConfirmedCalendar(request:Request,store:{getPoll:(id:string)=>Promise<Poll|undefined|null>},id:string){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 const poll=await store.getPoll(id);
 if(!poll?.closed||!poll.selectedSlot)return new Response('Evento confirmado no disponible.',{status:404});
 try{const url=new URL(request.url),slot=url.searchParams.get('slot'),day=url.searchParams.get('date');
 const snapshot=slot?{...poll,selectedSlot:slot,selectedDate:day||undefined}:poll;
 const {ics}=confirmedCalendar(snapshot,new URL(pollPath(poll),request.url).href);
 return new Response(ics,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="encuentro.ics"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Fecha u horario inválido.',{status:400});}
}
