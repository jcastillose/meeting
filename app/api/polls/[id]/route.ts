import {env} from 'cloudflare:workers';
import {d1Store} from '@/lib/store';
import {handle} from '@/lib/api';
async function route(r:Request,context:{params:Promise<{id:string}>}){if(!env.DB)return Response.json({error:'El almacenamiento aún no está disponible.'},{status:503});return handle(r,d1Store(env.DB),(await context.params).id);}
export const GET=route;
export const PUT=route;
