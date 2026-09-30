import {downloadConfirmedCalendar} from '../../lib/calendar-export';
import {adminHandler} from '../../lib/admin-server';
import {handle} from '../../lib/api';
import {resendNotifier,managementMailer} from '../../lib/notifications';
import {manage} from '../../lib/management';
import {supabaseStore} from '../../lib/store';
export default async(request:Request)=>{
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({error:'Falta configurar el almacenamiento.'},{status:503});
 const m=new URL(request.url).pathname.match(/^\/api\/polls(?:\/(p_[a-f0-9]{32})(\/manage|\/calendar)?)?$/);
 if(!m)return new Response('Not found',{status:404});
 const config=process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL?{apiKey:process.env.RESEND_API_KEY,from:process.env.RESEND_FROM_EMAIL,siteUrl:process.env.URL||'https://atmeet.netlify.app'}:undefined;
 const store=supabaseStore(url,key),mailer=config?managementMailer(config):undefined;
 if(m[2]==='/calendar')return downloadConfirmedCalendar(request,store,m[1]);
 if(m[2]){
  // Account mode is authenticated independently; the browser cannot supply an owner or role.
  const body=await request.clone().json().catch(()=>null) as {accountAccess?:boolean}|null;
  if(body?.accountAccess===true){
   const session=await adminHandler(url,key)(new Request(new URL('/api/admin/me',request.url),{headers:request.headers}));
   if(!session.ok)return session;
   const account=await session.json() as {id:string;role:'admin'|'manager'};return manage(request,store,m[1],mailer?.access,mailer?.group,account);
  }
  return manage(request,store,m[1],mailer?.access,mailer?.group);
 }
 let account: {id:string;email:string}|undefined;
 if(request.method==='POST'&&!m[1]&&request.headers.get('cookie')?.includes('meeting-admin=')){
  const session=await adminHandler(url,key)(new Request(new URL('/api/admin/me',request.url),{headers:request.headers}));
  if(!session.ok)return session;
  account=await session.json();
 }
 return handle(request,store,m[1],config?resendNotifier(config):undefined,mailer?.access,account);
};
export const config={path:['/api/polls','/api/polls/*']};
