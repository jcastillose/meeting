import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {adminHandler,digest} from '../lib/admin-server.ts';
import {extendSchedule} from '../lib/schedule-extension.ts';
import {handle as pollsHandler} from '../lib/api.ts';
import {validKeys} from '../lib/domain.ts';
const fahu=process.cwd().endsWith('atmeet-fahu'),uid='c110a833-20c6-457f-8e81-eeb803076551';
let role='manager',sessions=new Map(),reset=null,mail=[],historyUser,patched;
const password='test-password-123',salt='a'.repeat(32);
const user={id:uid,email:'manager@example.com',active:true,password_hash:`scrypt-v1$${salt}$${scryptSync(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024}).toString('hex')}`};
const poll={id:'p_'+'a'.repeat(32),ownerId:uid,title:'Test',mode:'dates',start:'2026-10-01',end:'2026-10-01',from:540,to:660,step:30,duration:60,timezone:'America/Santiago',created:'',manageHash:'private',creator:{name:'Owner',email:user.email}};
const auth=()=>({...user,role,app_metadata:{meeting_admin:role==='admin',meeting_role:role}});
const fetcher=async(url,o={})=>{const u=new URL(url),p=u.pathname,b=o.body?JSON.parse(o.body):{},ok=d=>Response.json(d);
 if(fahu){assert.equal(o.headers['Accept-Profile'],'atmeet_fahu');assert(!p.startsWith('/auth/'));}
 if(p==='/auth/v1/token')return ok({user:auth(),access_token:'private'});
 if(p==='/auth/v1/logout')return new Response(null,{status:204});
 if(p==='/auth/v1/admin/users/'+uid)return ok(auth());
 if(p==='/rest/v1/admin_accounts')return ok([auth()]);
 if(p==='/rest/v1/rpc/admin_login_attempt')return ok(true);
 if(p==='/rest/v1/meeting_admin_sessions'){
  if(o.method==='POST'){sessions.set(b.token_hash,b);return ok(null);}
  if(o.method==='DELETE'){sessions.clear();return ok(null);}
  return ok(sessions.has(u.searchParams.get('token_hash')?.slice(3))?[{user_id:uid}]:[]);
 }
 if(p==='/rest/v1/rpc/meeting_account_history'){historyUser=b.p_user;return ok({total:1,polls:[{poll,responseCount:1}]});}
 if(p==='/rest/v1/polls')return ok([{data:JSON.stringify(poll)}]);
 if(p==='/rest/v1/rpc/meeting_extend_poll'){assert.equal(b.p_user,uid);patched=b;return ok({...poll,...b.p_patch,scheduleRevision:1});}
 if(p==='/rest/v1/rpc/meeting_issue_reset'){if(b.p_email!==user.email||reset)return ok(false);reset=b.p_hash;return ok(true);}
 if(p==='/rest/v1/rpc/meeting_claim_reset'){if(b.p_hash!==reset)return ok(null);reset=null;return ok(uid);}
 throw Error('Unexpected '+p);
};
const app=adminHandler('https://db.test','server-secret',fetcher,async(...args)=>mail.push(args));
const req=(path,body,cookie)=>new Request('https://meeting.test/api/admin/'+path,{method:body===undefined?'GET':'POST',headers:{origin:'https://meeting.test','content-type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
const login=await app(req('login',{email:user.email,password}));assert.equal(login.status,200);assert.equal((await login.json()).role,'manager');const cookie=login.headers.get('set-cookie').split(';')[0];
assert.equal((await app(req('history',undefined,cookie))).status,200);assert.equal(historyUser,uid);
for(const action of ['invitations','delete-poll'])assert.equal((await app(req(action,{email:'other@example.com',id:poll.id,role:'admin'},cookie))).status,403);
const extension={id:poll.id,revision:0,ranges:[{date:'2026-10-02',from:720,to:840}]};
assert.equal((await app(req('extend-poll',extension))).status,401);
assert.equal((await app(req('extend-poll',extension,cookie))).status,200);assert.equal(patched.p_user,uid);
const next={...poll,...patched.p_patch};for(const key of validKeys(poll))assert(validKeys(next).has(key));assert.equal(next.ownerId,uid);
assert.equal((await app(req('extend-poll',{...extension,revision:2},cookie))).status,409);
poll.ownerId='another-account';assert.equal((await app(req('extend-poll',extension,cookie))).status,404);
role='admin';assert.equal((await app(req('extend-poll',extension,cookie))).status,200);role='manager';poll.ownerId=uid;
assert.throws(()=>extendSchedule(poll,{ranges:[{date:'2027-01-01',from:720,to:840}]}));
const recurring={...poll,mode:'week'};assert.throws(()=>extendSchedule(recurring,{from:600,to:660}));assert.deepEqual(extendSchedule(recurring,{from:480,to:720}),{from:480,to:720});
let stored;const store={createPoll:async p=>{stored=p;}};
const create=(account)=>pollsHandler(new Request('https://meeting.test/api/polls',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...poll,ownerId:'forged-account',creator:{name:'N',email:'forged@example.com'}})}),store,undefined,undefined,undefined,account);
const created=await create({id:uid,email:user.email});assert.equal(created.status,201);assert.equal(stored.ownerId,uid);assert.equal(stored.creator.email,user.email);assert.equal((await created.json()).poll.ownerId,undefined);
assert.equal((await create()).status,201);assert.equal(stored.ownerId,undefined);
if(!fahu){
 const known=await app(req('forgot-password',{email:user.email})),unknown=await app(req('forgot-password',{email:'missing@example.com'}));assert.deepEqual(await known.json(),await unknown.json());assert.equal(mail.length,1);
 await app(req('forgot-password',{email:user.email}));assert.equal(mail.length,1);
 const token=new URLSearchParams(new URL(mail[0][2]).hash.slice(1)).get('reset');
 assert.equal((await app(req('reset-password',{token,password:'short'}))).status,400);
 assert.equal((await app(req('reset-password',{token,password:'new-password-123'}))).status,200);
 assert.equal((await app(req('reset-password',{token,password:'new-password-123'}))).status,400);
 assert.equal((await app(req('me',undefined,cookie))).status,401);
}
console.log('PASS: role boundaries, owner binding, no forged ownership, additive schedules, conflicts and recovery');
