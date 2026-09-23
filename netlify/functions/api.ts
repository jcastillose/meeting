import {handle} from '../../lib/api';
import {resendNotifier,managementMailer} from '../../lib/notifications';
import {manage} from '../../lib/management';
import {supabaseStore} from '../../lib/store';
export default async(request:Request)=>{
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({error:'Falta configurar el almacenamiento.'},{status:503});
 const m=new URL(request.url).pathname.match(/^\/api\/polls(?:\/(p_[a-f0-9]{32})(\/manage)?)?$/);
 if(!m)return new Response('Not found',{status:404});
 const config=process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL?{apiKey:process.env.RESEND_API_KEY,from:process.env.RESEND_FROM_EMAIL,siteUrl:process.env.URL||'https://atmeet.netlify.app'}:undefined;
 const store=supabaseStore(url,key),mailer=config?managementMailer(config):undefined;
 if(m[2])return manage(request,store,m[1],mailer?.access,mailer?.group);
 return handle(request,store,m[1],config?resendNotifier(config):undefined,mailer?.access);
};
export const config={path:['/api/polls','/api/polls/*']};
