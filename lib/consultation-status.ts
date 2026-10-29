import type {Poll} from './domain';

export type ConsultationStatus = 'open' | 'expired' | 'closed';

function localDateAndMinute(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value || '00';
  return {day: `${value('year')}-${value('month')}-${value('day')}`, minute: Number(value('hour')) * 60 + Number(value('minute'))};
}

export function consultationStatus(poll: Poll, now = new Date()): ConsultationStatus {
  if (poll.closed) return 'closed';
  if (poll.mode !== 'dates') return 'open';
  const ranges = poll.dailyRanges?.length ? poll.dailyRanges : [{date: poll.end, to: poll.to}];
  const last = ranges.reduce((latest, range) =>
    range.date > latest.date || range.date === latest.date && range.to > latest.to ? range : latest,
  );
  const local = localDateAndMinute(now, poll.timezone || 'America/Santiago');
  return local.day > last.date || local.day === last.date && local.minute >= last.to ? 'expired' : 'open';
}
