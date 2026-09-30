import {confirmedCalendar} from './calendar-export';
import {selectedMeetingLabel} from './selected-meeting';
import type {VoteNotifier} from './api';
import {clock,dayLabel,days} from './domain';
import {pollPath} from './links';

/** Server-only sender. Contact details never enter public responses. */
export function resendNotifier(config:{apiKey:string;from:string;siteUrl:string},fetcher:typeof fetch=fetch):VoteNotifier{
 return async(poll,vote,previous,eventKey)=>{
  if(!poll.creator?.email)return;
  const url=new URL(pollPath(poll),config.siteUrl).href;
  const counts={yes:0,maybe:0,no:0};
  for(const status of Object.values(vote.slots))counts[status]++;
  const action=previous?'actualizó':'registró';
  const body=JSON.stringify({from:config.from,to:[poll.creator.email],subject:`at meet · Nueva disponibilidad en ${poll.title.replace(/[\r\n]/g,' ')}`,text:[
   `Hola, ${poll.creator.name}:`,
   '',`${vote.name} ${action} su disponibilidad para «${poll.title}».`,
   '',`Disponible: ${counts.yes} bloques`, `Si hace falta: ${counts.maybe} bloques`, `Ocupado: ${counts.no} bloques`,
   ...(vote.comment?['',`Comentario: ${vote.comment}`]:[]),
   '',`Revisa las preferencias y coincidencias: ${url}`,
   '', 'at meet · Registro de disponibilidad'
  ].join('\n')});
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`availability/${eventKey}`},body,signal:AbortSignal.timeout(5000)});
    if(response.ok)return;
    if(response.status!==429&&response.status<500)throw new PermanentDeliveryError();
   }catch(error){if(error instanceof PermanentDeliveryError||attempt===2)throw Error('Email delivery failed');}
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
  }
  throw Error('Email delivery failed');
 };
}
const escapeHtml=(value:string)=>value.replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]!));
class PermanentDeliveryError extends Error{}

