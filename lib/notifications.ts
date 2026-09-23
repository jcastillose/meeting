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
