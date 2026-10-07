export interface IcsEvent {
  uid: string;
  title: string;
  start: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  end?: string;
  description?: string;
}

export function generateIcs(events: IcsEvent[], calName: string = 'BrewDesk'): string {
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BrewDesk//Gestione Birrificio//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
  ];

  for (const ev of events) {
    const isFullDay = !ev.start.includes('T');
    const startClean = ev.start.replace(/[-:]/g, '');
    let endClean = (ev.end || ev.start).replace(/[-:]/g, '');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${nowStr}`);

    if (isFullDay) {
      lines.push(`DTSTART;VALUE=DATE:${startClean}`);
      // next day for full-day inclusive end
      const d = new Date(ev.start);
      d.setDate(d.getDate() + 1);
      const nextDayStr = d.toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTEND;VALUE=DATE:${nextDayStr}`);
    } else {
      lines.push(`DTSTART:${startClean}00`);
      lines.push(`DTEND:${endClean}00`);
    }

    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getGoogleCalendarUrl(title: string, dateStr: string, description: string = ''): string {
  const isFullDay = !dateStr.includes('T');
  let datesParam: string;

  if (isFullDay) {
    const d1 = dateStr.replace(/-/g, '');
    const dObj = new Date(dateStr);
    dObj.setDate(dObj.getDate() + 1);
    const d2 = dObj.toISOString().slice(0, 10).replace(/-/g, '');
    datesParam = `${d1}/${d2}`;
  } else {
    const clean = dateStr.replace(/[-:]/g, '');
    datesParam = `${clean}00/${clean}00`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: datesParam,
    details: description,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
