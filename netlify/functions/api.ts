import {handle} from '../../lib/api';
import {resendNotifier} from '../../lib/notifications';
import {supabaseStore} from '../../lib/store';
export default async(request:Request)=>{const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return Response.json({error:'Falta configurar el almacenamiento.'},{status:503});const path=new URL(request.url).pathname;const m=path.match(/^\/api\/polls(?:\/(p_[a-f0-9]{32}))?$/);if(!m)return new Response('Not found',{status:404});const notify=process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL?resendNotifier({apiKey:process.env.RESEND_API_KEY,from:process.env.RESEND_FROM_EMAIL,siteUrl:process.env.URL||'https://atmeet.netlify.app'}):undefined;return handle(request,supabaseStore(url,key),m[1],notify);};
export const config={path:['/api/polls','/api/polls/*']};
