import {clock,dayLabel,validKeys,type Poll,type Status} from './domain';
/** Existing group answers never put a new participant into a read-only layer. */
export function initialPreferenceLayer(poll: Pick<Poll,'closed'>): 'mine'|'group' {
 return poll.closed ? 'group' : 'mine';
}
/** Reconcile only the local draft; never mutate another participant's response. */
export function retainProposedSlots(slots: Record<string,Status>, poll: Poll): Record<string,Status> {
 const allowed=validKeys(poll);
 const entries=Object.entries(slots).filter(([key])=>allowed.has(key));
 return entries.length===Object.keys(slots).length ? slots : Object.fromEntries(entries);
}

/** Prefer a meeting starting at this cell; at a boundary, use the last complete window containing it. */
export function durationWindow(poll: Poll, key: string, allowed = validKeys(poll)): string[] {
 const duration=poll.duration||poll.step, width=duration/poll.step;
 if(!allowed.has(key)||!Number.isInteger(width)||width<1)return [];
 const [day,time]=key.split('@');
 for(let offset=0;offset<width;offset++){
  const start=Number(time)-offset*poll.step;
  const keys=Array.from({length:width},(_,i)=>`${day}@${start+i*poll.step}`);
  if(keys.every(k=>allowed.has(k)))return keys;
 }
 return [];
}

/** Positive preferences may mix yes/maybe, but every continuous run must fit a full meeting. */
export function availabilityDurationErrors(poll: Poll, slots: Record<string,Status>): string[] {
 const duration=poll.duration||poll.step;
 if(duration<=poll.step)return [];
 const allowed=validKeys(poll);
 const positive=Object.entries(slots).filter(([key,status])=>allowed.has(key)&&(status==='yes'||status==='maybe'))
  .map(([key])=>{const [day,time]=key.split('@');return {day,time:Number(time)};})
  .sort((a,b)=>a.day.localeCompare(b.day)||a.time-b.time);
 const runs:{day:string;from:number;to:number}[]=[];
 for(const {day,time} of positive){
  const last=runs.at(-1);
  if(last&&last.day===day&&last.to===time)last.to+=poll.step;
  else runs.push({day,from:time,to:time+poll.step});
 }
 return runs.filter(r=>r.to-r.from<duration).map(r=>
  `${dayLabel(poll,r.day)}, ${clock(r.from)}–${clock(r.to)}: amplía o borra este tramo. «Disponible» y «Si hace falta» deben cubrir al menos ${duration} minutos continuos.`);
}
