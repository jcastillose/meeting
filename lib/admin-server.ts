import {notifyScheduleChanges,type ScheduleMailer} from './schedule-notifications';
import {validKeys} from './domain';
import {notifyAccountRequests,type RequestMailer} from './request-notifications';
import {submitAccountRequest,reviewAccountRequests} from './account-requests';
import {extendSchedule,replaceSchedule} from './schedule-extension';
import {z} from 'zod';

const credentials=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase().trim()),password:z.string().min(1).max(128)});
const inviteToken=z.string().regex(/^[a-f0-9]{64}$/);
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
type AdminUser={id:string;email?:string;updated_at?:string;banned_until?:string;app_metadata?:Record<string,unknown>};

const accountRole=(user:AdminUser)=>user?.app_metadata?.meeting_admin===true?'admin':user?.app_metadata?.meeting_role==='manager'?'manager':null;
export type AdminMailer=(kind:'invite'|'reset',email:string,url:string,key:string)=>Promise<void>;
export type InvitationMailer=AdminMailer;
export function adminHandler(url:string,key:string,fetcher:typeof fetch=fetch,mailer?:InvitationMailer,requestMailer?:RequestMailer,scheduleMailer?:ScheduleMailer){
  const root=url.replace(/\/$/,'');
  async function call(path:string,method='GET',body?:unknown,bearer=key){
    const r=await fetcher(root+path,{method,headers:{apikey:key,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.text();
    if(!r.ok)throw new HttpError(r.status>=500?503:400,'No se pudo completar la operación. Revisa los datos e inténtalo nuevamente.');
    return data?JSON.parse(data):null;
  }
  const rest=(path:string,method='GET',body?:unknown)=>call('/rest/v1/'+path,method,body);
  const syncAccount=(user:AdminUser)=>rest('rpc/meeting_sync_account','POST',{p_user:user.id,p_email:user.email,p_role:accountRole(user),p_version:user.updated_at||''});
  const notifyRequests=(email?:string)=>notifyAccountRequests(rest,async()=>{
    const rows=await rest('meeting_accounts?role=eq.admin&select=user_id');
    const emails:string[]=[];
    for(const row of rows){const user:AdminUser=await call('/auth/v1/admin/users/'+encodeURIComponent(row.user_id));if(accountRole(user)==='admin'&&user.email&&(!user.banned_until||new Date(user.banned_until).getTime()<=Date.now()))emails.push(user.email.toLowerCase());}
    return emails;
  },requestMailer,email);
  return async function handler(request:Request):Promise<Response>{
    const current=new URL(request.url),secure=current.protocol==='https:',cookieName=secure?'__Host-meeting-admin':'meeting-admin';
    const responseHeaders=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:responseHeaders});
    const cookie=(value:string,age:number)=>responseHeaders.append('Set-Cookie',`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`);
    let issuedSession:string|undefined;
    async function session(user:AdminUser){
      const token=secret();issuedSession=await digest(token);
      await rest('meeting_admin_sessions','POST',{token_hash:issuedSession,user_id:user.id,expires_at:new Date(Date.now()+8*3600000).toISOString()});
      await syncAccount(user);
      cookie(token,8*3600);
    }
    async function signedIn(){
      const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if(!raw||!inviteToken.safeParse(raw).success)throw new HttpError(401,'Inicia sesión para acceder a la administración.');
      const hash=await digest(raw);
      const rows=await rest(`meeting_admin_sessions?token_hash=eq.${hash}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id`);
      if(!rows?.[0])throw new HttpError(401,'Tu sesión terminó. Vuelve a iniciar sesión.');
      const user:AdminUser=await call('/auth/v1/admin/users/'+encodeURIComponent(rows[0].user_id));
      if(!accountRole(user))throw new HttpError(403,'Esta cuenta no tiene acceso de administración.');
      await syncAccount(user);
      return {user,hash};
    }
    try{
      if(request.headers.get('X-Atmeet-Notice-Worker')===key){try{await notifyRequests();}catch{console.error('Request notice retry pending');}await notifyScheduleChanges(rest,scheduleMailer);return reply({processed:true});}
      const path=current.pathname.replace(/^\/api\/admin\/?/,'');
      if(request.method!=='GET'){
        if(request.headers.get('origin')!==current.origin)throw new HttpError(403,'Origen no permitido.');
        if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'Formato no permitido.');
      }
      let body:unknown={};
      if(request.method==='POST'){
        const raw=await request.text();if(raw.length>40000)throw new HttpError(413,'Solicitud demasiado grande.');
        try{body=JSON.parse(raw);}catch{throw new HttpError(400,'Formato no permitido.');}
      }
      if(path==='request-account'&&request.method==='POST'){const result=await submitAccountRequest(body,rest);if(result.status===202&&!(body as {website?:string}).website){try{await notifyRequests((body as {email:string}).email.trim().toLowerCase());}catch{console.error('Account request saved; notice pending');}}return reply(result.data,result.status);}
      if(path==='forgot-password'&&request.method==='POST'){
        const {email}=credentials.pick({email:true}).parse(body);
        if(!mailer)throw new HttpError(503,'El envío de correos no está disponible.');
        const generic={message:'Si existe una cuenta activa con ese correo, recibirás un enlace para recuperar tu contraseña.'};
        const accounts=await rest(`meeting_accounts?email=eq.${encodeURIComponent(email)}&select=user_id`);
        if(!accounts?.[0])return reply(generic);
        const user:AdminUser=await call('/auth/v1/admin/users/'+encodeURIComponent(accounts[0].user_id));
        if(!accountRole(user))return reply(generic);
        await syncAccount(user);
        const token=secret(),hash=await digest(token);
        const issued=await rest('rpc/meeting_issue_reset','POST',{p_email:email,p_hash:hash});
        if(issued){try{await mailer('reset',email,current.origin+'/admin#reset='+token,'account-reset/'+hash);}catch{console.error('Account recovery email delivery failed');}}
        return reply({message:'Si existe una cuenta activa con ese correo, recibirás un enlace para recuperar tu contraseña.'});
      }
      if(path==='reset-password'&&request.method==='POST'){
        const input=z.object({token:inviteToken,password:z.string().min(12).max(128)}).parse(body);
        const tokenHash=await digest(input.token);
        const resets=await rest(`meeting_password_resets?token_hash=eq.${tokenHash}&select=user_id,password_snapshot`);
        if(!resets?.[0])throw new HttpError(400,'El enlace no es válido, ha vencido o ya fue utilizado. Solicita uno nuevo.');
        const user:AdminUser=await call('/auth/v1/admin/users/'+encodeURIComponent(resets[0].user_id));
        if(!accountRole(user)||(user.updated_at||'')!==resets[0].password_snapshot)throw new HttpError(400,'El enlace ya no es válido. Solicita uno nuevo.');
        await syncAccount(user);
        const uid=await rest('rpc/meeting_claim_reset','POST',{p_hash:await digest(input.token)});
        if(!uid)throw new HttpError(400,'El enlace no es válido, ha vencido o ya fue utilizado. Solicita uno nuevo.');
        await call('/auth/v1/admin/users/'+encodeURIComponent(uid),'PUT',{password:input.password});
        await rest(`meeting_admin_sessions?user_id=eq.${uid}`,'DELETE');
        cookie('',0);return reply({ok:true});
      }
      if(path==='login'&&request.method==='POST'){
        const input=credentials.parse(body);
        let auth;
        try{auth=await call('/auth/v1/token?grant_type=password','POST',input);}catch{throw new HttpError(401,'Correo o contraseña incorrectos.');}
        const user:AdminUser=auth.user;
        // The Supabase token never leaves the server. Our opaque session is revocable.
        await call('/auth/v1/logout?scope=local','POST',undefined,auth.access_token);
        if(!accountRole(user))throw new HttpError(403,'Esta cuenta no tiene acceso de administración.');
        await session(user);return reply({id:user.id,email:user.email,role:accountRole(user)});
      }
      if(path==='accept'&&request.method==='POST'){
        const input=credentials.extend({token:inviteToken,password:z.string().min(12).max(128)}).parse(body);
        const hash=await digest(input.token),claim=crypto.randomUUID();
        // Verify the recipient before atomically consuming the invitation.
        const invitations=await rest(`meeting_admin_invitations?token_hash=eq.${hash}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=email`);
        if(!invitations?.[0]||(invitations[0].email&&invitations[0].email!==input.email))throw new HttpError(400,'La invitación no es válida, ha vencido o corresponde a otro correo.');
        const claimed=await rest('rpc/meeting_claim_account_invitation','POST',{p_hash:hash,p_claim:claim});
        if(!claimed?.[0])throw new HttpError(400,'La invitación ya fue utilizada o venció.');
        let user:AdminUser;
        try{
          user=await call('/auth/v1/admin/users','POST',{email:input.email,password:input.password,email_confirm:true,app_metadata:{meeting_admin:claimed[0].role==='admin',meeting_role:claimed[0].role}});
        }catch{
          await rest(`meeting_admin_invitations?token_hash=eq.${hash}&claim_id=eq.${claim}`,'PATCH',{used_at:null,claim_id:null});
          throw new HttpError(400,'No se pudo crear la cuenta. Puede que el correo ya esté registrado o la contraseña no cumpla los requisitos.');
        }
        await session(user);return reply({id:user.id,email:user.email,role:accountRole(user)},201);
      }
      if(path==='logout'&&request.method==='POST'){
        const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
        if(raw&&inviteToken.safeParse(raw).success)await rest(`meeting_admin_sessions?token_hash=eq.${await digest(raw)}`,'DELETE');
        cookie('',0);return reply({ok:true});
      }
      const {user}=await signedIn();
      if(path==='account-requests'||path==='review-request'){const result=await reviewAccountRequests(path,request.method,body,current,user,accountRole(user),rest,mailer);return reply(result.data,result.status);}
      if(path==='me'&&request.method==='GET')return reply({id:user.id,email:user.email,role:accountRole(user)});
      if(path==='history'&&request.method==='GET'){
        const offset=z.coerce.number().int().min(0).max(1000000).parse(current.searchParams.get('offset')||0);
        const search=z.string().max(120).parse(current.searchParams.get('search')||'');
        return reply(await rest('rpc/meeting_account_history','POST',{p_user:user.id,p_offset:offset,p_search:search}));
      }
      if(path==='edit-poll'&&request.method==='POST'){
        const input=z.object({id:z.string().regex(/^p_[a-f0-9]{32}$/),revision:z.number().int().min(0),ranges:z.array(z.object({date:z.string(),from:z.number(),to:z.number()})).max(256).optional(),from:z.number().optional(),to:z.number().optional(),notifyParticipants:z.boolean().default(true),reopen:z.boolean().default(false)}).parse(body);
        const rows=await rest(`polls?id=eq.${input.id}&select=data`),poll=rows?.[0]?JSON.parse(rows[0].data):null;
        if(!poll||(accountRole(user)!=='admin'&&poll.ownerId!==user.id))throw new HttpError(404,'Consulta no disponible para esta cuenta.');
        if((poll.scheduleRevision||0)!==input.revision)throw new HttpError(409,'La consulta cambió. Actualiza el historial antes de editar.');
        if(poll.closed&&!input.reopen)throw new HttpError(400,'Confirma la reapertura de registros para cambiar las propuestas.');
        let patch;try{patch=replaceSchedule(poll,input);}catch(e){throw new HttpError(400,(e as Error).message);}
        const before=validKeys(poll),after=validKeys({...poll,...patch});
        if(before.size===after.size&&[...before].every(k=>after.has(k)))throw new HttpError(400,'No hay cambios en los bloques propuestos.');
        const updated=await rest('rpc/meeting_edit_schedule','POST',{p_user:user.id,p_id:input.id,p_revision:input.revision,p_patch:patch,p_keys:[...after],p_notify:input.notifyParticipants,p_reopen:input.reopen});
        if(!updated)throw new HttpError(409,'La consulta cambió o ya no está disponible. Actualiza el historial.');
        let notificationWarning;
        if(input.notifyParticipants){try{if(!scheduleMailer)throw Error('Mailer not configured');await notifyScheduleChanges(rest,scheduleMailer,input.id);}catch{notificationWarning='Propuestas guardadas. El aviso quedó pendiente y se reintentará automáticamente.';}}
        return reply({poll:updated,notificationWarning});
      }
      if(path==='extend-poll'&&request.method==='POST'){
        const input=z.object({id:z.string().regex(/^p_[a-f0-9]{32}$/),revision:z.number().int().min(0),ranges:z.array(z.object({date:z.string(),from:z.number(),to:z.number()})).max(256).optional(),from:z.number().optional(),to:z.number().optional()}).parse(body);
        const rows=await rest(`polls?id=eq.${input.id}&select=data`);
        const poll=rows?.[0]?JSON.parse(rows[0].data):null;
        if(!poll||(accountRole(user)!=='admin'&&poll.ownerId!==user.id))throw new HttpError(404,'Consulta no disponible para esta cuenta.');
        if((poll.scheduleRevision||0)!==input.revision)throw new HttpError(409,'La consulta cambió. Actualiza el historial antes de editar.');
        let patch;try{patch=extendSchedule(poll,input);}catch(e){throw new HttpError(400,(e as Error).message);}
        const updated=await rest('rpc/meeting_extend_poll','POST',{p_user:user.id,p_id:input.id,p_revision:input.revision,p_patch:patch});
        if(!updated)throw new HttpError(404,'Consulta no disponible para esta cuenta.');
        return reply({poll:updated});
      }
      if(path==='delete-poll'&&request.method==='POST'){
        const parsed=z.object({id:z.string().regex(/^p_[a-f0-9]{32}$/)}).safeParse(body);
        if(!parsed.success)throw new HttpError(400,'El identificador de la consulta no es válido.');
        const deleted=await rest('rpc/meeting_account_delete_poll','POST',{p_id:parsed.data.id,p_user:user.id});
        if(!deleted)throw new HttpError(404,'La consulta no existe o no pertenece a tu cuenta. Actualiza el historial.');
        return reply({ok:true});
      }
      if(path==='invitations'&&request.method==='POST'){
        if(accountRole(user)!=='admin')throw new HttpError(403,'Solo administración puede crear cuentas.');
        const role=z.object({role:z.enum(['admin','manager']).default('manager')}).parse(body).role;
        const {email}=credentials.pick({email:true}).parse(body),token=secret();
        await rest('meeting_admin_invitations','POST',{token_hash:await digest(token),email,role,created_by:user.id});
        const invitationUrl=current.origin+'/admin#invite='+token;
        let emailSent=false;
        if(mailer){try{await mailer('invite',email,invitationUrl,'admin-invite/'+await digest(token));emailSent=true;}catch{console.error('Admin invitation email delivery failed');}}
        return reply({url:invitationUrl,expiresInDays:7,emailSent},201);
      }
      if(path==='password'&&request.method==='POST'){
        const input=z.object({currentPassword:z.string().min(1).max(128),password:z.string().min(12).max(128)}).parse(body);
        let auth;try{auth=await call('/auth/v1/token?grant_type=password','POST',{email:user.email,password:input.currentPassword});}catch{throw new HttpError(401,'La contraseña actual no es correcta.');}
        await call('/auth/v1/logout?scope=local','POST',undefined,auth.access_token);
        await call('/auth/v1/admin/users/'+user.id,'PUT',{password:input.password});
        await rest(`meeting_admin_sessions?user_id=eq.${user.id}`,'DELETE');
        await session(user);return reply({ok:true});
      }
      return reply({error:'Operación no disponible.'},404);
    }catch(e){
      if(e instanceof z.ZodError)return reply({error:'Revisa el correo y los datos. La nueva contraseña debe tener al menos 12 caracteres.'},400);
      if(e instanceof HttpError)return reply({error:e.message},e.status);
      return reply({error:'No se pudo acceder a la administración. Inténtalo nuevamente.'},503);
    }
  };
}
