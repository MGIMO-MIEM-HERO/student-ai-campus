import {S} from './state.js';
import {esc, mskNow, toMin, fmt, weekdayShort} from './util.js';
import {roomState, defaultPair} from './campus.js';

const DAY_START = toMin('09:00'), DAY_END = toMin('19:10'), SPAN = DAY_END - DAY_START;
export const TYPE_TONE = {'Лекция': 't-lec', 'Семинар': 't-sem', 'Практика': 't-prac', 'Лабораторная работа': 't-lab'};
const pos = (hhmm) => Math.max(0, Math.min(100, ((toMin(hhmm) - DAY_START) / SPAN) * 100));
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/* Кольцо прогресса. Значение рисуется анимацией при появлении. */
export function ring(pct, {size = 120, stroke = 8, label = '', tone = 'ink'} = {}) {
  const r = 50 - stroke / 2;
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  return `<svg class="ring ring-${tone}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(label)}">
    <circle class="ring-bg" cx="50" cy="50" r="${r}" pathLength="100" stroke-width="${stroke}"/>
    <circle class="ring-val" cx="50" cy="50" r="${r}" pathLength="100" stroke-width="${stroke}" stroke-dasharray="${value} 100" transform="rotate(-90 50 50)" data-pct="${value}"/></svg>`;
}

/* Мини-график накопления баллов с линией порога допуска. */
export function sparkline(values, {threshold = 60, max = 100, label = ''} = {}) {
  if (!values?.length) return '';
  const n = values.length, x = (i) => (n === 1 ? 100 : (i / (n - 1)) * 100), y = (v) => 30 - (v / max) * 28;
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `0,30 ${pts} 100,30`;
  const last = values[n - 1];
  return `<svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">
    <polygon class="spark-area" points="${area}"/><line class="spark-th" x1="0" x2="100" y1="${y(threshold).toFixed(1)}" y2="${y(threshold).toFixed(1)}"/>
    <polyline class="spark-line ${last < threshold ? 'low' : ''}" points="${pts}" pathLength="100"/></svg>`;
}

/* Шкала дня: пары как блоки на ленте 09:00–19:10, отметка «сейчас». */
export function dayTimeline(dayData, iso) {
  const t = mskNow();
  const lessons = dayData?.lessons || [];
  const blocks = lessons.map((l) => {
    const now = !l.cancelled && iso === t.date && toMin(l.start) <= t.minutes && t.minutes < toMin(l.end);
    return `<button class="db-block ${TYPE_TONE[l.type] || ''} ${l.cancelled ? 'cancel' : ''} ${now ? 'is-live' : ''} ${l.change && !l.cancelled ? 'changed' : ''}" data-lesson="${esc(l.id)}" data-vars="--l:${pos(l.start)};--w:${pos(l.end) - pos(l.start)}" aria-label="${l.start}–${l.end}, ${esc(l.title)}${l.cancelled ? ', отменено' : ''}"><span>${l.pair}</span></button>`;
  }).join('');
  const marker = iso === t.date && t.minutes >= DAY_START && t.minutes <= DAY_END ? `<span class="db-now" data-vars="--l:${((t.minutes - DAY_START) / SPAN) * 100}" aria-hidden="true"><b>${hhmm(t.minutes)}</b></span>` : '';
  const ticks = S.data.campus.bells.map((b) => `<span data-vars="--l:${pos(b.start)}">${b.start}</span>`).join('');
  return `<div class="daybar"><div class="db-track">${blocks}${marker}</div><div class="db-ticks" aria-hidden="true">${ticks}</div></div>`;
}

/* Недельная сетка расписания для компьютера. */
export function weekGrid(week, todayIso, selected) {
  const t = mskNow();
  const axis = S.data.campus.bells.map((b) => `<span data-vars="--t:${pos(b.start)}">${b.start}</span>`).join('');
  const lines = S.data.campus.bells.map((b) => `<i data-vars="--t:${pos(b.start)}"></i>`).join('');
  const cols = week.slice(0, 6).map((d) => {
    const events = d.lessons.map((l) => `<button class="wk-ev ${TYPE_TONE[l.type] || ''} ${l.cancelled ? 'cancel' : ''} ${l.change && !l.cancelled ? 'changed' : ''}" data-lesson="${esc(l.id)}" data-vars="--t:${pos(l.start)};--h:${pos(l.end) - pos(l.start)}">
      <span class="wk-time">${l.start}–${l.end}${l.change ? '<i class="dot"></i>' : ''}</span><span class="wk-title">${esc(l.title)}</span><span class="wk-place">${l.building ? `${esc(l.building)}-${esc(l.room)}` : 'Онлайн'}</span></button>`).join('');
    const nowLine = d.date === t.date && t.minutes >= DAY_START && t.minutes <= DAY_END ? `<span class="wk-now" data-vars="--t:${((t.minutes - DAY_START) / SPAN) * 100}"></span>` : '';
    return `<div class="wk-col ${d.date === todayIso ? 'today' : ''} ${d.date === selected ? 'sel' : ''}"><button class="wk-head" data-day="${d.date}"><small>${weekdayShort(d.date)}</small><b>${fmt(d.date, {day: 'numeric'})}</b></button><div class="wk-body">${lines}${events}${nowLine}</div></div>`;
  }).join('');
  return `<div class="wk" role="group" aria-label="Неделя"><div class="wk-axis"><span class="wk-head-sp"></span><div class="wk-axis-body">${axis}</div></div>${cols}</div>`;
}

/* Тепловая карта корпуса: этажи сверху вниз, аудитории точками. */
export function heatmap(buildingId, pair = defaultPair()) {
  const b = S.data.campus.buildings.find((x) => x.id === buildingId);
  const rows = [];
  for (let f = b.floors; f >= 1; f--) {
    const rooms = S.data.campus.rooms.filter((r) => r.building === buildingId && r.floor === f);
    rows.push(`<div class="hm-row"><span>${f}</span>${rooms.map((r) => `<i class="${roomState(r.key, pair).cls}"></i>`).join('')}</div>`);
  }
  return `<div class="hm" role="img" aria-label="Схема свободных аудиторий корпуса ${esc(buildingId)}">${rows.join('')}</div>`;
}

/* Мини-трекер заявки. */
export function miniTrack(status, steps) {
  const idx = steps.indexOf(status);
  return `<div class="mtrack" aria-hidden="true">${steps.map((s, i) => `<i class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"></i>`).join('<b></b>')}</div>`;
}
