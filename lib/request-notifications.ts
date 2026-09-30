type Rest=(path:string,method?:string,body?:unknown)=>Promise<any>;
export type RequestMailer=(email:string,input:{id:string;name:string;email:string;message:string},key:string)=>Promise<void>;
/** Leased, persistent deliveries. Partial successes survive process restarts. */
export async function notifyAccountRequests(rest:Rest,recipients:()=>Promise<string[]>,mailer?:RequestMailer,email?:string){
 if(!mailer)return;
 const addresses=[...new Set(await recipients())];if(!addresses.length)return;
 const claim=crypto.randomUUID();
 const row=await rest('rpc/meeting_claim_request_notice','POST',{p_email:email||null,p_claim:claim});
 if(!row)return;
 try{
  for(const address of addresses){
   if(row.delivered_emails.includes(address))continue;
   await mailer(address,row,'account-request/'+row.id+'/'+address);
   await rest('rpc/meeting_ack_request_notice','POST',{p_id:row.id,p_claim:claim,p_email:address,p_done:false});
  }
  await rest('rpc/meeting_ack_request_notice','POST',{p_id:row.id,p_claim:claim,p_email:null,p_done:true});
 }catch(error){console.error('Account request notice remains pending');throw error;}
}
