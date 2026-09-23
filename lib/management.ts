import {z} from 'zod';
import {hash,type CreatorMailer} from './api';
import type {Poll} from './domain';
import type {Store} from './store';
export type GroupMailer=(poll:Poll,emails:string[],subject:string,message:string,key:string)=>Promise<void>;
const tokenShape=z.string().regex(/^[a-f0-9]{64}$/);
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function manage(request:Request,store:Store,id:string,mailAccess?:CreatorMailer,mailGroup?:GroupMailer){
 try{
  if(request.method!=='POST')return reply({error:'Operación no disponible.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origen no permitido.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'Formato no permitido.'},415);
  const raw=await request.text();if(raw.length>12000)return reply({error:'Mensaje demasiado largo.'},413);
  const body=JSON.parse(raw);const poll=await store.getPoll(id);
  if(body.action==='request-access'){
   if(!poll?.creator?.email)return reply({error:'Esta consulta no tiene un correo de creador registrado.'},400);
   if(!mailAccess||!store.creatorAccess)return reply({error:'El envío de correo no está disponible.'},503);
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   if(!await store.creatorAccess(id,await hash(token)))return reply({error:'Ya se solicitó un enlace recientemente. Revisa el correo del creador o espera cinco minutos.'},429);
   await mailAccess(poll,token);return reply({message:'Enviamos un nuevo enlace privado al correo del creador. Los enlaces privados anteriores dejan de funcionar.'});
  }
  const token=tokenShape.parse(body.token);if(!poll||!poll.manageHash||await hash(token)!==poll.manageHash)return reply({error:'El enlace privado no es válido. Solicita uno nuevo desde la consulta.'},403);
  if(body.action==='view'){const {manageHash,...safe}=poll;return reply({poll:safe,votes:await store.getVotes(id)});}
  if(body.action==='close'||body.action==='notifications'){
   const value=body.action==='notifications'?z.boolean().parse(body.notify):undefined;
   const updated=await store.managePoll?.(id,poll.manageHash,body.action,value);if(!updated)return reply({error:'No se pudo actualizar la consulta.'},409);
   const {manageHash,...safe}=updated;return reply({poll:safe});
  }
  if(body.action==='send'){
   if(!poll.closed)return reply({error:'Cierra los registros antes de notificar al grupo.'},409);
   if(!mailGroup)return reply({error:'El envío de correo no está disponible.'},503);
   const input=z.object({subject:z.string().trim().min(1).max(180).regex(/^[^\r\n]+$/),message:z.string().trim().min(1).max(5000),requestId:z.string().uuid()}).parse(body);
   const votes=await store.getVotes(id);const emails=[...new Set(votes.map(v=>v.email?.trim().toLowerCase()).filter((email):email is string=>!!email&&z.string().email().safeParse(email).success))].sort();
   if(!emails.length)return reply({error:'No hay participantes con correo registrado.'},400);
   await mailGroup(poll,emails,input.subject,input.message,await hash(id+input.requestId+input.subject+input.message));
   return reply({sent:emails.length});
  }
  return reply({error:'Operación no disponible.'},400);
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return reply({error:'Revisa los campos y el enlace de acceso.'},400);return reply({error:'No se completó el envío o la operación. Puedes reintentar; se evitarán duplicados del mismo envío.'},503);}
}
