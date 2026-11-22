export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const TZ = 'Europe/Moscow';
export function mskNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'}).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return {date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute'))};
}
export const toMin = (hhmm) => { const [h, m] = hhmm.split(':'); return Number(h) * 60 + Number(m); };
export const utc = (iso) => new Date(iso.slice(0, 10) + 'T12:00:00Z');
export const fmt = (iso, opts) => new Intl.DateTimeFormat('ru-RU', {...opts, timeZone: 'UTC'}).format(utc(iso));
export const dayLong = (iso) => fmt(iso, {weekday: 'long', day: 'numeric', month: 'long'});
export const dayShort = (iso) => fmt(iso, {day: 'numeric', month: 'short'}).replace('.', '');
export const dayMonth = (iso) => fmt(iso, {day: 'numeric', month: 'long'});
export const weekdayShort = (iso) => fmt(iso, {weekday: 'short'}).replace('.', '');
export const stamp = (v) => (v && v.length > 10 ? `${dayShort(v)}, ${v.slice(11, 16)}` : dayShort(v));
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  return b === 1 ? forms[0] : forms[2];
}
export const count = (n, forms) => `${n} ${plural(n, forms)}`;
export function duration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  return h ? `${h} ч` : `${m} мин`;
}
export const daysBetween = (fromIso, toIso) => Math.round((utc(toIso) - utc(fromIso)) / 864e5);
export function relativeDay(iso, todayIso) {
  const d = daysBetween(todayIso, iso);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'завтра';
  if (d === -1) return 'вчера';
  return `${weekdayShort(iso)}, ${dayShort(iso)}`;
}
export function untilText(iso, todayIso) {
  const d = daysBetween(todayIso, iso);
  if (d < 0) return 'прошло';
  if (d === 0) return 'сегодня';
  if (d === 1) return 'завтра';
  return `через ${count(d, ['день', 'дня', 'дней'])}`;
}

/* календарь .ics */
const icsEscape = (v) => String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
function icsFold(line) {
  let out = '', seg = '', bytes = 0;
  const enc = new TextEncoder();
  for (const ch of line) {
    const size = enc.encode(ch).length;
    if (bytes + size > 75) { out += seg + '\r\n '; seg = ''; bytes = 1; }
    seg += ch; bytes += size;
  }
  return out + seg;
}
export function buildIcs(days) {
  const stampNow = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = [];
  for (const day of days) {
    const date = day.date.replaceAll('-', '');
    for (const l of day.lessons) {
      if (l.cancelled) continue;
      const description = [`${l.type}, ${l.pair} пара`, l.teacher?.name, l.groups ? `Группы: ${l.groups.join(', ')}` : '', l.subgroup, l.format === 'Онлайн' ? 'Онлайн (ссылка в LMS)' : '', l.change ? `${l.change.label}: ${l.change.was} → ${l.change.now}` : ''].filter(Boolean).join('\n');
      events.push(['BEGIN:VEVENT', `UID:${l.id}@campus-demo`, `DTSTAMP:${stampNow}`,
        `DTSTART;TZID=Europe/Moscow:${date}T${l.start.replace(':', '')}00`, `DTEND;TZID=Europe/Moscow:${date}T${l.end.replace(':', '')}00`,
        `SUMMARY:${icsEscape(l.title + ' (' + l.type.toLowerCase() + ')')}`, `LOCATION:${icsEscape(l.place)}`, `DESCRIPTION:${icsEscape(description)}`, 'END:VEVENT'].join('\r\n'));
    }
  }
  if (!events.length) return null;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Meridian concept//Schedule//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Moscow', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0300', 'TZNAME:MSK', 'END:STANDARD', 'END:VTIMEZONE',
    ...events.flatMap((e) => e.split('\r\n')), 'END:VCALENDAR'];
  return {text: lines.map(icsFold).join('\r\n'), count: events.length};
}
export function downloadIcs(ics, name) {
  const url = URL.createObjectURL(new Blob([ics.text], {type: 'text/calendar;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Скачивание текстового файла (CSV журнала и т. п.). */
export function downloadText(text, name, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* QR-код в SVG без inline-стилей */
import qrcode from './vendor/qrcode.js';
export function qrSvg(text) {
  const q = qrcode(0, 'M');
  q.addData(text); q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg class="qr" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="QR-код для проверки подлинности" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#030302"/></svg>`;
}
export const verifyUrl = (code) => `${location.origin}${location.pathname}#verify/${code}`;
