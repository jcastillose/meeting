import {z} from 'zod';

const credentials=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase().trim()),password:z.string().min(1).max(128)});
const inviteToken=z.string().regex(/^[a-f0-9]{64}$/);
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
type AdminUser={id:string;email?:string;app_metadata?:Record<string,unknown>};

export function adminHandler(url:string,key:string,fetcher:typeof fetch=fetch){
  const root=url.replace(/\/$/,'');
  async function call(path:string,method='GET',body?:unknown,bearer=key){
    const r=await fetcher(root+path,{method,headers:{apikey:key,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.text();
    if(!r.ok)throw new HttpError(r.status>=500?503:400,'No se pudo completar la operación. Revisa los datos e inténtalo nuevamente.');
    return data?JSON.parse(data):null;
  }
  const rest=(path:string,method='GET',body?:unknown)=>call('/rest/v1/'+path,method,body);
  return async function handler(request:Request):Promise<Response>{
    const current=new URL(request.url),secure=current.protocol==='https:',cookieName=secure?'__Host-meeting-admin':'meeting-admin';
    const responseHeaders=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:responseHeaders});
    const cookie=(value:string,age:number)=>responseHeaders.append('Set-Cookie',`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`);
    let issuedSession:string|undefined;
    async function session(user:AdminUser){
      const token=secret();issuedSession=await digest(token);
      await rest('meeting_admin_sessions','POST',{token_hash:issuedSession,user_id:user.id,expires_at:new Date(Date.now()+8*3600000).toISOString()});
      cookie(token,8*3600);
    }
    async function signedIn(){
      const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if(!raw||!inviteToken.safeParse(raw).success)throw new HttpError(401,'Inicia sesión para acceder a la administración.');
      const hash=await digest(raw);
      const rows=await rest(`meeting_admin_sessions?token_hash=eq.${hash}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id`);
      if(!rows?.[0])throw new HttpError(401,'Tu sesión terminó. Vuelve a iniciar sesión.');
      const user:AdminUser=await call('/auth/v1/admin/users/'+encodeURIComponent(rows[0].user_id));
      if(user.app_metadata?.meeting_admin!==true)throw new HttpError(403,'Esta cuenta no tiene acceso de administración.');
      return {user,hash};
    }
    try{
      const path=current.pathname.replace(/^\/api\/admin\/?/,'');
      if(request.method!=='GET'){
        if(request.headers.get('origin')!==current.origin)throw new HttpError(403,'Origen no permitido.');
        if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'Formato no permitido.');
      }
      let body:unknown={};
      if(request.method==='POST'){
        const raw=await request.text();if(raw.length>12000)throw new HttpError(413,'Solicitud demasiado grande.');
        try{body=JSON.parse(raw);}catch{throw new HttpError(400,'Formato no permitido.');}
      }
      if(path==='login'&&request.method==='POST'){
        const input=credentials.parse(body);
        let auth;
        try{auth=await call('/auth/v1/token?grant_type=password','POST',input);}catch{throw new HttpError(401,'Correo o contraseña incorrectos.');}
        const user:AdminUser=auth.user;
        // The Supabase token never leaves the server. Our opaque session is revocable.
        await call('/auth/v1/logout?scope=local','POST',undefined,auth.access_token);
        if(user?.app_metadata?.meeting_admin!==true)throw new HttpError(403,'Esta cuenta no tiene acceso de administración.');
        await session(user);return reply({email:user.email});
      }
      if(path==='accept'&&request.method==='POST'){
        const input=credentials.extend({token:inviteToken,password:z.string().min(12).max(128)}).parse(body);
        const hash=await digest(input.token),claim=crypto.randomUUID();
        // Verify the recipient before atomically consuming the invitation.
        const invitations=await rest(`meeting_admin_invitations?token_hash=eq.${hash}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=email`);
        if(!invitations?.[0]||(invitations[0].email&&invitations[0].email!==input.email))throw new HttpError(400,'La invitación no es válida, ha vencido o corresponde a otro correo.');
        const claimed=await rest('rpc/meeting_claim_invitation','POST',{p_hash:hash,p_claim:claim});
        if(!claimed?.[0])throw new HttpError(400,'La invitación ya fue utilizada o venció.');
        let user:AdminUser;
        try{
          user=await call('/auth/v1/admin/users','POST',{email:input.email,password:input.password,email_confirm:true,app_metadata:{meeting_admin:true}});
        }catch{
          await rest(`meeting_admin_invitations?token_hash=eq.${hash}&claim_id=eq.${claim}`,'PATCH',{used_at:null,claim_id:null});
          throw new HttpError(400,'No se pudo crear la cuenta. Puede que el correo ya esté registrado o la contraseña no cumpla los requisitos.');
        }
        await session(user);return reply({email:user.email},201);
      }
      if(path==='logout'&&request.method==='POST'){
        const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
        if(raw&&inviteToken.safeParse(raw).success)await rest(`meeting_admin_sessions?token_hash=eq.${await digest(raw)}`,'DELETE');
        cookie('',0);return reply({ok:true});
      }
      const {user}=await signedIn();
      if(path==='me'&&request.method==='GET')return reply({email:user.email});
      if(path==='history'&&request.method==='GET'){
        const offset=z.coerce.number().int().min(0).max(1000000).parse(current.searchParams.get('offset')||0);
        const search=z.string().max(120).parse(current.searchParams.get('search')||'');
        return reply(await rest('rpc/meeting_history','POST',{p_offset:offset,p_search:search}));
      }
      if(path==='invitations'&&request.method==='POST'){
        const {email}=credentials.pick({email:true}).parse(body),token=secret();
        await rest('meeting_admin_invitations','POST',{token_hash:await digest(token),email,created_by:user.id});
        return reply({url:current.origin+'/admin#invite='+token,expiresInDays:7},201);
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
