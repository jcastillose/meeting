import {date,slotLabel,meetingFits,type Poll} from './domain';
import {validDate} from './schedule';
export function validMeetingSelection(poll:Poll,key:string,selectedDate?:string){
 if(!meetingFits(poll,key))return false;
 if(poll.mode==='dates')return true;
 if(!selectedDate||!validDate(selectedDate))return false;
 const d=date(selectedDate),day=key.split('@')[0];
 return poll.mode==='week'?(d.getDay()+6)%7===Number(day.slice(1)):d.getDate()===Number(day.slice(1));
}
export function selectedMeetingLabel(poll:Poll){
 if(!poll.selectedSlot)return '';
 const key=poll.mode==='dates'?poll.selectedSlot:`${poll.selectedDate}@${poll.selectedSlot.split('@')[1]}`;
 return slotLabel({...poll,mode:'dates'},key,poll.duration||poll.step)+' · '+key.slice(0,4)+' · '+poll.timezone;
}
