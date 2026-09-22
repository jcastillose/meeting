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
  const palette=[[237,246,240],[200,228,210],[139,197,165],[76,152,120],[40,99,76]];
  const position=Math.min(1,count/max)*(palette.length-1);
  const index=Math.min(Math.floor(position),palette.length-2),fraction=position-index;
  const rgb=palette[index].map((value,i)=>Math.round(value+(palette[index+1][i]-value)*fraction));
  const linear=rgb.map(value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
  const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  return {background:`rgb(${rgb.join(', ')})`,color:luminance<.18?'#ffffff':'#152b22'};
}
