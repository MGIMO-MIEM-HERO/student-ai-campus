/* Объёмные объекты на CSS 3D без библиотек.
   Базовый элемент — «брус»: верхняя грань и четыре боковые. Размеры и положение задаются
   переменными через data-vars (CSP запрещает inline-стили, переменные ставит main.js). */
import {S} from './state.js';
import {esc, mskNow, fmt} from './util.js';

/** Брус: x, y — положение на плоскости (центр сцены = 0,0), z — высота над плоскостью. */
function slab({x = 0, y = 0, z = 0, w, d, h, r = 0, tilt = 0, cls = '', top = ''}) {
  return `<div class="slab ${cls}" data-vars="--x:${x};--y:${y};--z:${z};--w:${w};--d:${d};--h:${h};--r:${r};--tilt:${tilt}"><i class="f-n"></i><i class="f-w"></i><i class="f-e"></i><i class="f-s"></i><i class="f-top">${top}</i></div>`;
}
const shadow = (x, y, w, d) => `<div class="gshadow" data-vars="--x:${x};--y:${y};--w:${w};--d:${d}"></div>`;
function scene(inner, {cls = '', label = ''} = {}) {
  return `<div class="scene ${cls}" data-drag3d role="img" aria-label="${esc(label)}"><div class="stage3d" data-vars="--rz:${S.rz}deg"><div class="sway">${inner}</div></div></div>`;
}

/* Книга лежит обложкой вверх: корешок на ближней длинной стороне, остальные стороны — обрез. */
const book = (o) => slab({w: 150, d: 108, h: 24, ...o, cls: `book ${o.cls || ''}`, top: '<b></b><u></u><u></u>'});

/** Стопка учебников с закладкой и ручкой. */
export function sceneBooks(opts = {}) {
  return scene([
    shadow(-92, -62, 190, 140),
    book({x: -84, y: -58, z: 0, r: -4, cls: 'm-navy'}),
    book({x: -70, y: -50, z: 25, r: 7, w: 138, d: 100, h: 20, cls: 'm-burg'}),
    book({x: -78, y: -52, z: 46, r: -10, w: 128, d: 94, h: 28, cls: 'm-ivory'}),
    slab({x: -18, y: -30, z: 75, w: 96, d: 7, h: 7, r: 24, cls: 'pen'}),
  ].join(''), {label: 'Стопка учебников', ...opts});
}

/** Раскрытая папка с документами. */
export function sceneFolder(opts = {}) {
  return scene([
    shadow(-100, -70, 210, 150),
    slab({x: -92, y: -64, z: 0, w: 184, d: 128, h: 5, cls: 'm-navy folder-back'}),
    slab({x: -80, y: -56, z: 6, w: 150, d: 108, h: 1.5, r: -3, cls: 'paper'}),
    slab({x: -78, y: -58, z: 8, w: 150, d: 108, h: 1.5, r: 2, cls: 'paper'}),
    slab({x: -74, y: -54, z: 10, w: 150, d: 108, h: 1.5, r: 6, cls: 'paper lined', top: '<b></b><u></u><u></u><u></u><s></s>'}),
    slab({x: -92, y: -64, z: 5, w: 184, d: 128, h: 4, tilt: -52, cls: 'm-navy folder-front', top: '<b></b>'}),
    slab({x: 44, y: -76, z: 0, w: 40, d: 12, h: 5, cls: 'm-brass'}),
  ].join(''), {label: 'Папка с документами', ...opts});
}

/** Отрывной календарь с сегодняшней датой по Москве. */
export function sceneCalendar(opts = {}) {
  const iso = mskNow().date;
  const top = `<span class="cal"><em>${esc(fmt(iso, {month: 'long'}))}</em><strong>${esc(fmt(iso, {day: 'numeric'}))}</strong><small>${esc(fmt(iso, {weekday: 'long'}))}</small></span>`;
  return scene([
    shadow(-78, -84, 160, 172),
    slab({x: -70, y: -78, z: 0, w: 140, d: 156, h: 8, cls: 'm-navy'}),
    slab({x: -62, y: -70, z: 8, w: 124, d: 140, h: 34, cls: 'paper block', top}),
    slab({x: -62, y: -70, z: 42, w: 124, d: 16, h: 4, cls: 'm-brass'}),
  ].join(''), {label: `Календарь, сегодня ${fmt(iso, {day: 'numeric', month: 'long'})}`, ...opts});
}

/** Модель учебного корпуса: стилобат, главный объём с окнами, крыло, портик. */
export function sceneCampus(opts = {}) {
  const cols = [0, 1, 2, 3].map((i) => slab({x: -46 + i * 24, y: 58, z: 6, w: 7, d: 7, h: 44, cls: 'm-ivory'})).join('');
  return scene([
    shadow(-128, -92, 256, 190),
    slab({x: -120, y: -86, z: 0, w: 240, d: 172, h: 6, cls: 'm-stone'}),
    slab({x: -72, y: -52, z: 6, w: 144, d: 96, h: 96, cls: 'm-navy windows'}),
    slab({x: -78, y: -58, z: 102, w: 156, d: 108, h: 5, cls: 'm-brass'}),
    slab({x: 72, y: -40, z: 6, w: 40, d: 72, h: 58, cls: 'm-navy windows'}),
    slab({x: 68, y: -44, z: 64, w: 48, d: 80, h: 4, cls: 'm-brass'}),
    cols,
    slab({x: -54, y: 48, z: 50, w: 96, d: 24, h: 6, cls: 'm-ivory'}),
    slab({x: -60, y: 66, z: 0, w: 108, d: 18, h: 3, cls: 'm-ivory'}),
  ].join(''), {label: 'Модель учебного корпуса', ...opts});
}

/** Большая композиция для экрана входа: корпус, книги и папка на одной плоскости. */
export function sceneDesk(opts = {}) {
  const cols = [0, 1, 2, 3].map((i) => slab({x: -86 + i * 22, y: 6, z: 6, w: 6, d: 6, h: 40, cls: 'm-ivory'})).join('');
  return scene([
    shadow(-190, -150, 380, 300),
    slab({x: -182, y: -144, z: 0, w: 364, d: 288, h: 6, cls: 'm-stone'}),
    slab({x: -110, y: -96, z: 6, w: 132, d: 88, h: 92, cls: 'm-navy windows'}),
    slab({x: -116, y: -102, z: 98, w: 144, d: 100, h: 5, cls: 'm-brass'}),
    slab({x: 22, y: -84, z: 6, w: 38, d: 64, h: 54, cls: 'm-navy windows'}),
    slab({x: 18, y: -88, z: 60, w: 46, d: 72, h: 4, cls: 'm-brass'}),
    cols,
    slab({x: -94, y: -4, z: 46, w: 88, d: 22, h: 6, cls: 'm-ivory'}),
    book({x: 44, y: 24, z: 6, r: -8, w: 118, d: 86, h: 20, cls: 'm-burg'}),
    book({x: 52, y: 30, z: 27, r: 6, w: 108, d: 80, h: 18, cls: 'm-ivory'}),
    slab({x: -160, y: 46, z: 6, w: 132, d: 92, h: 4, r: 4, cls: 'm-navy folder-back'}),
    slab({x: -152, y: 52, z: 11, w: 110, d: 78, h: 1.5, r: 9, cls: 'paper lined', top: '<b></b><u></u><u></u><u></u><s></s>'}),
  ].join(''), {label: 'Учебный корпус, учебники и папка с документами', cls: 'xl', ...opts});
}
