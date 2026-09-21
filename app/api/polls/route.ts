import {env} from 'cloudflare:workers';
import {d1Store} from '@/lib/store';
import {handle} from '@/lib/api';
export async function POST(r:Request){if(!env.DB)return Response.json({error:'El almacenamiento aún no está disponible.'},{status:503});return handle(r,d1Store(env.DB));}
