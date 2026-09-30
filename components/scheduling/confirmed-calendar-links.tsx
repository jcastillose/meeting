"use client";
import {confirmedCalendar} from '@/lib/calendar-export';
import {pollPath} from '@/lib/links';
import type {Poll} from '@/lib/domain';
/** Preview the same event and download route included in the participant email. */
export function ConfirmedCalendarLinks({poll,message}:{poll:Poll;message:string}){
 if(!poll.selectedSlot)return null;
 try{
  const calendar=confirmedCalendar(poll,new URL(pollPath(poll),location.origin).href,message);
  const download=new URL('/api/polls/'+poll.id+'/calendar',location.origin);
  download.searchParams.set('slot',poll.selectedSlot);if(poll.selectedDate)download.searchParams.set('date',poll.selectedDate);
  return <div className="hint"><p>Estos enlaces se incluirán en el correo:</p><div className="row"><a target="_blank" rel="noopener noreferrer" href={calendar.google}>Añadir a Google Calendar ↗</a><a href={download.href}>Calendario de macOS (.ics)</a></div><p className="small muted">Cada persona debe confirmar la incorporación en su calendario.</p></div>;
 }catch{return <p role="alert" className="error">El evento no tiene una fecha y un horario válidos. Confírmalo nuevamente antes de enviar.</p>;}
}
