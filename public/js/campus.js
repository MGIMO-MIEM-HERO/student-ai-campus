import {S} from './state.js';
import {esc, mskNow, toMin} from './util.js';

export const roomsIsToday = () => S.data.campus.rooms_date === mskNow().date;
export function defaultPair() {
  const t = mskNow(), bells = S.data.campus.bells;
  if (!roomsIsToday()) return bells[0].pair;
  return (bells.find((b) => t.minutes < toMin(b.end)) || bells[bells.length - 1]).pair;
}
export function roomsDayNote() {
  if (roomsIsToday()) return '';
  return `<p class="small muted">Сегодня корпуса закрыты, показана занятость на ${new Intl.DateTimeFormat('ru-RU', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'}).format(new Date(S.data.campus.rooms_date + 'T12:00:00Z'))}.</p>`;
}
export const activePair = () => S.pair || defaultPair();
export const roomByKey = (key) => S.data.campus.rooms.find((r) => r.key === key);
export function roomState(key, pair) {
  const room = roomByKey(key);
  if (!room?.seats) return {cls: 'off', text: 'Служебное помещение'};
  const mark = (S.data.campus.busy[String(pair)] || {})[key];
  if (!mark) return {cls: 'free', text: 'Свободна'};
  return mark.by === 'staff' ? {cls: 'staff', text: `Занята: ${mark.note}`} : {cls: 'busy', text: mark.note};
}
export function freeRooms(pair, buildingId) {
  return S.data.campus.rooms.filter((r) => r.seats && (!buildingId || r.building === buildingId) && roomState(r.key, pair).cls === 'free');
}
export function building3d(buildingId, pair, {mine = new Set(), selected = ''} = {}) {
  const b = S.data.campus.buildings.find((x) => x.id === buildingId);
  const floors = [];
  for (let f = 1; f <= b.floors; f++) {
    const rooms = S.data.campus.rooms.filter((r) => r.building === buildingId && r.floor === f);
    floors.push(`<div class="floor fl-${f}"><span class="fl-tag">${f} эт.</span>${rooms.map((r) => {
      const st = roomState(r.key, pair);
      const cls = mine.has(r.key) ? 'mine' : st.cls;
      return `<button class="r3 ${cls} ${selected === r.key ? 'sel' : ''}" data-room3="${esc(r.key)}" aria-label="Аудитория ${esc(r.room)}, ${f} этаж. ${mine.has(r.key) ? 'Ваше занятие. ' : ''}${esc(st.text)}" aria-pressed="${selected === r.key}">${esc(r.room)}</button>`;
    }).join('')}</div>`);
  }
  return `<div class="b3d n${b.floors}" role="group" aria-label="Схема этажей: ${esc(b.name)}" data-drag3d><div class="b3d-stage" data-vars="--rz:${S.rz}deg">${floors.join('')}</div></div>`;
}
export const legend3d = (staff = false) => `<div class="legend"><span><i class="sw sw-free"></i>свободна</span><span><i class="sw sw-busy"></i>занята по расписанию</span><span><i class="sw sw-staff"></i>занята: отмечено деканатом</span>${staff ? '' : '<span><i class="sw sw-mine"></i>ваше занятие</span>'}</div>`;
export function pairChips(pair) {
  const now = defaultPair();
  return `<div class="chips" role="group" aria-label="Пара">${S.data.campus.bells.map((b) => `<button class="chip" data-pair="${b.pair}" aria-pressed="${b.pair === pair}">${b.pair} пара · ${b.start}${b.pair === now && roomsIsToday() ? ' · сейчас' : ''}</button>`).join('')}</div>`;
}
export function buildingSeg() {
  return `<div class="seg" role="group" aria-label="Корпус">${S.data.campus.buildings.map((b) => `<button data-bld="${esc(b.id)}" aria-pressed="${S.bld === b.id}">Корпус ${esc(b.id)}<small>${esc(b.name.replace('Учебный корпус ', 'учебный ').replace('Спортивный комплекс', 'спорткомплекс'))}</small></button>`).join('')}</div>`;
}
