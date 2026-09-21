import {handle} from '../../lib/api';
import {supabaseStore} from '../../lib/store';
export default async(request:Request)=>{const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return Response.json({error:'Falta configurar el almacenamiento.'},{status:503});const path=new URL(request.url).pathname;const m=path.match(/^\/api\/polls(?:\/(p_[a-f0-9]{32}))?$/);if(!m)return new Response('Not found',{status:404});return handle(request,supabaseStore(url,key),m[1]);};
export const config={path:['/api/polls','/api/polls/*']};
