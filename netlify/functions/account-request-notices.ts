import {adminHandler} from '../../lib/admin-server';
import {managementMailer} from '../../lib/notifications';
export default async()=>{
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return new Response(null,{status:503});
 const siteUrl=process.env.URL||'https://atmeet.netlify.app';
 const mailer=managementMailer({apiKey:process.env.RESEND_API_KEY,from:process.env.RESEND_FROM_EMAIL,siteUrl});
 return adminHandler(url,key,fetch,mailer.admin,mailer.requestAccount,mailer.schedule)(new Request(new URL('/api/admin/notice-worker',siteUrl),{headers:{'X-Atmeet-Notice-Worker':key}}));
};
export const config={schedule:'*/15 * * * *'};
