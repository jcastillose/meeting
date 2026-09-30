import assert from 'node:assert/strict';
import {submitAccountRequest,reviewAccountRequests} from '../lib/account-requests.ts';
const id=crypto.randomUUID(),uid=crypto.randomUUID();let calls=[],mails=[],pending=true;
const rest=async(path,method,body)=>{calls.push({path,body});if(path==='rpc/meeting_request_account')return null;if(path.startsWith('meeting_account_requests?'))return Array.from({length:26},()=>({id}));if(path==='rpc/meeting_review_request'){assert.equal(body.p_user,uid);if(!pending)return null;pending=false;return {email:'applicant@example.com'};}throw Error(path);};
const mail=async(...args)=>mails.push(args),url=new URL('https://meeting.test/api/admin/account-requests');
assert.equal((await submitAccountRequest({name:'A',email:'invalid'},rest)).status,400);assert.equal(calls.length,0);
assert.equal((await submitAccountRequest({name:'Persona',email:'USER@example.com',role:'admin'},rest)).status,202);assert.equal(calls[0].body.p_email,'user@example.com');assert.equal(calls[0].body.p_role,undefined);
await submitAccountRequest({name:'Bot',email:'bot@example.com',website:'bot'},rest);assert.equal(calls.length,1);
const review=(role,body,method='POST')=>reviewAccountRequests(method==='GET'?'account-requests':'review-request',method,body,url,{id:uid},role,rest,mail);
assert.equal((await review('manager',{id,decision:'approve',role:'admin'})).status,403);assert.equal(calls.length,1);
const page=await review('admin',undefined,'GET');assert.equal(page.data.requests.length,25);assert.equal(page.data.hasMore,true);
const approved=await review('admin',{id,decision:'approve'});assert.equal(approved.status,200);assert.equal(calls.at(-1).body.p_role,'manager');assert.equal(mails.length,1);assert.equal(mails[0][1],'applicant@example.com');assert.equal(approved.data.emailSent,true);
assert.equal((await review('admin',{id,decision:'approve',role:'admin'})).status,409);assert.equal(mails.length,1);
pending=true;await review('admin',{id,decision:'reject'});assert.equal(mails.length,1);
pending=true;const fallback=await reviewAccountRequests('review-request','POST',{id,decision:'approve',role:'admin'},url,{id:uid},'admin',rest,async()=>{throw Error('mail unavailable');});assert.equal(fallback.data.emailSent,false);assert.match(fallback.data.url,/#invite=[a-f0-9]{64}$/);
console.log('PASS: public validation, ignored self-assigned roles, admin-only review, paging, single approval, rejection and mail fallback');

const {notifyAccountRequests}=await import('../lib/request-notifications.ts');
let done=false,leased=false,delivered=[],noticeCalls=[];
const notificationRest=async(path,method,body)=>{
 if(path==='rpc/meeting_claim_request_notice'){if(done||leased)return null;leased=true;return {id,name:'Applicant',email:'applicant@example.com',message:'Request',delivered_emails:[...delivered]};}
 if(path==='rpc/meeting_ack_request_notice'){if(body.p_email)delivered.push(body.p_email);if(body.p_done)done=true;return null;}throw Error(path);
};
await notifyAccountRequests(notificationRest,async()=>['admin1@example.com','admin2@example.com','admin1@example.com'],async(email)=>{noticeCalls.push(email);if(email==='admin2@example.com')throw Error('provider failure');}).catch(()=>{});
assert.deepEqual(delivered,['admin1@example.com']);leased=false;
await notifyAccountRequests(notificationRest,async()=>['admin1@example.com','admin2@example.com'],async(email)=>noticeCalls.push(email));
await notifyAccountRequests(notificationRest,async()=>['admin1@example.com'],async(email)=>noticeCalls.push(email));
assert.deepEqual(noticeCalls,['admin1@example.com','admin2@example.com','admin2@example.com']);assert(done);
console.log('PASS: durable partial delivery, distinct admins, pending retry and completed deduplication');
