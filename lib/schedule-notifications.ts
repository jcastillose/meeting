import type {Poll} from './domain';
type Rest=(path:string,method?:string,body?:unknown)=>Promise<any>;
export type ScheduleMailer=(poll:Poll,email:string,key:string)=>Promise<void>;
export async function notifyScheduleChanges(rest:Rest,mailer?:ScheduleMailer,pollId?:string){
 if(!mailer)return;
 const claim=crypto.randomUUID();
 const row=await rest('rpc/meeting_claim_schedule_notice','POST',{p_id:pollId||null,p_claim:claim});if(!row)return;
 for(const email of row.emails){
  if(row.delivered_emails.includes(email))continue;
  await mailer(row.after_data,email,'schedule-change/'+row.id+'/'+email);
  await rest('rpc/meeting_ack_schedule_notice','POST',{p_id:row.id,p_claim:claim,p_email:email,p_done:false});
 }
 await rest('rpc/meeting_ack_schedule_notice','POST',{p_id:row.id,p_claim:claim,p_email:null,p_done:true});
}
