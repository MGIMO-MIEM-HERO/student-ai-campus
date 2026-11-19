import {S} from './state.js';
import {esc, mskNow, toMin} from './util.js';
import {interiorLayout, interiorSvg} from './interior-layout.js';
import {buildRoute,routeSvg} from './wayfinding.js';
import {scheduleEntries,roomKey} from './schedule-navigation.js';

export const mapDate = () => S.mapDate || S.data.campus.rooms_date;
export const roomsIsToday = () => mapDate() === mskNow().date;
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
let occupancyData,personalOccupancy;
export function roomState(key, pair, date = mapDate()) {
  const room = roomByKey(key);
  if (!room?.seats) return {cls: 'off', text: 'Служебное помещение'};
  if(occupancyData!==S.data){occupancyData=S.data;personalOccupancy=new Map(scheduleEntries(S.data).filter(({lesson:l})=>!l.cancelled&&l.format!=='Онлайн').map(({lesson:l,date})=>[`${date}/${l.pair}/${roomKey(l)}`,l]));}
  const mine=personalOccupancy.get(`${date}/${pair}/${key}`);
  if(mine)return {cls:'busy',text:`Ваше занятие: ${mine.title}`};
  if(date!==S.data.campus.rooms_date)return {cls:'unknown',text:'Нет данных об общей занятости на этот день'};
  const mark = (S.data.campus.busy[String(pair)] || {})[key];
  if (!mark) return {cls: 'free', text: 'Свободна'};
  return mark.by === 'staff' ? {cls: 'staff', text: `Занята: ${mark.note}`} : {cls: 'busy', text: mark.note};
}
export function freeRooms(pair, buildingId, date = mapDate()) {
  return S.data.campus.rooms.filter((r) => r.seats && (!buildingId || r.building === buildingId) && roomState(r.key, pair, date).cls === 'free');
}
/* ---------- Планы этажей ----------
   Этаж — прямоугольник корпуса с коридором посередине. Аудитории стоят по обе стороны коридора,
   ширина зависит от вместимости. У каждой аудитории дверь в коридор с дугой открывания и мебель
   по типу: ряды амфитеатра, парты, компьютерные столы, стойка деканата, разметка зала. */
