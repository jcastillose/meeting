import { days, type Poll, type DailyRange } from "./domain";
import { canonicalRanges, scheduleErrors } from "./schedule";
/** Additive edits only: old preferences always retain their meaning and keys. */
export function extendSchedule(
  poll: Poll,
  input: { ranges?: DailyRange[]; from?: number; to?: number },
) {
  if (poll.mode === "dates") {
    if (!input.ranges?.length) throw Error("Añade al menos un tramo.");
    const errors = scheduleErrors(
      input.ranges,
      poll.step,
      poll.duration || poll.step,
    );
    if (errors.length) throw Error(errors[0]);
    const existing =
      poll.dailyRanges ||
      days(poll).map((date) => ({ date, from: poll.from, to: poll.to }));
    const dailyRanges = canonicalRanges([...existing, ...input.ranges]);
    const combined = scheduleErrors(
      dailyRanges,
      poll.step,
      poll.duration || poll.step,
    );
    if (combined.length) throw Error(combined[0]);
    return {
      dailyRanges,
      start: dailyRanges[0].date,
      end: dailyRanges.at(-1)!.date,
      from: Math.min(...dailyRanges.map((r) => r.from)),
      to: Math.max(...dailyRanges.map((r) => r.to)),
    };
  }
  const { from, to } = input;
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from! < 0 ||
    to! > 1440 ||
    from! > poll.from ||
    to! < poll.to ||
    from! % poll.step ||
    to! % poll.step
  )
    throw Error(
      "Amplía el rango actual con horas alineadas al tamaño de bloque.",
    );
  return { from: from!, to: to! };
}


/** Replace proposals while keeping block size/duration and stable keys unchanged. */
export function replaceSchedule(poll:Poll,input:{ranges?:DailyRange[];from?:number;to?:number}){
 if(poll.mode==='dates'){
  const errors=scheduleErrors(input.ranges||[],poll.step,poll.duration||poll.step);
  if(errors.length)throw Error(errors[0]);
  const dailyRanges=canonicalRanges(input.ranges!);
  return {dailyRanges,start:dailyRanges[0].date,end:dailyRanges.at(-1)!.date,from:Math.min(...dailyRanges.map(r=>r.from)),to:Math.max(...dailyRanges.map(r=>r.to))};
 }
 const {from,to}=input;
 if(!Number.isInteger(from)||!Number.isInteger(to)||from!<0||to!>1440||to!<=from!||from!%poll.step||to!%poll.step||to!-from!<(poll.duration||poll.step))throw Error('Indica un rango válido, alineado a los bloques y suficiente para la reunión.');
 return {from:from!,to:to!};
}
