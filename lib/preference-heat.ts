import type {Vote} from './domain';
export function preferenceHeat(votes:Vote[]){
  const bySlot:Record<string,number>={},byDay:Record<string,number>={};
  for(const vote of votes)for(const [key,status] of Object.entries(vote.slots))if(status==='yes'||status==='maybe'){
    bySlot[key]=(bySlot[key]||0)+1;
    const day=key.split('@')[0];byDay[day]=(byDay[day]||0)+1;
  }
  return {bySlot,byDay,maxSlot:Math.max(0,...Object.values(bySlot)),maxDay:Math.max(0,...Object.values(byDay))};
}
export function heatStyle(count:number,max:number){
  if(!count||!max)return {background:'#ffffff',color:'#5d6267'};
  const ratio=count/max;
  const channel=(light:number,dark:number)=>Math.round(light+(dark-light)*ratio);
  return {background:`rgb(${channel(245,83)}, ${channel(246,91)}, ${channel(247,98)})`,color:ratio>=.85?'#ffffff':'#202124'};
}
