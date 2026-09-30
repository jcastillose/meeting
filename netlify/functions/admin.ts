import {managementMailer} from '../../lib/notifications';
import {adminHandler} from '../../lib/admin-server';
export default async(request:Request)=>{
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return Response.json({error:'Falta configurar el almacenamiento.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const mailer=process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL?managementMailer({apiKey:process.env.RESEND_API_KEY,from:process.env.RESEND_FROM_EMAIL,siteUrl:process.env.URL||'https://atmeet.netlify.app'}):undefined;
  return adminHandler(url,key,fetch,mailer?.admin,mailer?.requestAccount,mailer?.schedule)(request);
};
export const config={path:'/api/admin/*'};