const PW = 600, PH = 224, PM = 8, CY0 = 94, CY1 = 130, CORE0 = 266, CORE1 = 334;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const n1 = (v) => Math.round(v * 10) / 10;
function spread(rooms, x0, x1, y0, y1, side) {
  const weights = rooms.map((r) => clamp(r.seats || 24, 26, 80));
  const total = weights.reduce((s, w) => s + w, 0);
  let x = x0;
  return rooms.map((r, i) => { const w = (x1 - x0) * weights[i] / total; const box = {r, x, y: y0, w, h: y1 - y0, side}; x += w; return box; });
}
export function floorLayout(buildingId, floor) {
  const rooms = S.data.campus.rooms.filter((r) => r.building === buildingId && r.floor === floor).sort((a, b) => a.room.localeCompare(b.room));
  if (buildingId === 'А') return interiorLayout(rooms);
  const north = rooms.slice(0, Math.ceil(rooms.length / 2)), south = rooms.slice(Math.ceil(rooms.length / 2)).reverse();
  const row = (list, y0, y1, side) => {
    const left = list.slice(0, Math.ceil(list.length / 2)), right = list.slice(Math.ceil(list.length / 2));
    return [...(left.length ? spread(left, PM, CORE0, y0, y1, side) : []), ...(right.length ? spread(right, CORE1, PW - PM, y0, y1, side) : [])];
  };
  const boxes = [...row(north, PM, CY0, 'n'), ...row(south, CY1, PH - PM, 's')];
  const voids = [];
  for (const [list, y0, y1] of [[north, PM, CY0], [south, CY1, PH - PM]]) {
    if (Math.ceil(list.length / 2) === list.length) voids.push({x: CORE1, y: y0, w: PW - PM - CORE1, h: y1 - y0});
    if (!list.length) voids.push({x: PM, y: y0, w: CORE0 - PM, h: y1 - y0});
  }
  return {
    boxes,
    voids,
    // Те же проходы, что нарисованы на плане, включая вестибюль у главного входа.
    corridors: [
      {x: PM, y: CY0, w: PW - 2 * PM, h: CY1 - CY0},
      {x: CORE0, y: PM, w: CORE1 - CORE0, h: CY0 - PM},
      {x: CORE0, y: CY1, w: CORE1 - CORE0, h: PH - PM - CY1},
    ],
  };
}
export function currentRoute() {
  if(!S.routeEnabled||!S.room||S.routeBlocked)return null;
  const target=roomByKey(S.room);if(!target)return null;
  return buildRoute({target,origin:S.routeOrigin||'entry',rooms:S.data.campus.rooms,layoutFor:(floor)=>floorLayout(target.building,floor)});
}
export function routeForFloor(building,floor) {
  const route=currentRoute();return route?.target.building===building?route.segments.find((s)=>s.floor===floor):null;
}
function furniture(b) {
  const {x, y, w, h, side, r} = b, out = [];
  const outer = side === 'n' ? y + 5 : y + h - 5, dir = side === 'n' ? 1 : -1;
  const kind = r.kind.toLowerCase();
  if (!r.seats) {
    out.push(`<rect x="${n1(x + w * .18)}" y="${n1(side === 'n' ? y + h * .2 : y + h * .5)}" width="${n1(w * .64)}" height="${n1(h * .14)}" rx="2"/>`);
    for (let i = 0; i < 3; i++) out.push(`<rect x="${n1(x + w * (.2 + i * .22))}" y="${n1(side === 'n' ? y + h * .5 : y + h * .18)}" width="${n1(w * .14)}" height="${n1(h * .14)}" rx="2"/>`);
  } else if (kind.includes('спорт')) {
    out.push(`<rect x="${n1(x + 10)}" y="${n1(y + 10)}" width="${n1(w - 20)}" height="${n1(h - 20)}" rx="2"/><path d="M${n1(x + w / 2)} ${n1(y + 10)}V${n1(y + h - 10)}"/><circle cx="${n1(x + w / 2)}" cy="${n1(y + h / 2)}" r="${n1(Math.min(w, h) * .14)}"/>`);
  } else if (r.seats >= 60) {
    const cx = x + w / 2;
    out.push(`<path class="board" d="M${n1(cx - w * .22)} ${n1(outer)}H${n1(cx + w * .22)}"/>`);
    const a0 = side === 'n' ? 22 : 202, a1 = side === 'n' ? 158 : 338, rad = (d) => d * Math.PI / 180;
    for (let i = 0; i < 4; i++) {
      const rr = Math.min(h * (.32 + i * .15), w * .48);
      out.push(`<path d="M${n1(cx + rr * Math.cos(rad(a0)))} ${n1(outer + rr * Math.sin(rad(a0)))}A${n1(rr)} ${n1(rr)} 0 0 1 ${n1(cx + rr * Math.cos(rad(a1)))} ${n1(outer + rr * Math.sin(rad(a1)))}"/>`);
    }
  } else if (kind.includes('компьютер')) {
    const cols = Math.max(2, Math.floor((w - 16) / 18));
    for (const fy of [.24, .62]) {
      out.push(`<path d="M${n1(x + 8)} ${n1(y + h * fy)}H${n1(x + w - 8)}"/>`);
      for (let i = 0; i < cols; i++) out.push(`<rect x="${n1(x + 10 + i * ((w - 20) / cols))}" y="${n1(y + h * fy - 6)}" width="9" height="5" rx="1"/>`);
    }
  } else {
    out.push(`<path class="board" d="M${n1(x + w * .25)} ${n1(outer)}H${n1(x + w * .75)}"/>`);
    const cols = clamp(Math.floor((w - 16) / 20), 1, 6), rows = r.seats > 32 ? 4 : 3;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const dx = x + 10 + i * ((w - 20) / cols) + 2, dy = side === 'n' ? y + 18 + j * ((h - 34) / rows) : y + h - 18 - (j + 1) * ((h - 34) / rows) + 6;
      out.push(`<rect x="${n1(dx)}" y="${n1(dy)}" width="${n1((w - 20) / cols - 4)}" height="5" rx="1"/>`);
    }
  }
  return `<g class="fur">${out.join('')}</g>`;
}
function door(b) {
  const hinge = b.x + 6, leaf = 14, yy = b.side === 'n' ? CY0 : CY1, s = b.side === 'n' ? -1 : 1;
  return `<path class="gap" d="M${n1(hinge)} ${yy}H${n1(hinge + leaf)}"/><path class="leaf" d="M${n1(hinge)} ${yy}V${n1(yy + s * leaf)}A${leaf} ${leaf} 0 0 ${b.side === 'n' ? 1 : 0} ${n1(hinge + leaf)} ${yy}"/>`;
}
function core(floor, buildingId) {
  const steps = Array.from({length: 9}, (_, i) => `<path d="M${CORE0 + 6} ${n1(PM + 8 + i * 8.5)}H${CORE0 + 34}"/>`).join('');
  return `<g class="core"><rect x="${CORE0}" y="${PM}" width="${CORE1 - CORE0}" height="${CY0 - PM}"/>${steps}<path d="M${CORE0 + 20} ${PM + 80}V${PM + 14}l-4 6m4-6l4 6"/>
    <rect class="lift" x="${CORE0 + 40}" y="${PM + 10}" width="22" height="22"/><path d="M${CORE0 + 40} ${PM + 10}l22 22m0-22l-22 22"/>
    <rect x="${CORE0}" y="${CY1}" width="${CORE1 - CORE0}" height="${PH - PM - CY1}"/>${floor === 1 ? '' : `<path d="M${CORE0 + 34} ${CY1}V${PH - PM}"/>`}
    ${floor === 1 ? '' : `<text class="tiny" x="${CORE0 + 17}" y="${CY1 + 50}">WC</text><text class="tiny" x="${CORE0 + 51}" y="${CY1 + 50}">WC</text>`}
    <text class="tiny" x="${CORE0 + 51}" y="${PM + 52}">лифт</text><text class="tiny" x="${CORE0 + 51}" y="${PM + 66}">лестн.</text></g>
    ${floor === 1 ? `<g class="entry"><path d="M${CORE0 + 10} ${PH - PM}H${CORE1 - 10}" /><text class="tiny strong" x="${CORE0 + 15}" y="${PH - PM - 10}">Вход</text><text class="tiny" x="${CORE1 - 16}" y="${CY1 + 44}">холл</text></g>` : ''}
    ${floor === 2 && buildingId === 'А' ? `<g class="entry"><path d="M${PW - PM} ${CY0 + 8}V${CY1 - 8}"/><text class="tiny strong" x="${PW - PM - 62}" y="${CY0 + 22}">Переход в Б</text></g>` : ''}`;
}
export function floorSvg(buildingId, floor, pair, {mine = new Set(), selected = '', mini = false} = {}) {
  if (buildingId === 'А') return interiorSvg(floorLayout(buildingId, floor), pair, {mine, selected, mini,route:routeForFloor(buildingId,floor)}, roomState);
  const {boxes, voids} = floorLayout(buildingId, floor);
  const rooms = boxes.map((b) => {
    const st = roomState(b.r.key, pair), cls = mine.has(b.r.key) ? 'mine' : st.cls, sel = selected === b.r.key;
    const label = `Аудитория ${b.r.room}, ${b.r.kind.toLowerCase()}${b.r.seats ? `, ${b.r.seats} мест` : ''}. ${mine.has(b.r.key) ? 'Ваше занятие. ' : ''}${st.text}`;
    const cx = b.x + b.w / 2, cy = b.side === 'n' ? b.y + b.h * .6 : b.y + b.h * .42;
    const attrs = mini ? '' : ` data-room3="${esc(b.r.key)}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="${esc(label)}"`;
    return `<g class="rm ${cls} ${sel ? 'sel' : ''}"${attrs}><rect class="room" x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}"/>${furniture(b)}${door(b)}
      ${mini ? '' : `<text class="no" x="${n1(cx)}" y="${n1(cy)}">${esc(b.r.room)}</text>${b.w > 50 ? `<text class="seats" x="${n1(cx)}" y="${n1(cy + 14)}">${b.r.seats ? `${b.r.seats} мест` : esc(b.r.kind)}</text>` : ''}`}</g>`;
  }).join('');
  const holes = voids.map((v) => `<rect class="void" x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}"/>${mini ? '' : `<text class="tiny" x="${v.x + v.w / 2}" y="${v.y + v.h / 2 + 4}">холл</text>`}`).join('');
  return `<svg class="${mini ? 'plan-mini' : 'plan'}" viewBox="0 0 ${PW} ${PH}" ${mini ? 'aria-hidden="true" focusable="false"' : `role="group" aria-label="План: корпус ${esc(buildingId)}, ${floor} этаж"`}>
    <rect class="shell" x="${PM}" y="${PM}" width="${PW - 2 * PM}" height="${PH - 2 * PM}"/><rect class="corridor" x="${PM}" y="${CY0}" width="${PW - 2 * PM}" height="${CY1 - CY0}"/>
    ${mini ? '' : `<text class="tiny corr" x="${PM + 120}" y="${CY0 + 22}">коридор</text>`}${holes}${rooms}${core(floor, buildingId)}${mini?'':routeSvg(routeForFloor(buildingId,floor))}</svg>`;
}
export function activeFloor(buildingId, mine = new Set()) {
  const b = S.data.campus.buildings.find((x) => x.id === buildingId);
  if (S.floor && S.floor <= b.floors) return S.floor;
  const sel = S.room && roomByKey(S.room);
  if (sel && sel.building === buildingId) return sel.floor;
  const my = [...mine].map(roomByKey).find((r) => r && r.building === buildingId);
  return my ? my.floor : 1;
}
/** Shared floor selector with a WebGL cutaway and accessible SVG plan. */
export function building3d(buildingId, pair, {mine = new Set(), selected = ''} = {}) {
  const b = S.data.campus.buildings.find((x) => x.id === buildingId), cur = activeFloor(buildingId, mine);
  const chips = Array.from({length: b.floors}, (_, i) => `<button class="chip" data-floor="${i + 1}" aria-pressed="${i + 1 === cur}">${i + 1} этаж</button>`).join('');
  return `<div class="campus-plan"><div class="model-view floor-model" data-scene="floor" data-building="${esc(buildingId)}" data-floor-number="${cur}" data-pair-number="${pair}" data-selected-room="${esc(selected)}" data-mine="${esc([...mine].join(','))}"><div class="model-modes" role="group" aria-label="Представление модели"><button data-model-mode="building" aria-pressed="${S.modelMode !== 'floor'}">Корпус</button><button data-model-mode="floor" aria-pressed="${S.modelMode === 'floor'}">Этаж</button><button type="button" data-scene-mode aria-pressed="false">Вечер</button></div><button class="model-tour" data-model-action="tour" aria-pressed="false">Облёт</button><div class="model-stamp"><span>${cur} этаж</span><small>Учебная демо-модель</small></div><div class="scene-status" data-scene-status role="status">Собираем этаж…</div><div class="model-controls" role="group" aria-label="Вид этажа"><button data-model-action="left" aria-label="Повернуть этаж влево">↶</button><button data-model-action="reset" aria-label="Вернуть исходный вид">↺</button><button data-model-action="zoom-in" aria-label="Приблизить этаж">+</button><button data-model-action="zoom-out" aria-label="Отдалить этаж">−</button><button data-model-action="top" aria-label="Посмотреть этаж сверху">Вид сверху</button></div></div>
    <div class="plan-side"><div class="chips floor-chips" role="group" aria-label="Этаж">${chips}</div><div class="plan-scroll">${floorSvg(buildingId, cur, pair, {mine, selected})}</div></div></div>`;
}
export const legend3d = (staff = false) => `<div class="legend"><span><i class="sw sw-free"></i>свободна</span>${mapDate()===S.data.campus.rooms_date?'<span><i class="sw sw-busy"></i>занята по расписанию</span>':'<span><i class="sw sw-busy"></i>нет данных по другим занятиям</span>'}<span><i class="sw sw-staff"></i>отмечено деканатом</span>${staff ? '' : '<span><i class="sw sw-mine"></i>ваше занятие</span>'}<span><i class="sw sw-off"></i>служебное</span></div>`;
export function pairChips(pair) {
  const now = defaultPair();
  return `<div class="chips" role="group" aria-label="Пара">${S.data.campus.bells.map((b) => `<button class="chip" data-pair="${b.pair}" aria-pressed="${b.pair === pair}">${b.pair} пара · ${b.start}${b.pair === now && roomsIsToday() ? ' · сейчас' : ''}</button>`).join('')}</div>`;
}
export function buildingSeg() {
  return `<div class="seg" role="group" aria-label="Корпус">${S.data.campus.buildings.map((b) => `<button data-bld="${esc(b.id)}" aria-pressed="${S.bld === b.id}">Корпус ${esc(b.id)}<small>${esc(b.name.replace('Учебный корпус ', 'учебный ').replace('Спортивный комплекс', 'спорткомплекс'))}</small></button>`).join('')}</div>`;
}
