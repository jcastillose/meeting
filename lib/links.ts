import type {Poll} from './domain';

// Encode the full random identifier: short links retain the original entropy.
export function pollPath(poll:Pick<Poll,'id'|'title'>):string {
  const hex=poll.id.replace(/^p_/,'');
  if(!/^[a-f0-9]{32}$/.test(hex))return '/';
  const code=btoa(String.fromCharCode(...hex.match(/../g)!.map(x=>parseInt(x,16))))
    .replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const title=poll.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48).replace(/-$/,'')||'reunion';
  return `/r/${title}~${code}`;
}
export function pollIdFromUrl(url:URL):string|null {
  const old=url.searchParams.get('p');
  if(old&&/^p_[a-f0-9]{32}$/.test(old))return old;
  const match=url.pathname.match(/^\/r\/[a-z0-9-]+~([A-Za-z0-9_-]{22})\/?$/);
  if(!match)return null;
  try {
    const binary=atob(match[1].replaceAll('-','+').replaceAll('_','/')+'==');
    const id='p_'+Array.from(binary,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
    return /^p_[a-f0-9]{32}$/.test(id)?id:null;
  }catch{return null;}
}
