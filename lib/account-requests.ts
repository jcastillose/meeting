import {z} from 'zod';
type Rest=(path:string,method?:string,body?:unknown)=>Promise<any>;
type Mailer=(kind:'invite'|'reset',email:string,url:string,key:string)=>Promise<void>;
const submission=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),message:z.string().trim().max(1000).default(''),website:z.string().max(200).optional()});
export async function submitAccountRequest(body:unknown,rest:Rest){
 const input=submission.safeParse(body);
 if(!input.success)return {status:400,data:{error:'Indica tu nombre y un correo válido. El mensaje puede tener hasta 1.000 caracteres.'}};
 if(!input.data.website)await rest('rpc/meeting_request_account','POST',{p_name:input.data.name,p_email:input.data.email,p_message:input.data.message});
 return {status:202,data:{message:'Solicitud recibida. Administración revisará el acceso; si lo aprueba, recibirás una invitación por correo. Si ya tienes cuenta, utiliza la recuperación de contraseña.'}};
}
export async function reviewAccountRequests(path:string,method:string,body:unknown,url:URL,user:{id:string},role:string|null,rest:Rest,mailer?:Mailer){
 if(role!=='admin')return {status:403,data:{error:'Solo administración puede revisar solicitudes.'}};
 if(path==='account-requests'&&method==='GET'){
  const offset=z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('offset')||0);
  const rows=await rest(`meeting_account_requests?status=eq.pending&select=id,name,email,message,created_at&order=created_at.asc,id.asc&limit=26&offset=${offset}`);
  return {status:200,data:{requests:rows.slice(0,25),hasMore:rows.length>25}};
 }
 if(path==='review-request'&&method==='POST'){
  const input=z.object({id:z.string().uuid(),decision:z.enum(['approve','reject']),role:z.enum(['manager','admin']).default('manager')}).parse(body);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
  const result=await rest('rpc/meeting_review_request','POST',{p_user:user.id,p_id:input.id,p_decision:input.decision,p_role:input.role,p_hash:hash});
  if(!result)return {status:409,data:{error:'La solicitud ya fue revisada o el correo ya tiene cuenta. Actualiza la lista.'}};
  if(input.decision==='reject')return {status:200,data:{message:'Solicitud rechazada.'}};
  const invitationUrl=url.origin+'/admin#invite='+token;
  let emailSent=false;
  if(mailer){try{await mailer('invite',result.email,invitationUrl,'admin-invite/'+hash);emailSent=true;}catch{console.error('Account approval invitation delivery failed');}}
  return {status:200,data:{url:invitationUrl,emailSent,message:emailSent?'Solicitud aprobada e invitación enviada.':'Solicitud aprobada. No se pudo enviar el correo; comparte el enlace privado con la persona solicitante.'}};
 }
 return {status:405,data:{error:'Operación no disponible.'}};
}
