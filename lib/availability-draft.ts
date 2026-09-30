import {validKeys,type Poll,type Status} from './domain';
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
