import type {VoteNotifier} from './api';
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
  async access(poll:import('./domain').Poll,token:string){
   const {managementPath}=await import('./api');
   await send('/emails',{from:config.from,to:[poll.creator!.email],subject:`at meet · Gestiona tu consulta: ${poll.title.replace(/[\r\n]/g,' ')}`,text:`Hola, ${poll.creator!.name}:\n\nEste enlace privado permite cerrar los registros y enviar un mensaje a quienes respondieron:\n${new URL(managementPath(poll.id,token),config.siteUrl).href}\n\nGuárdalo y no lo compartas con participantes.\n\nPara compartir la consulta, usa este otro enlace:\n${new URL(pollPath(poll),config.siteUrl).href}\n\nLos avisos de nuevas respuestas están ${poll.creator!.notify===false?'desactivados':'activados'}. Puedes cambiarlo en la gestión de la consulta.`},`creator-access/${poll.id}/${token}`);
  },
  async group(poll:import('./domain').Poll,emails:string[],subject:string,message:string,key:string){
   for(let offset=0;offset<emails.length;offset+=100){
    const batch=emails.slice(offset,offset+100).map(email=>({from:config.from,to:[email],subject:`at meet · ${subject}`,text:`${poll.creator?.name||'Quien organiza'} envía este mensaje sobre «${poll.title}»:\n\n${message}\n\nConsulta cerrada: ${new URL(pollPath(poll),config.siteUrl).href}\n\nRecibes este correo porque registraste tu disponibilidad en esta consulta.`}));
    await send('/emails/batch',batch,`meeting-message/${key}/${offset}`);
   }
  }
 };
}
