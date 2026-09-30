"use client";
import {AccountRequestForm,AccountRequestsPanel} from '@/components/accounts/account-requests';
import {useCallback,useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {pollPath} from '@/lib/links';
import {ScheduleExtensionDialog} from '@/components/scheduling/schedule-extension-dialog';
import {modes,type Poll} from '@/lib/domain';

type Entry={poll:Poll;responseCount:number};
async function adminApi(path:string,body?:unknown){
  const response=await fetch('/api/admin/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  let data;try{data=await response.json() as {error?:string;email:string;role:'admin'|'manager';polls:Entry[];total:number;url:string;emailSent?:boolean;notificationWarning?:string;message?:string};}catch{throw Error('La administración no está disponible. Revisa la publicación del sitio.');}
  if(!response.ok)throw Object.assign(Error(data.error||'No se pudo completar la operación.'),{status:response.status});
  return data;
}
export default function Admin(){
  const [account,setAccount]=useState<string|null>(null),[checking,setChecking]=useState(true),[invite,setInvite]=useState(''),[reset,setReset]=useState(''),[forgot,setForgot]=useState(false);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [entries,setEntries]=useState<Entry[]>([]),[total,setTotal]=useState(0),[offset,setOffset]=useState(0),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[historyLoading,setHistoryLoading]=useState(false);
  const [role,setRole]=useState<'admin'|'manager'>('manager'),[inviteRole,setInviteRole]=useState<'admin'|'manager'>('manager'),[editingPoll,setEditingPoll]=useState<Poll|null>(null);
  const [inviteEmail,setInviteEmail]=useState(''),[inviteUrl,setInviteUrl]=useState('');
  const [currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState('');
  useEffect(()=>{
    const params=new URLSearchParams(location.hash.slice(1)), recovery=params.get('reset');
    if(recovery){setReset(recovery);history.replaceState({},'',location.pathname);setChecking(false);return;}
    const token=params.get('invite');
    if(token){setInvite(token);history.replaceState({},'',location.pathname);setChecking(false);return;}
    adminApi('me').then(d=>{setAccount(d.email);setRole(d.role);}).catch(e=>{if(e.status!==401)setError(e.message);}).finally(()=>setChecking(false));
  },[]);
  const loadHistory=useCallback(async()=>{
    setHistoryLoading(true);setError('');
    try{const data=await adminApi(`history?offset=${offset}&search=${encodeURIComponent(query)}`);setEntries(data.polls);setTotal(data.total);}
    catch(e){const err=e as Error&{status?:number};setError(err.message);if(err.status===401||err.status===403){setAccount(null);setEntries([]);setTotal(0);}}
    finally{setHistoryLoading(false);}
  },[offset,query]);
  useEffect(()=>{if(account)void loadHistory();},[account,loadHistory]);
  async function authenticate(e:React.FormEvent){
    e.preventDefault();setError('');setNotice('');if((invite||reset)&&password!==confirm){setError('Las contraseñas no coinciden.');return;}
    setBusy(true);try{
      if(forgot){const d=await adminApi('forgot-password',{email});setNotice(d.message||'Revisa tu correo.');return;}
      if(reset){await adminApi('reset-password',{token:reset,password});setReset('');setPassword('');setConfirm('');setNotice('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');return;}
      const data=await adminApi(invite?'accept':'login',{email,password,...(invite?{token:invite}:{})});setAccount(data.email);setRole(data.role);setInvite('');setPassword('');setConfirm('');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function logout(){setBusy(true);setError('');try{await adminApi('logout',{});setAccount(null);setEntries([]);setTotal(0);setInviteUrl('');setNotice('');setCurrentPassword('');setNewPassword('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function createInvitation(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setInviteUrl('');try{const data=await adminApi('invitations',{email:inviteEmail,role:inviteRole});setInviteUrl(data.url);setNotice(data.emailSent?'Invitación enviada por correo.':'La invitación se creó, pero no se pudo enviar el correo. Comparte el enlace privado que aparece debajo.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function deletePoll(poll:Poll){
    if(!window.confirm(`¿Eliminar «${poll.title}»? Se borrarán la consulta y todas sus respuestas. El enlace dejará de funcionar. Esta acción no se puede deshacer.`))return;
    setBusy(true);setError('');setNotice('');
    try{
      await adminApi('delete-poll',{id:poll.id});
      setNotice(`Se eliminó «${poll.title}» y sus respuestas.`);
      setEntries(old=>old.filter(entry=>entry.poll.id!==poll.id));
      if(entries.length===1&&offset>0)setOffset(o=>Math.max(0,o-25));
      else await loadHistory();
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  async function changePassword(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{await adminApi('password',{currentPassword,password:newPassword});setCurrentPassword('');setNewPassword('');setNotice('Contraseña actualizada. Las demás sesiones se cerraron.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className="shell admin-shell">
    <header className="topbar"><a className="brand" href="/" style={{color:'inherit',textDecoration:'none'}}><img className="brand-logo" src="/encuentro-logo.png" alt=""/>at meet</a><div className="row"><a href="/">Volver al calendario</a>{account&&<Button variant="outline" disabled={busy} onClick={logout}>Cerrar sesión</Button>}</div></header>
    <div className="heading"><p className="eyebrow">ADMINISTRACIÓN</p><h1>{account?'Historial de consultas':reset?'Define tu nueva contraseña':forgot?'Recupera tu contraseña':invite?'Activa tu cuenta':'Accede a tu historial'}</h1><p className="muted">{account?`Sesión de ${account}. ${role==='admin'?'Administración: acceso a todas las consultas.':'Gestión: acceso solo a las consultas creadas con esta cuenta.'}`:reset?'El enlace de recuperación es privado y de un solo uso.':forgot?'Indica el correo de tu cuenta.':invite?'Elige tu contraseña para administrar las consultas.':'Ingresa con tu cuenta de at meet. Los participantes pueden seguir respondiendo sin cuenta.'}</p></div>
    <p className="small muted">Los correos de invitación y recuperación llegan desde <strong>atmeet@contact.agencements.net</strong>. Añade esta dirección a tus contactos o remitentes confiables.</p>
    {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    {checking?<p role="status">Comprobando sesión…</p>:!account?<section className="panel admin-login"><form className="dialogform" onSubmit={authenticate}>
      {!reset&&<label className="field">Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>}
      {!forgot&&<label className="field">Contraseña<input type="password" autoComplete={invite||reset?'new-password':'current-password'} required minLength={invite||reset?12:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
      {(invite||reset)&&<><p className="muted small">Al menos 12 caracteres. El enlace es de un solo uso.</p><label className="field">Repite la contraseña<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></>}
      <Button type="submit" disabled={busy}>{busy?'Procesando…':forgot?'Enviar enlace de recuperación':reset?'Guardar nueva contraseña':invite?'Crear cuenta':'Iniciar sesión'}</Button>
      {!invite&&<Button type="button" variant="outline" disabled={busy} onClick={()=>{setForgot(!forgot);setReset('');setPassword('');setConfirm('');setError('');setNotice('')}}>{forgot?'Volver a iniciar sesión':reset?'Solicitar otro enlace':'Olvidé mi contraseña'}</Button>}

    </form>{!invite&&!reset&&!forgot&&<AccountRequestForm/>}</section>:<>
      <section className="panel admin-history">
        <div className="toolbar admin-history-toolbar"><form className="row" onSubmit={e=>{e.preventDefault();setOffset(0);setQuery(search.trim());}}><input aria-label="Buscar consultas por título" placeholder="Buscar por título" value={search} maxLength={120} onChange={e=>setSearch(e.target.value)}/><Button variant="outline" type="submit">Buscar</Button></form><a className="admin-new" href="/">Crear nueva consulta →</a></div>
        <div aria-live="polite" className="admin-count">{historyLoading?'Cargando historial…':`${total} consultas${query?' encontradas':''}`}</div>
        {!historyLoading&&!entries.length&&<p className="admin-empty">{query?'No hay consultas que coincidan con la búsqueda.':'Las consultas que crees aparecerán aquí.'}</p>}
        {!historyLoading&&entries.map(({poll,responseCount})=><article className="admin-entry" key={poll.id}><div><h2><a href={pollPath(poll)}>{poll.title}</a></h2><p className="muted small">{poll.dailyRanges?'Horarios distintos por día':modes[poll.mode]}{poll.mode==='dates'?` · ${poll.start} al ${poll.end}`:''}</p><div className="admin-creator">{poll.creator?<><span>Creada por</span><strong>{poll.creator.name}</strong><a href={`mailto:${poll.creator.email}`}>{poll.creator.email}</a></>:<span>Creador no registrado</span>}</div><p className="muted small">Creada el {new Date(poll.created).toLocaleDateString('es-CL')} · {responseCount} respuestas</p></div><div className="row"><a href={pollPath(poll)}>Abrir</a><a className="admin-new" href={'/manage?p='+poll.id+'&account=1'}>Gestionar y notificar</a><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(new URL(pollPath(poll),location.origin).href);setNotice('Enlace de la consulta copiado.');}catch{setError('No se pudo copiar. Abre la consulta y copia la dirección.');}}}>Copiar enlace</Button><Button variant="outline" disabled={busy||historyLoading} onClick={()=>setEditingPoll(poll)}>Editar propuestas horarias</Button>{<Button variant="destructive" disabled={busy||historyLoading} aria-label={`Eliminar ${poll.title}`} onClick={()=>void deletePoll(poll)}>Eliminar</Button>}</div></article>)}
        <div className="toolbar"><Button variant="outline" disabled={offset===0||historyLoading} onClick={()=>setOffset(o=>Math.max(0,o-25))}>Anterior</Button><span className="small">Página {Math.floor(offset/25)+1}</span><Button variant="outline" disabled={offset+25>=total||historyLoading} onClick={()=>setOffset(o=>o+25)}>Siguiente</Button></div>
      </section>
      {role==='admin'&&<AccountRequestsPanel/>}<div className="admin-settings">{role==='admin'&&<section className="panel"><h2>Invitar a una cuenta</h2><p className="muted small">Administración puede editar o eliminar todas las consultas y crear cuentas. Gestión puede editar y eliminar solo las consultas que cree con su sesión iniciada.</p><form className="dialogform" onSubmit={createInvitation}><label className="field">Correo de la persona<input type="email" required maxLength={254} value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label><label className="field">Tipo de cuenta<select value={inviteRole} onChange={e=>setInviteRole(e.target.value as 'admin'|'manager')}><option value="manager">Gestión · solo consultas propias</option><option value="admin">Administración · todas las consultas</option></select></label><Button disabled={busy} type="submit">Enviar invitación</Button></form>{inviteUrl&&<div className="hint"><label className="field">Enlace de invitación<input readOnly value={inviteUrl} onFocus={e=>e.target.select()}/></label><p className="small">Vence en 7 días y solo se puede usar una vez. También puedes compartir este enlace privado con la persona invitada.</p><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(inviteUrl);setNotice('Invitación copiada.');}catch{setError('Selecciona y copia el enlace de invitación.');}}}>Copiar invitación</Button></div>}</section>}
      <section className="panel"><h2>Cambiar contraseña</h2><form className="dialogform" onSubmit={changePassword}><label className="field">Contraseña actual<input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label className="field">Nueva contraseña<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><p className="small muted">Al menos 12 caracteres.</p><Button type="submit" disabled={busy}>Guardar contraseña</Button></form></section></div>
    </>}
  <ScheduleExtensionDialog poll={editingPoll} onClose={()=>setEditingPoll(null)} onSave={async(body)=>{const result=await adminApi('edit-poll',body);setEditingPoll(null);setNotice(result.notificationWarning||'Propuestas actualizadas. Se conservaron las preferencias de los bloques vigentes y los avisos solicitados quedaron registrados.');await loadHistory();}}/>
  </main>;
}
