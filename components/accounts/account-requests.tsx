'use client';
import {useCallback,useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
type Entry={id:string;name:string;email:string;message:string;created_at:string};
async function api(path:string,body?:unknown){
 const response=await fetch('/api/admin/'+path,{method:body===undefined?'GET':'POST',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json() as {error?:string;message?:string;requests?:Entry[];hasMore?:boolean;url?:string;emailSent?:boolean};if(!response.ok)throw Error(data.error||'No se pudo completar la solicitud.');return data;
}
export function AccountRequestForm(){
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState(''),[message,setMessage]=useState(''),[website,setWebsite]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const data=await api('request-account',{name,email,message,website});setNotice(data.message||'Solicitud procesada.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section style={{marginTop:24,borderTop:'1px solid var(--border)',paddingTop:20}}><h2>¿Necesitas crear y gestionar consultas?</h2><p className="small muted">Solicita una cuenta de gestión. Administración revisará tu solicitud y definirá los permisos. Para responder una consulta no necesitas cuenta.</p>{!open?<Button variant="outline" onClick={()=>setOpen(true)}>Solicitar cuenta de gestión</Button>:notice?<p className="notice" role="status">{notice}</p>:<form className="dialogform" onSubmit={submit}>
 <label className="field">Nombre y apellido<input required minLength={2} maxLength={120} autoComplete="name" value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
 <label className="field">Correo para la invitación<input required type="email" maxLength={254} autoComplete="email" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
 <label className="field">Mensaje para Administración (opcional)<textarea maxLength={1000} rows={3} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} placeholder="Cuéntanos para qué necesitas gestionar consultas."/></label>
 <div hidden aria-hidden="true"><label>Sitio web<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
 {error&&<p className="notice error" role="alert">{error}</p>}<div className="row"><Button disabled={busy} type="submit">{busy?'Enviando…':'Enviar solicitud'}</Button><Button variant="outline" disabled={busy} type="button" onClick={()=>setOpen(false)}>Cancelar</Button></div>
 </form>}</section>;
}
function RequestCard({entry,busy,onDecision}:{entry:Entry;busy:boolean;onDecision:(id:string,decision:'approve'|'reject',role:'admin'|'manager')=>Promise<void>}){
 const [role,setRole]=useState<'admin'|'manager'>('manager'),[review,setReview]=useState<'approve'|'reject'|null>(null);
 return <article className="admin-entry" style={{display:'block',padding:'20px 0'}}><h3>{entry.name}</h3><p style={{overflowWrap:'anywhere'}}>{entry.email}</p><p className="small muted">{new Date(entry.created_at).toLocaleDateString('es-CL')} · Correo pendiente de verificación mediante la invitación</p>{entry.message&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{entry.message}</p>}
 <label className="field">Permisos para {entry.name}<select disabled={busy||!!review} value={role} onChange={e=>setRole(e.target.value as 'admin'|'manager')}><option value="manager">Gestión · solo sus consultas</option><option value="admin">Administración · todas las consultas</option></select></label>
 {!review?<div className="row" style={{marginTop:12}}><Button disabled={busy} onClick={()=>setReview('approve')}>Revisar aprobación</Button><Button variant="outline" disabled={busy} onClick={()=>setReview('reject')}>Rechazar</Button></div>:<div className="send-review"><p>{review==='reject'?'Se rechazará esta solicitud sin crear una cuenta.':`Se enviará una invitación a ${entry.email} con permisos de ${role==='admin'?'Administración: podrá gestionar todas las consultas y crear cuentas.':'Gestión: podrá editar y eliminar solo sus consultas.'}`}</p><div className="row"><Button disabled={busy} onClick={()=>void onDecision(entry.id,review,role)}>{busy?'Procesando…':review==='approve'?'Aprobar y enviar invitación':'Confirmar rechazo'}</Button><Button variant="outline" disabled={busy} onClick={()=>setReview(null)}>Volver</Button></div></div>}
 </article>;
}
export function AccountRequestsPanel(){
 const [entries,setEntries]=useState<Entry[]>([]),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[fallback,setFallback]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{const data=await api('account-requests?offset='+offset);setEntries(data.requests||[]);setHasMore(!!data.hasMore);}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[offset]);
 useEffect(()=>{void load();},[load]);
 async function decide(id:string,decision:'approve'|'reject',role:'admin'|'manager'){setBusy(true);setError('');setNotice('');setFallback('');try{const data=await api('review-request',{id,decision,role});setNotice(data.message||'Solicitud procesada.');if(data.url&&!data.emailSent)setFallback(data.url);if(entries.length===1&&offset>0)setOffset(o=>Math.max(0,o-25));else await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel admin-history" style={{marginTop:24,padding:20}} aria-labelledby="account-requests-title"><div className="row between"><h2 id="account-requests-title">Solicitudes de cuenta</h2><Button variant="outline" disabled={busy||loading} onClick={()=>void load()}>Actualizar</Button></div><p className="small muted">Revisa cada solicitud y asigna sus permisos antes de invitar. El acceso se activa cuando la persona recibe el enlace y crea su contraseña.</p>
 {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}{fallback&&<label className="field">Enlace privado para la persona aprobada<input readOnly value={fallback} onFocus={e=>e.target.select()}/></label>}
 {loading?<p role="status">Cargando solicitudes…</p>:entries.length?entries.map(entry=><RequestCard key={entry.id} entry={entry} busy={busy} onDecision={decide}/>):!error&&<p className="admin-empty">No hay solicitudes pendientes.</p>}
 <div className="row"><Button variant="outline" disabled={offset===0||busy||loading} onClick={()=>setOffset(o=>Math.max(0,o-25))}>Anteriores</Button><span className="small">Página {offset/25+1}</span><Button variant="outline" disabled={!hasMore||busy||loading} onClick={()=>setOffset(o=>o+25)}>Siguientes</Button></div></section>;
}
