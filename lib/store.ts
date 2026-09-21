import type {Poll,Vote} from './domain';
export type StoredVote={id:string;poll_id:string;edit_hash:string;data:string};
export interface Store {getPoll(id:string):Promise<Poll|null>;createPoll(p:Poll):Promise<void>;getVotes(id:string):Promise<Vote[]>;getVote(id:string):Promise<StoredVote|null>;saveVote(v:StoredVote):Promise<void>}
export function d1Store(db:D1Database):Store{return {
async getPoll(id){const r=await db.prepare('SELECT data FROM polls WHERE id = ?').bind(id).first<{data:string}>();return r?JSON.parse(r.data):null;},
async createPoll(p){await db.prepare('INSERT INTO polls (id,data) VALUES (?,?)').bind(p.id,JSON.stringify(p)).run();},
async getVotes(id){const r=await db.prepare('SELECT data FROM votes WHERE poll_id = ? ORDER BY rowid').bind(id).all<{data:string}>();return r.results.map(x=>JSON.parse(x.data));},
async getVote(id){return db.prepare('SELECT id,poll_id,edit_hash,data FROM votes WHERE id = ?').bind(id).first<StoredVote>();},
async saveVote(v){await db.prepare('INSERT INTO votes (id,poll_id,edit_hash,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE votes.edit_hash=excluded.edit_hash AND votes.poll_id=excluded.poll_id').bind(v.id,v.poll_id,v.edit_hash,v.data).run();}
};}
export function supabaseStore(url:string,key:string):Store{
async function rest(table:string,query:string,method='GET',body?:unknown){const r=await fetch(`${url.replace(/\/$/,'')}/rest/v1/${table}${query}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:method==='POST'?'resolution=merge-duplicates,return=minimal':'return=representation'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Storage unavailable');return r.status===204||r.headers.get('content-length')==='0'?null:r.text().then(t=>t?JSON.parse(t):null);}
return {async getPoll(id){const rows=await rest('polls',`?id=eq.${encodeURIComponent(id)}&select=data`);return rows[0]?JSON.parse(rows[0].data):null;},async createPoll(p){await rest('polls','', 'POST',{id:p.id,data:JSON.stringify(p)});},async getVotes(id){const rows=await rest('votes',`?poll_id=eq.${encodeURIComponent(id)}&select=data&order=id`);return rows.map((r:{data:string})=>JSON.parse(r.data));},async getVote(id){const rows=await rest('votes',`?id=eq.${encodeURIComponent(id)}&select=*`);return rows[0]||null;},async saveVote(v){await rest('votes','?on_conflict=id','POST',v);}};
}
