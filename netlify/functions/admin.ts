import {adminHandler} from '../../lib/admin-server';
export default async(request:Request)=>{
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return Response.json({error:'Falta configurar el almacenamiento.'},{status:503,headers:{'Cache-Control':'no-store'}});
  return adminHandler(url,key)(request);
};
export const config={path:'/api/admin/*'};