export function managementMailer(config:{apiKey:string;from:string;siteUrl:string},fetcher:typeof fetch=fetch){
 async function send(path:string,payload:unknown,key:string){
  for(let attempt=0;attempt<3;attempt++){
   try{const response=await fetcher('https://api.resend.com'+path,{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});
    if(response.ok)return;if(response.status<500&&response.status!==429)throw new PermanentDeliveryError();
   }catch(e){if(e instanceof PermanentDeliveryError||attempt===2)throw Error('Email failed');}
   if(attempt<2)await new Promise(r=>setTimeout(r,500*2**attempt));
  }throw Error('Email failed');
 }
 return {
  async admin(kind:'invite'|'reset',email:string,url:string,key:string){
   const reset=kind==='reset';
   await send('/emails',{from:config.from,to:[email],subject:reset?'at meet · Recupera tu contraseña':'at meet · Invitación de cuenta',text:[
    reset?'Recibimos una solicitud para recuperar tu contraseña de at meet.':'Has recibido una invitación para acceder a at meet.',
    reset?'Define una nueva contraseña mediante este enlace privado:':'Activa tu cuenta y define tu contraseña mediante este enlace privado:',url,
    reset?'El enlace vence en 30 minutos y solo puede usarse una vez. Al cambiar la contraseña se cerrarán tus sesiones anteriores.':'El enlace vence en 7 días y solo puede usarse una vez. Usa el correo al que recibiste esta invitación. Los permisos dependen del tipo de cuenta asignado: administración o gestión.',
    reset?'Si no solicitaste este cambio, ignora este mensaje. Tu contraseña actual seguirá funcionando.':'Si no esperabas esta invitación, puedes ignorarla.',
    'No compartas este enlace.'
   ].join('\n\n')},key);
  },
  async schedule(poll:import('./domain').Poll,email:string,key:string){
   const ranges=poll.dailyRanges||days(poll).map(date=>({date,from:poll.from,to:poll.to}));
   await send('/emails',{from:config.from,to:[email],subject:`at meet · Cambiaron las propuestas de ${poll.title.replace(/[\r\n]/g,' ')}`,text:[
    `${poll.creator?.name||'Quien organiza'} actualizó los días u horarios propuestos para «${poll.title}».`,
    'Revisa las nuevas propuestas y actualiza tu disponibilidad. Tus preferencias en los bloques que se mantienen se conservaron. Los bloques retirados ya no se consideran; los nuevos están sin responder.',
    'Propuestas actuales:',...ranges.map(r=>dayLabel(poll,r.date)+': '+clock(r.from)+'–'+clock(r.to)),
    'Duración: '+(poll.duration||poll.step)+' minutos · Zona horaria: '+poll.timezone,
    'Revisar consulta: '+new URL(pollPath(poll),config.siteUrl).href,
    'Los registros están abiertos. Si la consulta tenía un horario confirmado, esa confirmación fue retirada; recibirás un nuevo aviso cuando se defina el encuentro.',
    'Recibes este correo porque registraste tus opciones en esta consulta.'
   ].join('\n\n')},key);
  },
  async requestAccount(email:string,input:{id:string;name:string;email:string;message:string},key:string){
   await send('/emails',{from:config.from,to:[email],subject:'at meet · Nueva solicitud de cuenta',text:[
    'Se recibió una nueva solicitud de cuenta.', 'Nombre: '+input.name,'Correo: '+input.email,
    ...(input.message?['Mensaje: '+input.message]:[]),
    'Revisa la solicitud y asigna acceso de gestión o administración: '+new URL('/admin',config.siteUrl).href,
    'La solicitud no concede acceso por sí sola.'
   ].join('\n\n')},key);
  },
  async access(poll:import('./domain').Poll,token:string){
   const {managementPath}=await import('./api');
   await send('/emails',{from:config.from,to:[poll.creator!.email],subject:`at meet · Gestiona tu consulta: ${poll.title.replace(/[\r\n]/g,' ')}`,text:`Hola, ${poll.creator!.name}:\n\nEste enlace privado permite cerrar los registros y enviar un mensaje a quienes respondieron:\n${new URL(managementPath(poll.id,token),config.siteUrl).href}\n\nGuárdalo y no lo compartas con participantes.\n\nPara compartir la consulta, usa este otro enlace:\n${new URL(pollPath(poll),config.siteUrl).href}\n\nLos avisos de nuevas respuestas están ${poll.creator!.notify===false?'desactivados':'activados'}. Puedes cambiarlo en la gestión de la consulta.`},`creator-access/${poll.id}/${token}`);
  },
  async group(poll:import('./domain').Poll,emails:string[],subject:string,message:string,key:string){
   const link=new URL(pollPath(poll),config.siteUrl).href;
   const calendar=poll.selectedSlot?confirmedCalendar(poll,link,message):undefined;
   const calendarDownload=new URL('/api/polls/'+poll.id+'/calendar',config.siteUrl);
   if(poll.selectedSlot)calendarDownload.searchParams.set('slot',poll.selectedSlot);
   if(poll.selectedDate)calendarDownload.searchParams.set('date',poll.selectedDate);
   const calendarUrl=calendarDownload.href;
   const text=`${poll.creator?.name||'Quien organiza'} envía este mensaje sobre «${poll.title}»:\n\n${poll.selectedSlot?'Horario seleccionado: '+selectedMeetingLabel(poll)+'\n\n':''}${message}\n\nConsulta cerrada: ${link}`+(calendar?`\n\nAñadir a Google Calendar: ${calendar.google}\nAñadir a Calendario de macOS (.ics): ${calendarUrl}`:'')+'\n\nRecibes este correo porque registraste tu disponibilidad en esta consulta.';
   const html=`<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#253a34;background:#f4f7f5;padding:24px"><main style="max-width:560px;margin:auto;background:white;border-radius:16px;padding:28px"><p>at meet · ${calendar?'Encuentro confirmado':'Mensaje del encuentro'}</p><h1 style="font-size:24px">${escapeHtml(poll.title)}</h1>${calendar?`<p style="padding:16px;background:#edf5f1;border-radius:12px"><strong>${escapeHtml(selectedMeetingLabel(poll))}</strong></p>`:''}<p style="white-space:pre-wrap">${escapeHtml(message).replace(/\n/g,'<br>')}</p>${calendar?`<p><a href="${escapeHtml(calendar.google)}" style="display:inline-block;padding:12px 18px;background:#28634e;color:white;border-radius:8px;text-decoration:none">Añadir a Google Calendar</a></p><p><a href="${escapeHtml(calendarUrl)}" style="display:inline-block;padding:12px 18px;border:1px solid #28634e;color:#28634e;border-radius:8px;text-decoration:none">Añadir a Calendario de macOS</a></p><p>Abre el archivo .ics en Calendario y confirma su incorporación.</p>`:''}<p><a href="${escapeHtml(link)}">Ver consulta</a></p><p style="font-size:12px;color:#59655f">Recibes este correo porque registraste tu disponibilidad. Las direcciones de las demás personas no se comparten.</p></main></body></html>`;
   for(let offset=0;offset<emails.length;offset+=100){
    const batch=emails.slice(offset,offset+100).map(email=>({from:config.from,to:[email],subject:`at meet · ${subject}`,text,html}));
    await send('/emails/batch',batch,`meeting-message/${key}/${offset}`);
   }
  }
 };
}
