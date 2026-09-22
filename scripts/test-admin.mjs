import assert from 'node:assert/strict';
import {adminHandler,digest} from '../lib/admin-server.ts';
import {pollPath,pollIdFromUrl} from '../lib/links.ts';
const rows=new Map(),invitations=new Map();
const user={id:'c110a833-20c6-457f-8e81-eeb803076551',email:'admin@example.com',app_metadata:{meeting_admin:true}};
let privileged=true,historyCalls=0,created=0,deleted=[];
const fetcher=async(url,options={})=>{
 const u=new URL(url),p=u.pathname,b=options.body?JSON.parse(options.body):{};
 const ok=d=>Response.json(d);
 if(p==='/auth/v1/token')return ok({user:{...user,app_metadata:privileged?user.app_metadata:{}},access_token:'test-auth-token'});
 if(p==='/auth/v1/logout')return new Response(null,{status:204});
 if(p==='/auth/v1/admin/users/'+user.id)return ok({...user,app_metadata:privileged?user.app_metadata:{}});
 if(p==='/auth/v1/admin/users'){created++;return ok(user);}
 if(p==='/rest/v1/meeting_admin_sessions'){
   const h=u.searchParams.get('token_hash')?.slice(3);
   if(options.method==='POST'){rows.set(b.token_hash,b);return new Response(null,{status:201});}
   if(options.method==='DELETE'){rows.delete(h);return new Response(null,{status:204});}
   return ok(rows.has(h)&&new Date(rows.get(h).expires_at)>new Date()?[rows.get(h)]:[]);
 }
 if(p==='/rest/v1/meeting_admin_invitations'){
   const h=u.searchParams.get('token_hash')?.slice(3);
   if(options.method==='POST'){invitations.set(b.token_hash,{...b,used:false});return new Response(null,{status:201});}
   const inv=invitations.get(h);return ok(inv&&!inv.used?[inv]:[]);
 }
 if(p==='/rest/v1/rpc/meeting_claim_invitation'){
   const inv=invitations.get(b.p_hash);if(!inv||inv.used)return ok([]);inv.used=true;return ok([{email:inv.email}]);
 }
 if(p==='/rest/v1/rpc/meeting_delete_poll'){if(deleted.includes(b.p_id))return ok(false);deleted.push(b.p_id);return ok(true);}
 if(p==='/rest/v1/rpc/meeting_history'){historyCalls++;return ok({polls:[],total:0});}
 throw Error('Unexpected fetch '+p);
};
const handle=adminHandler('https://supabase.test','server-secret',fetcher);
const request=(path,body,cookie,origin='https://meeting.test')=>new Request('https://meeting.test/api/admin/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
assert.equal((await handle(request('history'))).status,401);assert.equal(historyCalls,0);
assert.equal((await handle(request('login',{email:user.email,password:'password'},null,'https://evil.test'))).status,403);
privileged=false;assert.equal((await handle(request('login',{email:user.email,password:'password'}))).status,403);privileged=true;
assert.equal((await handle(request('delete-poll',{id:'p_'+'a'.repeat(32)}))).status,401);assert.equal(deleted.length,0);
const login=await handle(request('login',{email:user.email,password:'password'}));assert.equal(login.status,200);
const setCookie=login.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);
const cookie=setCookie.split(';')[0];assert(!JSON.stringify(await login.json()).includes('test-auth-token'));
assert.equal((await handle(request('history',undefined,cookie))).status,200);
privileged=false;assert.equal((await handle(request('history',undefined,cookie))).status,403);privileged=true;
assert.equal((await handle(request('delete-poll',{id:'p_'+'a'.repeat(32)},cookie,'https://evil.test'))).status,403);
privileged=false;assert.equal((await handle(request('delete-poll',{id:'p_'+'a'.repeat(32)},cookie))).status,403);privileged=true;
assert.equal((await handle(request('delete-poll',{id:'invalid'},cookie))).status,400);assert.equal(deleted.length,0);
assert.equal((await handle(request('delete-poll',{id:'p_'+'a'.repeat(32)},cookie))).status,200);
assert.equal((await handle(request('delete-poll',{id:'p_'+'a'.repeat(32)},cookie))).status,404);assert.deepEqual(deleted,['p_'+'a'.repeat(32)]);
const inv=await handle(request('invitations',{email:'invite@example.com'},cookie));assert.equal(inv.status,201);const {url}=await inv.json();const token=new URLSearchParams(new URL(url).hash.slice(1)).get('invite');
assert.equal((await handle(request('accept',{token,email:'wrong@example.com',password:'long-password-123'}))).status,400);
const acceptance={token,email:'invite@example.com',password:'long-password-123'};
const accepted=await Promise.all([handle(request('accept',acceptance)),handle(request('accept',acceptance))]);
assert.deepEqual(accepted.map(r=>r.status).sort(),[201,400]);assert.equal(created,1);
await handle(request('logout',{},cookie));assert.equal((await handle(request('history',undefined,cookie))).status,401);
for(const title of ['Reunión de investigación','測試','A'.repeat(120),'mismo título']){
const id='p_'+crypto.randomUUID().replaceAll('-','');const path=pollPath({id,title});assert.equal(pollIdFromUrl(new URL(path,'https://meeting.test')),id);assert.equal(pollIdFromUrl(new URL('https://meeting.test/?p='+id)),id);
}
assert.equal(pollIdFromUrl(new URL('https://meeting.test/r/inventado')),null);
assert.notEqual(pollPath({id:'p_'+'a'.repeat(32),title:'Igual'}),pollPath({id:'p_'+'b'.repeat(32),title:'Igual'}));
console.log('PASS: authorization, CSRF, private cookies, role revocation, invitation recipient, concurrent single use, logout, new links and legacy links.');
