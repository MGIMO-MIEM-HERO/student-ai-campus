export {viewLibrary} from './library.js';
import {BUILDING_WING} from './campus-geometry.js';
import {S, lessonIndex} from './state.js';
import {icon} from './icons.js';
import {esc, mskNow, toMin, dayLong, dayShort, dayMonth, weekdayShort, stamp, count, plural, duration, daysBetween, relativeDay, untilText, cap, fmt, qrSvg, verifyUrl} from './util.js';
import {building3d, legend3d, pairChips, buildingSeg, activePair, activeFloor, roomByKey, roomState, freeRooms, roomsDayNote, roomsIsToday, defaultPair, mapDate} from './campus.js';
import {ring, sparkline, dayTimeline, weekGrid} from './viz.js';
import {territoryScene} from './scene-host.js';
import {navigationPanel,navigationCaption} from './navigation-ui.js';
import {scheduleEntries, nextPhysicalLesson} from './schedule-navigation.js';
import {routeMapCard, quickActions, idTeaser, gradeMini} from './home.js';
import {libraryShelf, BOOKS_COUNT, bookForCourse} from './library.js';

export const NAV = [['today', 'Сегодня', 'today'], ['schedule', 'Расписание', 'schedule'], ['tasks', 'Задания', 'tasks'], ['study', 'Учёба', 'study'], ['requests', 'Заявки', 'requests'], ['rooms', 'Корпуса', 'building']];
import {gradeBarsSection} from './gradebars.js';
import {deadlineStack} from './deadlines.js';
export const ROUTES = ['today', 'schedule', 'tasks', 'study', 'requests', 'rooms', 'news', 'notices', 'assistant', 'profile', 'doc', 'library'];
export const NAV_OF = {library: 'study', doc: 'requests', news: 'today', notices: 'today'};
export const DOCS = [
  {kind: 'Справка об обучении', ico: 'cap', tone: 'mint', what: 'Подтверждает, что вы обучаетесь в университете. Для военкомата, визы, банка, места работы.', sla: '1–2 рабочих дня', how: 'Электронная версия с QR-проверкой и оригинал в деканате'},
  {kind: 'Выписка об успеваемости', ico: 'study', tone: 'marigold', what: 'Перечень дисциплин с баллами и формой контроля за текущий семестр.', sla: '2–3 рабочих дня', how: 'Электронная версия с QR-проверкой и оригинал в деканате'},
  {kind: 'Обращение в деканат', ico: 'chat', tone: 'periwinkle', what: 'Вопрос по учёбе: индивидуальный график, пересдача, перевод, академический отпуск.', sla: 'Ответ до 5 рабочих дней', how: 'Ответ приходит в историю заявки'},
];
const STEPS = ['Принята', 'В работе', 'Готова', 'Выдана'];
const STATUS_TONE = {'Принята': 'periwinkle', 'В работе': 'marigold', 'Готова': 'mint', 'Выдана': '', 'Отклонена': 'papaya'};
const STATUS_HINT = {'Принята': 'Заявка получена деканатом.', 'В работе': 'Документ готовится.', 'Готова': 'Документ готов. Электронная версия доступна в кабинете, оригинал можно получить в деканате по студенческому билету.', 'Выдана': 'Документ выдан.', 'Отклонена': 'Заявка отклонена. Причина указана в комментарии.'};
const APPEAL = 'Обращение в деканат';
const APPEAL_STEP = {'Принята': 'Принято', 'В работе': 'На рассмотрении', 'Готова': 'Ответ готов', 'Выдана': 'Закрыто'};
const APPEAL_HINT = {'Принята': 'Обращение получено деканатом.', 'В работе': 'Обращение рассматривается.', 'Готова': 'Ответ готов, он в комментарии ниже.', 'Выдана': 'Обращение закрыто.', 'Отклонена': 'Обращение отклонено. Причина указана в комментарии.'};
const hintFor = (r) => (r.kind === APPEAL ? APPEAL_HINT : STATUS_HINT)[r.status] || '';
const TAG_TONE = {'Расписание': 'marigold', 'Деканат': 'periwinkle', 'Дедлайн': 'papaya', 'Мероприятие': 'mint', 'Преподаватель': 'sky', 'Оценка': 'mint', 'Задание': 'sky'};
const TYPE_TONE = {'Лекция': 't-lec', 'Семинар': 't-sem', 'Практика': 't-prac', 'Лабораторная работа': 't-lab'};
export const QUESTIONS = ['Какие пары сегодня?', 'Что завтра?', 'Какие задания на неделю?', 'Есть ли изменения в расписании?', 'Когда консультации?', 'Когда сессия?', 'Как заказать справку?'];

export const nowIso = () => mskNow().date;
const day = (iso) => S.data.schedule.find((d) => d.date === iso);
export const unreadCount = () => S.data.notices.filter((n) => !n.read).length;
export const readyCount = () => S.data.requests.filter((r) => r.status === 'Готова').length;
const building = (id) => S.data.campus.buildings.find((b) => b.id === id);
export const statusTag = (s) => `<span class="tag ${STATUS_TONE[s] || ''}">${esc(s)}</span>`;
export const empty = (ico, title, text = '') => `<div class="empty">${icon(ico)}<strong>${title}</strong>${text ? `<span>${text}</span>` : ''}</div>`;
export const markLast = (text) => { const i = text.lastIndexOf(' '); return i < 0 ? text : `${text.slice(0, i)} <span class="mark">${text.slice(i + 1)}</span>`; };
export const head = (eyebrow, title, lede = '', side = '') => `<header class="page-head"><div class="page-head-copy"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div>${side ? `<div class="page-head-side">${side}</div>` : ''}</header>`;
/* Портрет преподавателя: фото, если оно есть, иначе инициалы на спокойном фоне. */
export function face(t, cls = '') {
  if (!t) return '';
  if (t.photo) return `<img class="face ${cls}" src="${esc(t.photo)}" alt="" width="160" height="160" loading="lazy" decoding="async">`;
  const tone = [...(t.key || t.name)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 5;
  return `<span class="face mono f${tone} ${cls}" aria-hidden="true">${esc(t.initials || t.name[0])}</span>`;
}
export const secHead = (title, extra = '') => `<div class="sec-head"><h2>${title}</h2>${extra}</div>`;
const go = (href, text) => `<a class="link" href="#${href}">${text} ${icon('arrow')}</a>`;
export function item({href, data, ico, tone = '', title, sub = ''}) {
  const inner = `<span class="ico ${tone}">${icon(ico)}</span><span><strong>${title}</strong>${sub ? `<span class="sub">${sub}</span>` : ''}</span>${icon('chevron')}`;
  return href ? `<a class="item" href="#${href}">${inner}</a>` : `<button class="item" ${data}>${inner}</button>`;
}
const where = (l) => (l.format === 'Онлайн' ? 'Онлайн, ссылка в LMS' : `${esc(l.place)}${l.floor ? `, ${l.floor} этаж` : ''}`);
const isNow = (l, iso, t) => !l.cancelled && iso === t.date && toMin(l.start) <= t.minutes && t.minutes < toMin(l.end);
const gradeWord = (p) => (p >= 90 ? 'отлично' : p >= 75 ? 'хорошо' : p >= 60 ? 'удовлетворительно' : 'неудовлетворительно');

/* ---------- занятия ---------- */
export function lessonRow(l, iso) {
  const t = mskNow();
  const tags = [];
  if (isNow(l, iso, t)) tags.push('<span class="tag ink"><span class="live"></span>Идёт сейчас</span>');
  if (l.cancelled) tags.push('<span class="tag papaya">Отменено</span>');
  else if (l.change) tags.push(`<span class="tag marigold">${esc(l.change.label)}</span>`);
  if (l.subgroup) tags.push(`<span class="tag">${esc(l.subgroup)}</span>`);
  if (l.format === 'Онлайн') tags.push('<span class="tag sky">Онлайн</span>');
  if (l.parity) tags.push(`<span class="tag">${l.parity === 'odd' ? 'Нечётные недели' : 'Чётные недели'}</span>`);
  const hw = (S.data.homework || []).find((x) => x.lesson_id === l.id && x.status !== 'graded');
  if (hw) tags.push(`<span class="tag ${hw.status === 'done' ? 'mint' : 'sky'}">${icon('tasks')}${hw.status === 'done' ? 'Задание сделано' : 'Есть задание'}</span>`);
  let diff = '';
  if (l.cancelled) diff = `<span class="l-diff cancel">${esc(l.change.reason)}</span>`;
  else if (l.change) diff = `<span class="l-diff"><s>${esc(l.change.was)}</s> → <b>${esc(l.change.now)}</b></span>`;
  return `<button class="lesson ${TYPE_TONE[l.type] || ''} ${l.cancelled ? 'is-cancelled' : ''} ${isNow(l, iso, t) ? 'is-now' : ''}" data-lesson="${esc(l.id)}">
    <span class="l-time"><b>${l.start}</b><span>до ${l.end}</span><em>${l.pair} пара</em></span>
    <span class="l-main"><span class="l-title">${esc(l.title)}</span><span class="l-meta">${esc(l.type)} · ${esc(l.teacher.short)}</span><span class="l-place">${icon('pin')}${where(l)}</span>${tags.length ? `<span class="l-tags">${tags.join('')}</span>` : ''}${diff}</span>${icon('chevron')}</button>`;
}
export function lessonsList(lessons, iso) {
  const out = [];
  let prev = null;
  for (const l of lessons) {
    if (prev && !l.cancelled) {
      const gap = toMin(l.start) - toMin(prev.end);
      if (gap >= 50) out.push(`<div class="gap"><span>Окно ${duration(gap)} · <a href="#rooms">свободные аудитории</a></span></div>`);
    }
    out.push(lessonRow(l, iso));
    if (!l.cancelled) prev = l;
  }
  return `<div class="tline">${out.join('')}</div>`;
}
const nextLessonDay = (afterIso) => S.data.schedule.find((d) => d.date > afterIso && d.lessons.some((l) => !l.cancelled));

const bookRow = (l) => { const b = bookForCourse(l.title); return b ? `<a class="now-book" href="#library/${b.id}" data-lib-go="${b.i}"><span class="now-book-k">Учебник к паре</span><strong>${esc(b.title)}</strong><span class="now-book-s">${esc(b.author)} · ${esc(b.shelf)} · в наличии ${esc(b.copies)}</span></a>` : ''; };
function nowCard() {
  const t = mskNow(), d = day(t.date);
  const list = (d?.lessons || []).filter((l) => !l.cancelled);
  const cur = list.find((l) => isNow(l, t.date, t));
  const next = list.find((l) => toMin(l.start) > t.minutes);
  const who = (l) => `<span class="now-who">${face(l.teacher, 'sm')}<span><b>${esc(l.teacher.short)}</b><span>${esc(l.type)}</span></span></span>`;
  const hw = (l) => { const h = (S.data.homework || []).find((x) => x.lesson_id === l.id && x.status !== 'graded'); return h ? `<button class="now-hw" data-task="${esc(h.id)}">${icon('tasks')}<span>Задано: ${esc(h.title)}</span>${h.status === 'done' ? '<span class="tag mint">Сделано</span>' : ''}</button>` : ''; };
  const card = (label, extra, l, body = '') => `<section class="now sky" aria-label="${esc(label)}"><div class="now-top"><span class="pill">${label}</span><span class="now-extra">${extra}</span></div>
    <p class="now-time">${l.start}<span>–${l.end}</span></p><p class="now-title">${esc(l.title)}</p>
    <div class="now-meta"><span>${icon('pin')}${where(l)}</span><span>${icon('clock')}${l.pair} пара</span></div>${body}
    ${bookRow(l)}<div class="now-foot">${who(l)}${l.building && !l.cancelled && l.format!=='Онлайн'?`<button class="btn light sm" data-nav-lesson="${esc(l.id)}">Как пройти</button>`:''}<button class="btn light sm" data-lesson="${esc(l.id)}">Подробнее</button></div>${hw(l)}</section>`;
  if (cur) {
    const total = toMin(cur.end) - toMin(cur.start), left = toMin(cur.end) - t.minutes;
    return card('Идёт сейчас', `осталось ${duration(left)}`, cur, `<div class="bar light" data-pct="${Math.round((total - left) / total * 100)}"></div>${next ? `<p class="now-next">Далее в ${next.start}: ${esc(next.title)}, ${esc(next.place)}</p>` : ''}`);
  }
  if (next) return card('Следующая пара', `через ${duration(toMin(next.start) - t.minutes)}`, next);
  const upcoming = nextLessonDay(t.date), first = upcoming?.lessons.find((l) => !l.cancelled);
  if (!first) return `<section class="now sky"><div class="now-top"><span class="pill">Свободные дни</span></div><p class="now-title">В ближайшие дни занятий нет</p></section>`;
  return card(d?.lessons.length ? 'Занятия закончились' : 'Сегодня занятий нет', `ближайшая пара ${esc(relativeDay(upcoming.date, t.date))}`, first);
}

/* ---------- Задания ---------- */
const HW_LABEL = {todo: 'Нужно сдать', overdue: 'Просрочено', done: 'Сдано', graded: 'Проверено'};
export const activeHomework = () => (S.data.homework || []).filter((h) => h.status === 'todo' || h.status === 'overdue');
function dueWhen(h) {
  const d = daysBetween(nowIso(), h.due_date);
  const word = d === 0 ? 'сегодня' : d === 1 ? 'завтра' : d === -1 ? 'вчера' : `${weekdayShort(h.due_date)}, ${dayShort(h.due_date)}`;
  return `${word}, ${h.due_time}`;
}
function dueTone(h) {
  if (h.status === 'overdue') return 'bad';
  if (h.status !== 'todo') return '';
  return daysBetween(nowIso(), h.due_date) <= 1 ? 'warn' : '';
}
function dueLine(h) {
  if (h.status === 'graded') return `<span class="due">${icon('check')}Проверено · ${h.points} из ${h.points_max} баллов</span>`;
  if (h.status === 'overdue') return `<span class="due bad">${icon('alert')}Срок прошёл ${dueWhen(h)}</span>`;
  return `<span class="due ${dueTone(h)}">${icon('clock')}${h.lesson_id ? 'К занятию' : 'Срок'} ${dueWhen(h)}</span>`;
}
function hwBox(h) {
  if (h.status === 'graded') return `<span class="hw-score" title="Оценка преподавателя"><b>${h.points}</b><small>/${h.points_max}</small></span>`;
  const on = h.status === 'done';
  return `<button class="hw-check" data-hw="${esc(h.id)}" aria-pressed="${on}" aria-label="${on ? 'Снять отметку «Сдано»' : 'Отметить как сданное'}: ${esc(h.title)}">${icon('check')}</button>`;
}
export function hwRow(h, compact = false) {
  return `<article class="hw is-${h.status}">${hwBox(h)}<button class="hw-body" data-task="${esc(h.id)}">
    <span class="hw-top"><span class="hw-course">${esc(h.course_title)}</span><span class="hw-kind">${esc(h.kind)}</span></span>
    <strong>${esc(h.title)}</strong>${compact ? '' : `<span class="hw-text">${esc(h.text)}</span>`}${h.comment ? `<span class="hw-comment">${face(h.teacher, 'xs')}<span>${esc(h.comment)}</span></span>` : ''}
    <span class="hw-foot">${dueLine(h)}${compact ? '' : `<span class="hw-who">${face(h.teacher, 'xs')}${esc(h.teacher.short)}</span>`}</span></button></article>`;
}
function dueStrip() {
  const t = nowIso(), list = activeHomework();
  const cells = Array.from({length: 14}, (_, i) => {
    const iso = new Date(Date.parse(t + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10);
    const n = list.filter((h) => h.due_date === iso).length;
    return `<li class="${i === 0 ? 'today' : ''} ${n ? 'has' : ''}" title="${n ? `Сроков: ${n}` : 'Сроков нет'}"><small>${weekdayShort(iso)}</small><b>${fmt(iso, {day: 'numeric'})}</b><i>${'<s></s>'.repeat(Math.min(n, 3))}</i></li>`;
  }).join('');
  return `<ol class="due-strip" aria-label="Сроки на две недели">${cells}</ol>`;
}
export function viewTasks() {
  const all = S.data.homework || [], t = nowIso(), active = activeHomework();
  const done = all.filter((h) => h.status === 'done'), graded = all.filter((h) => h.status === 'graded');
  const f = S.hwFilter || 'active';
  const chip = (id, label, n) => `<button class="chip" data-hwf="${id}" aria-pressed="${f === id}">${label} · ${n}</button>`;
  // Три самых срочных задания — стопкой наверху; в списке ниже только остальные, без дублей.
  const byDue = [...active].sort((a, b) => `${a.due_date} ${a.due_time}`.localeCompare(`${b.due_date} ${b.due_time}`));
  const stackTasks = f === 'active' ? [...byDue.filter((h) => h.status === 'overdue').slice(0, 2), ...byDue.filter((h) => h.status === 'todo')].slice(0, 3) : [];
  const rest = active.filter((h) => !stackTasks.includes(h));
  let body;
  if (f === 'active') {
    const groups = [['Просрочено', (h) => h.status === 'overdue'], ['Сегодня и завтра', (h) => h.status === 'todo' && daysBetween(t, h.due_date) <= 1], ['На неделе', (h) => h.status === 'todo' && daysBetween(t, h.due_date) > 1 && daysBetween(t, h.due_date) <= 7], ['Позже', (h) => h.status === 'todo' && daysBetween(t, h.due_date) > 7]];
    body = rest.length ? `<div class="hw-groups">${groups.map(([name, test]) => { const g = rest.filter(test); return g.length ? `<section class="hw-group"><h2 class="hw-h">${name}<span>${g.length}</span></h2>${g.map((h) => hwRow(h)).join('')}</section>` : ''; }).join('')}</div>` : active.length ? '' : empty('check', 'Всё сделано', 'Активных заданий нет.');
  } else {
    const list = f === 'done' ? done : graded;
    body = list.length ? `<div class="hw-list">${list.map((h) => hwRow(h)).join('')}</div>` : empty('tasks', f === 'done' ? 'Пока ничего не отмечено' : 'Проверенных работ нет', f === 'done' ? 'Отметьте задание кружком слева, когда закончите.' : '');
  }
  const sum = graded.reduce((s, h) => s + h.points, 0), max = graded.reduce((s, h) => s + h.points_max, 0);
  const near = active.find((h) => h.status === 'todo');
  const stack = f === 'active' ? deadlineStack(stackTasks.map((h) => ({box: hwBox(h), id: h.id, course: h.course_title, title: h.title, kind: h.kind, when: dueWhen(h), days: daysBetween(t, h.due_date), overdue: h.status === 'overdue'}))) : '';
  return `<div class="page">${head(S.data.semester.term, 'Задания', 'Домашние задания и работы из LMS со сроками. Когда закончите, отметьте задание кружком: преподаватель увидит, что работа сдана. Оценки и комментарии приходят сюда же.')}
    <section class="stats" aria-label="Коротко">
      <div class="stat"><span class="num">${active.length}</span><span class="l">активных заданий</span></div>
      <div class="stat"><span class="num sm">${near ? esc(dueWhen(near).split(',')[0]) : '—'}</span><span class="l">${near ? `ближайший срок: ${esc(near.course_title)}` : 'ближайших сроков нет'}</span></div>
      <div class="stat"><span class="num">${done.length}</span><span class="l">сдано, ждут проверки</span></div>
      <div class="stat"><span class="num">${max ? Math.round(sum / max * 100) : 0}<small>%</small></span><span class="l">баллов за проверенные работы</span></div></section>
    ${stack}
    <div class="cols tasks-cols"><div class="stack"><div class="chips" role="group" aria-label="Фильтр заданий">${chip('active', 'Активные', active.length)}${chip('done', 'Сданные', done.length)}${chip('graded', 'Проверенные', graded.length)}</div>${body}</div>
      <div class="stack tasks-side"><section class="card"><div class="stack"><p class="title">Сроки на две недели</p>${dueStrip()}<p class="cap">Точка — срок задания в этот день.</p></div></section>
        <section class="card"><div class="stack"><p class="title">Как сдавать</p><div class="list">${[['schedule', 'К занятию', 'Сдаётся на паре: распечатка, тетрадь или устный ответ.'], ['download', 'Загрузка в LMS', 'Файл или ссылка на странице дисциплины до 23:59 дня срока.'], ['check', 'Тест онлайн', 'Проходится в LMS, баллы приходят автоматически.']].map(([ico, ttl, sub]) => `<div class="how"><span class="ico">${icon(ico)}</span><span><strong>${ttl}</strong><span>${sub}</span></span></div>`).join('')}</div></div></section></div></div></div>`;
}
export function taskSheet(id) {
  const h = (S.data.homework || []).find((x) => x.id === id);
  if (!h) return '';
  const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">${esc(h.course_title)} · ${esc(h.kind)}</p><h2 id="sheet-title" class="title">${esc(h.title)}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <div class="chips"><span class="tag ${h.status === 'overdue' ? 'papaya' : h.status === 'todo' ? 'marigold' : 'mint'}">${HW_LABEL[h.status]}</span>${dueLine(h)}</div>
    ${h.text ? `<p>${esc(h.text)}</p>` : ''}${h.comment ? `<div class="quote"><b>${esc(h.teacher.short)}:</b> ${esc(h.comment)}</div>` : ''}
    <dl class="facts">${row('Срок', `${esc(cap(dueWhen(h)))}${h.lesson_id ? ', к началу занятия' : ', загрузка в LMS'}`)}${row('Баллы', h.status === 'graded' ? `${h.points} из ${h.points_max}` : `до ${h.points_max}`)}
      ${row('Преподаватель', `<span class="who-line">${face(h.teacher, 'sm')}<span>${esc(h.teacher.name)}<br><span class="muted">${esc(h.teacher.title)} · <a href="mailto:${esc(h.teacher.email)}">${esc(h.teacher.email)}</a></span></span></span>`)}${row('Консультации', esc(h.teacher.hours))}</dl>
    ${h.status === 'todo' || h.status === 'overdue' ? `<form id="submit-form" class="stack" data-hwid="${esc(h.id)}"><label for="sf-note">Ссылка на работу или комментарий <span class="muted">(необязательно)</span></label><input id="sf-note" name="note" maxlength="500" placeholder="Например: ссылка на файл в LMS или «сдам на паре»"><p class="form-error" role="alert"></p><div class="chips"><button class="btn sm">${icon('check')}Отметить как сданное</button>${h.lesson_id ? `<button type="button" class="btn ghost sm" data-lesson="${esc(h.lesson_id)}">${icon('schedule')}Открыть занятие</button>` : ''}</div></form>` : ''}
    ${h.status === 'done' ? `<div class="done-box"><p><b>Сдано</b>${h.done_at ? ` ${esc(stamp(h.done_at))}` : ''}. Преподаватель видит отметку${h.note ? ' и ваш комментарий' : ''}.</p>${h.note ? `<p class="quote">${esc(h.note)}</p>` : ''}<div class="chips"><button class="btn ghost sm" data-hw="${esc(h.id)}" aria-pressed="true">Снять отметку «Сдано»</button>${h.lesson_id ? `<button class="btn ghost sm" data-lesson="${esc(h.lesson_id)}">${icon('schedule')}Открыть занятие</button>` : ''}</div></div>` : ''}</div></div>`;
}

/* ---------- Преподаватели: карусель ---------- */
export function teachersCarousel(title = 'Преподаватели') {
  const list = S.data.teachers || [];
  if (!list.length) return '';
  const next = (t) => {
    const today = nowIso();
    for (const dd of S.data.schedule) {
      if (dd.date < today) continue;
      const l = dd.lessons.find((x) => x.teacher.name === t.name && !x.cancelled);
      if (l) return `${cap(relativeDay(dd.date, today))}, ${l.start} · ${esc(l.title)}`;
    }
    return '';
  };
  return `<section class="sec">${secHead(title, `<div class="car-nav"><button class="icon-btn flip" data-scroll="-1" aria-label="Предыдущие преподаватели">${icon('arrow')}</button><button class="icon-btn" data-scroll="1" aria-label="Следующие преподаватели">${icon('arrow')}</button></div>`)}
    <div class="carousel" data-carousel tabindex="0" aria-label="${esc(title)}, прокрутка вбок">${list.map((t) => `<article class="tcard">${face(t, 'lg')}
      <div class="tcard-body"><h3>${esc(t.name)}</h3><p class="small muted">${esc(cap(t.title))}<br>${esc(t.dept)}</p>
      <div class="chips">${t.courses.map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</div>
      <dl class="tfacts"><div><dt>Консультации</dt><dd>${esc(t.hours)}</dd></div>${next(t) ? `<div><dt>Ближайшее занятие</dt><dd>${next(t)}</dd></div>` : ''}</dl></div>
      <div class="chips">${S.data.consults?.[t.key] ? `<button class="btn sm" data-consult="${esc(t.key)}">${icon('clock')}${myConsult(t.key) ? 'Ваша запись' : 'Консультация'}</button>` : ''}<a class="btn ghost sm" href="mailto:${esc(t.email)}">${icon('chat')}Написать</a></div></article>`).join('')}</div></section>`;
}

/* ---------- Консультации ---------- */
export function myConsult(key) {
  for (const d of S.data.consults?.[key] || []) { const s = d.slots.find((x) => x.state === 'mine'); if (s) return {...s, date: d.date, place: d.place}; }
  return null;
}
export function consultSheet(key) {
  const t = (S.data.teachers || []).find((x) => x.key === key), days = S.data.consults?.[key] || [];
  if (!t) return '';
  const mine = myConsult(key), pick = S.cslot && S.cslot.startsWith(key + '|') ? S.cslot.split('|') : null;
  const dayBlock = (d) => `<section class="cs-day"><p class="title">${esc(cap(dayLong(d.date)))}</p><p class="small muted">${esc(d.place || t.hours)} · по 15 минут</p>
    <div class="slots">${d.slots.map((s) => s.state === 'free' ? `<button class="slot ${pick && pick[1] === d.date && pick[2] === s.time ? 'on' : ''}" data-slot="${esc(key)}|${esc(d.date)}|${esc(s.time)}" aria-pressed="${!!(pick && pick[1] === d.date && pick[2] === s.time)}">${s.time}</button>`
      : `<span class="slot ${s.state}">${s.time}<small>${s.state === 'mine' ? 'вы' : 'занято'}</small></span>`).join('')}</div></section>`;
  return `<div class="sheet-in"><div class="sheet-top"><div class="who-line">${face(t, 'sm')}<div><p class="eyebrow">Запись на консультацию</p><h2 id="sheet-title" class="title">${esc(t.name)}</h2></div></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    ${mine ? `<div class="done-box"><p><b>Вы записаны:</b> ${esc(dayLong(mine.date))}, ${mine.time}, ${esc(mine.place)}.</p><p class="quote">${esc(mine.topic)}</p><div class="chips"><button class="btn ghost sm" data-ccancel="${esc(key)}|${esc(mine.date)}|${esc(mine.time)}">Отменить запись</button></div></div>` : ''}
    ${days.length ? days.map(dayBlock).join('') : '<p class="muted">Ближайших консультаций нет.</p>'}
    ${pick ? `<form id="consult-form" class="stack" data-ckey="${esc(key)}" data-cdate="${esc(pick[1])}" data-ctime="${esc(pick[2])}"><label for="cf-topic">С каким вопросом придёте</label><input id="cf-topic" name="topic" required maxlength="200" placeholder="Например: разобрать задачу 7 из типового расчёта"><p class="form-error" role="alert"></p><button class="btn block">${mine ? 'Перенести запись' : 'Записаться'} на ${esc(dayShort(pick[1]))}, ${esc(pick[2])}</button></form>` : `<p class="cap">${mine ? 'Чтобы перенести запись, выберите другое время.' : 'Выберите свободное время. Преподаватель увидит вашу запись и вопрос.'}</p>`}</div>`;
}

/* ---------- Сегодня ---------- */
function gradeStats() {
  const g = S.data.grades;
  return {avg: g.length ? Math.round(g.reduce((s, x) => s + x.points, 0) / g.length) : 0, admitted: g.filter((x) => x.result !== 'Нет допуска').length, total: g.length, risk: g.filter((x) => x.result === 'Нет допуска')};
}
export const clockText = () => { const m = mskNow().minutes; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export function viewToday() {
  const t = nowIso(), d = S.data, s = d.semester, st = gradeStats();
  const today = day(t), todayLessons = today?.lessons || [];
  const notes = [];
  for (const dd of d.schedule) {
    if (dd.date < t) continue;
    for (const l of dd.lessons) {
      if (!l.change) continue;
      const when = `${cap(relativeDay(dd.date, t))}, ${l.pair} пара`;
      notes.push(`<button class="change ${l.cancelled ? 'is-cancel' : ''}" data-lesson="${esc(l.id)}"><span class="change-kind">${esc(l.change.label)}</span><span class="change-body"><strong>${esc(l.title)}</strong><span class="change-diff">${when} · ${l.cancelled ? esc(l.change.reason) : `<s>${esc(l.change.was)}</s> <span aria-hidden="true">→</span> <b>${esc(l.change.now)}</b>`}</span></span>${icon('chevron')}</button>`);
    }
  }
  for (const n of d.notices.filter((x) => !x.read && ['Деканат', 'Мероприятие', 'Преподаватель', 'Оценка', 'Задание'].includes(x.tag)).slice(0, 4)) {
    notes.push(`<a class="change" href="#notices"><span class="change-kind">${esc(n.tag)}</span><span class="change-body"><strong>${esc(n.title)}</strong><span class="change-diff">${esc(n.body)}</span></span>${icon('chevron')}</a>`);
  }
  const ready = d.requests.filter((x) => x.status === 'Готова').map((r) => item({href: r.document ? `doc/${r.id}` : 'requests', ico: 'requests', tone: 'mint', title: `Документ готов: ${esc(r.kind.toLowerCase())}`, sub: 'Электронная версия в кабинете, оригинал в ауд. А-112.'}));
  const consults = (d.teachers || []).map((x) => ({x, c: myConsult(x.key)})).filter((y) => y.c).map(({x, c}) => item({data: `data-consult="${esc(x.key)}"`, ico: 'clock', tone: 'sky', title: `Консультация: ${esc(x.short)}`, sub: `${esc(cap(relativeDay(c.date, t)))}, ${c.time}, ${esc(c.place)} · ${esc(c.topic)}`}));
  ready.push(...consults);
  const risk = st.risk.map((g) => item({href: 'study', ico: 'alert', tone: 'papaya', title: `Нет допуска: ${esc(g.title)}`, sub: `До порога не хватает ${60 - g.points} ${60 - g.points === 1 ? 'балла' : 'баллов'}.`}));
  const active = activeHomework(), week = active.filter((h) => daysBetween(t, h.due_date) <= 7);
  const toSession = Math.max(0, daysBetween(t, s.session_starts));
  const pairsToday = todayLessons.filter((l) => !l.cancelled).length;
  const nextEntry = nextPhysicalLesson(S.data);
  // Свободные аудитории считаются по реальной ближайшей паре и дате данных, а не по фильтрам страницы «Корпуса».
  const freePair = defaultPair(), freeDate = S.data.campus.rooms_date;
  const freeText = `${roomsIsToday() ? '' : `${cap(relativeDay(freeDate, t))}, `}на ${freePair} паре в корпусе А свободно: ${freeRooms(freePair, 'А', freeDate).length}`;
  return `<div class="page hm-page">
    <header class="today-head"><div><p class="eyebrow">${cap(dayLong(t))} · ${s.week}-я неделя, ${s.parity_label} · <span data-clock>${clockText()}</span></p><h1>Сегодня</h1></div>
      <div class="chips"><button class="btn ghost sm" data-calendar="week">${icon('download')}Неделя в календарь</button><button class="btn sm" data-request-kind="Справка об обучении">${icon('requests')}Заказать справку</button></div></header>
    <div class="hm-hero">
      ${nowCard()}
      ${routeMapCard(nextEntry ? {id: nextEntry.lesson.id, title: nextEntry.lesson.title, where: where(nextEntry.lesson), when: `${cap(relativeDay(nextEntry.date, t))}, ${nextEntry.lesson.start}`, building: nextEntry.lesson.building, floor: nextEntry.lesson.floor} : null)}
    </div>
    <div class="hm-wide">
      <section class="card day-card"><div class="row"><p class="title">Расписание на сегодня</p><a class="link" href="#schedule">Неделя ${icon('arrow')}</a></div>
        ${dayTimeline(today, t)}${todayLessons.length ? `<div class="mini-lessons">${todayLessons.map((l) => `<button class="mini-l ${l.cancelled ? 'is-cancelled' : ''} ${isNow(l, t, mskNow()) ? 'is-now' : ''}" data-lesson="${esc(l.id)}"><b>${l.start}</b><span><strong>${esc(l.title)}</strong><span>${l.cancelled ? 'Отменено' : `${esc(l.type)} · ${where(l)}`}</span></span>${face(l.teacher, 'xs')}</button>`).join('')}</div>` : `<p class="muted small">Сегодня пар нет.</p>`}</section>
    </div>
    <section class="stats" aria-label="Коротко">
      <a class="stat" href="#schedule"><span class="num" data-count="${pairsToday}">${pairsToday}</span><span class="l">${plural(pairsToday, ['пара', 'пары', 'пар'])} сегодня</span></a>
      <a class="stat" href="#tasks"><span class="num" data-count="${week.length}">${week.length}</span><span class="l">${plural(week.length, ['задание', 'задания', 'заданий'])} на 7 дней</span></a>
      <a class="stat" href="#study"><span class="num" data-count="${st.avg}">${st.avg}</span><span class="l">средний балл из 100</span></a>
      <a class="stat" href="#study"><span class="num" data-count="${toSession}">${toSession}</span><span class="l">${plural(toSession, ['день', 'дня', 'дней'])} до сессии</span></a></section>
    ${quickActions({books: BOOKS_COUNT, freeText, unread: unreadCount(), ready: d.requests.filter((x) => x.status === 'Готова').length})}
    ${libraryShelf()}
    <div class="cols"><section class="sec">${secHead('Задания', go('tasks', 'Все задания'))}${ready.length || risk.length ? `<div class="card flush"><div class="list pad">${ready.join('')}${risk.join('')}</div></div>` : ''}${active.length ? `<div class="hw-list">${active.slice(0, 4).map((h) => hwRow(h, true)).join('')}</div>` : empty('check', 'Всё сделано', 'Активных заданий нет.')}</section>
      <section class="sec">${secHead('Что изменилось', go('notices', 'Уведомления'))}${notes.length ? `<div class="card flush"><div class="changes">${notes.join('')}</div></div>` : empty('check', 'Изменений нет', 'Занятия проходят по расписанию.')}</section></div>
    <div class="hm-duo">${idTeaser(d.profile)}${gradeMini(d.grades)}</div>
    ${newsStrip()}
    ${teachersCarousel('Ваши преподаватели')}</div>`;
}

/* ---------- Новости университета ---------- */
export const NEWS_CATS = [['all', 'Все'], ['uni', 'Университет'], ['edu', 'Образование'], ['abit', 'Абитуриентам'], ['proj', 'Проекты']];
const newsDate = (iso) => relativeDay(iso, nowIso()).replace(/^в /, '');
const newsMeta = (n) => `<span class="news-meta"><span class="news-cat c-${n.cat}">${esc(n.cat_label)}</span><span>${esc(cap(newsDate(n.date)))} · ${n.minutes} мин чтения</span></span>`;
function newsCard(n, lead = false) {
  return `<button class="news ${lead ? 'lead sky' : ''}" data-news="${esc(n.id)}"><span class="news-cover c-${n.cat}" aria-hidden="true"><b>${esc((n.cat_label || '')[0] || '')}</b><i>${n.minutes} мин</i></span>${newsMeta(n)}<strong>${esc(n.title)}</strong><span class="sub">${esc(n.lead)}</span><span class="news-more">Читать ${icon('arrow')}</span></button>`;
}
function newsStrip() {
  const list = S.data.news || [];
  if (!list.length) return '';
  return `<section class="sec">${secHead('Новости и статьи университета', go('news', 'Все новости'))}<div class="news-grid">${newsCard(list[0], true)}${list.slice(1, 4).map((n) => newsCard(n)).join('')}</div></section>`;
}
export function viewNews() {
  const list = (S.data.news || []).filter((n) => S.newsCat === 'all' || n.cat === S.newsCat);
  const counts = Object.fromEntries(NEWS_CATS.map(([id]) => [id, (S.data.news || []).filter((n) => id === 'all' || n.cat === id).length]));
  return `<div class="page">${head('Университет', 'Новости', 'Университет, образование, абитуриентам и студенческие проекты. Все новости концепта вымышлены.')}
    <div class="chips" role="group" aria-label="Рубрики">${NEWS_CATS.map(([id, label]) => `<button class="chip" data-ncat="${id}" aria-pressed="${S.newsCat === id}">${label} · ${counts[id]}</button>`).join('')}</div>
    ${list.length ? `<div class="news-grid feed">${newsCard(list[0], true)}${list.slice(1).map((n) => newsCard(n)).join('')}</div>` : empty('news', 'Новостей нет', 'В этой рубрике пока пусто.')}</div>`;
}
export function newsSheet(id) {
  const n = (S.data.news || []).find((x) => x.id === id);
  if (!n) return '';
  return `<div class="sheet-in"><div class="sheet-top"><div>${newsMeta(n)}<h2 id="sheet-title" class="title news-h">${esc(n.title)}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <p class="lede">${esc(n.lead)}</p>${n.body.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="cap">Новость концепт-прототипа, событие вымышлено.</p></div>`;
}

/* ---------- Расписание ---------- */
export function viewSchedule() {
  const t = nowIso();
  const week = S.data.schedule.slice(S.week * 7, S.week * 7 + 7);
  if (!week.some((x) => x.date === S.day)) S.day = (week.find((x) => x.date === t) || week[0]).date;
  const current = week.find((x) => x.date === S.day);
  const range = (w) => `${fmt(w[0].date, {day: 'numeric'})}–${dayShort(w[6].date)}, неделя ${w[0].week}`;
  const w0 = S.data.schedule.slice(0, 7), w1 = S.data.schedule.slice(7, 14);
  const lessons = current.lessons, active = lessons.filter((l) => !l.cancelled);
  const summary = active.length ? `${count(active.length, ['занятие', 'занятия', 'занятий'])}, ${active[0].start}–${active[active.length - 1].end}` : 'занятий нет';
  const upcoming = !active.length ? nextLessonDay(current.date) : null, nextFirst = upcoming?.lessons.find((l) => !l.cancelled);
  const curPair = current.date === t ? defaultPair() : 0;
  return `<div class="page">${head(S.data.semester.term, 'Расписание', 'Нажмите на занятие, чтобы увидеть преподавателя, этаж, задание к паре и как пройти. Время московское.')}
    <div class="seg wk-seg only-desk" role="group" aria-label="Неделя"><button data-week="0" aria-pressed="${S.week === 0}">Эта неделя<small>${range(w0)}</small></button><button data-week="1" aria-pressed="${S.week === 1}">Следующая<small>${range(w1)}</small></button></div>
    <section class="card wk-card only-desk">${weekGrid(week, t, S.day)}</section>
    <div class="cols"><div class="stack lg only-mob">
      <div class="stack"><div class="seg" role="group" aria-label="Неделя"><button data-week="0" aria-pressed="${S.week === 0}">Эта неделя<small>${range(w0)}</small></button><button data-week="1" aria-pressed="${S.week === 1}">Следующая<small>${range(w1)}</small></button></div>
      <div class="days" role="group" aria-label="Дни недели">${week.map((x) => {
        const n = x.lessons.filter((l) => !l.cancelled).length, chg = x.lessons.some((l) => l.change);
        return `<button class="day ${x.date === t ? 'today' : ''}" data-day="${x.date}" aria-pressed="${x.date === S.day}" aria-label="${esc(dayLong(x.date))}, ${count(n, ['занятие', 'занятия', 'занятий'])}${chg ? ', есть изменения' : ''}"><small>${weekdayShort(x.date)}</small><strong>${fmt(x.date, {day: 'numeric'})}</strong><i>${'<b></b>'.repeat(Math.min(n, 4))}</i>${chg ? '<span class="chg"></span>' : ''}</button>`;
      }).join('')}</div></div>
      <section class="sec"><div class="sec-head"><h2>${cap(dayLong(current.date))}</h2><span class="small muted">неделя ${current.week}, ${current.parity === 'odd' ? 'нечётная' : 'чётная'} · ${summary}</span></div>
        ${lessons.length ? lessonsList(lessons, current.date) : empty('schedule', 'Занятий нет', nextFirst ? `Ближайшее занятие: ${esc(relativeDay(upcoming.date, t))}, ${nextFirst.start} — ${esc(nextFirst.title)}.` : '')}</section></div>
      <div class="stack lg side-row">
        <section class="card"><div class="stack"><p class="title">В календарь</p><p class="small">Файл .ics открывается в Яндекс Календаре, Google Календаре и в календаре телефона.</p>
          <button class="btn ghost block" data-calendar="day">${icon('download')}Выбранный день</button><button class="btn block" data-calendar="week">${icon('download')}Неделя целиком</button></div></section>
        <section class="card"><div class="stack"><p class="title">Звонки</p><table class="bells"><tbody>${S.data.campus.bells.map((b) => `<tr class="${b.pair === curPair ? 'cur' : ''}"><th scope="row">${b.pair} пара</th><td>${b.start}–${b.end}${b.pair === curPair ? ' · сейчас' : ''}</td></tr>`).join('')}</tbody></table><p class="cap">Между 2 и 3 парой обеденный перерыв 30 минут.</p></div></section>
        <section class="card"><div class="legend"><p class="eyebrow">Цвет отметки — вид занятия</p><span><i class="sw sw-lec"></i>лекция</span><span><i class="sw sw-sem"></i>семинар</span><span><i class="sw sw-prac"></i>практика</span><span><i class="sw sw-lab"></i>лабораторная работа</span></div></section>
      </div></div></div>`;
}

export function lessonSheet(id) {
  const found = lessonIndex.get(id);
  if (!found) return '';
  const {lesson: l, day: d} = found;
  const r = l.building ? roomByKey(`${l.building}-${l.room}`) : null, b = l.building ? building(l.building) : null;
  const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
  const tags = [l.cancelled ? '<span class="tag papaya">Отменено</span>' : '', l.change && !l.cancelled ? `<span class="tag marigold">${esc(l.change.label)}</span>` : '', `<span class="tag">${esc(l.type)}</span>`, l.subgroup ? `<span class="tag">${esc(l.subgroup)}</span>` : '', l.format === 'Онлайн' ? '<span class="tag sky">Онлайн</span>' : ''].join('');
  const change = l.change ? `<div class="l-diff ${l.cancelled ? 'cancel' : ''}"><b>${esc(l.change.label)}.</b> ${l.cancelled ? '' : `Было: ${esc(l.change.was)}. Стало: ${esc(l.change.now)}. `}${esc(l.change.reason)}. Опубликовано ${esc(stamp(l.change.at))}.</div>` : '';
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">${esc(cap(dayLong(d.date)))} · ${l.start}–${l.end}</p><h2 id="sheet-title" class="title">${esc(l.title)}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <div class="chips">${tags}</div>${change}${(() => { const h = (S.data.homework || []).find((x) => x.lesson_id === l.id); return h ? `<div class="sheet-hw"><p class="eyebrow">Задание к этому занятию</p>${hwRow(h, true)}</div>` : ''; })()}
    <dl class="facts">
      ${row('Время', `${l.start}–${l.end}, ${l.pair} пара`)}
      ${row('Место', l.format === 'Онлайн' ? 'Онлайн. Ссылка для подключения размещена в LMS на странице дисциплины.' : `${esc(l.place)}${l.floor ? `, ${l.floor} этаж` : ''}${r ? `<br><span class="muted">${esc(r.kind)}. ${esc(r.hint)}.</span>` : ''}`)}
      ${row('Корпус', b ? `${esc(b.name)}, открыт ${esc(b.hours)}<br><span class="muted">${esc(b.hint)}</span>` : '')}
      ${row('Преподаватель', `<span class="who-line">${face(l.teacher, 'sm')}<span>${esc(l.teacher.name)}<br><span class="muted">${esc(l.teacher.title)}</span></span></span>`)}${row('Кафедра', esc(l.teacher.dept))}${row('Консультации', esc(l.teacher.hours))}
      ${row('Неделя', `${d.week}-я, ${d.parity === 'odd' ? 'нечётная' : 'чётная'}${l.parity ? `. Занятие проходит только по ${l.parity === 'odd' ? 'нечётным' : 'чётным'} неделям` : ''}`)}
    </dl><div class="chips">${l.cancelled ? '' : `<button class="btn sm" data-ics-lesson="${esc(l.id)}">${icon('download')}В календарь</button>`}${r && !l.cancelled && l.format !== 'Онлайн' ? `<button class="btn ghost sm" data-nav-lesson="${esc(l.id)}">${icon('building')}Как пройти на пару</button>` : ''}${S.data.consults?.[l.teacher.key] ? `<button class="btn ghost sm" data-consult="${esc(l.teacher.key)}">${icon('clock')}Консультация</button>` : ''}</div></div>`;
}

/* ---------- Учёба ---------- */
export function viewStudy() {
  const t = nowIso(), d = S.data, s = d.semester, st = gradeStats();
  const next = d.grades.filter((g) => g.date >= t)[0];
  const toSession = daysBetween(t, s.session_starts);
  const risk = st.risk.map((g) => `<section class="card alert"><div class="stack"><span><span class="tag papaya">Требует внимания</span></span><p class="title">Нет допуска: ${esc(g.title)}</p><p>До порога допуска не хватает ${60 - g.points} ${60 - g.points === 1 ? 'балла' : 'баллов'}. Контроль ${dayMonth(g.date)}. Преподаватель: ${esc(g.teacher.name)}, консультации: ${esc(g.teacher.hours)}.</p></div></section>`).join('');
  const advice = (g) => {
    if (g.points < 60) return `До допуска не хватает ${60 - g.points}.`;
    if (g.assessment === 'Зачёт') return g.points >= 85 ? 'Зачёт выставляется автоматом.' : `До зачёта автоматом (85) ещё ${85 - g.points}.`;
    const w = gradeWord(g.points);
    const nextStep = g.points >= 90 ? '' : g.points >= 75 ? ` До «отлично» ещё ${90 - g.points}.` : ` До «хорошо» ещё ${75 - g.points}.`;
    return `По шкале сейчас «${w}».${nextStep}`;
  };
  return `<div class="page">${head(s.term, 'Учёба', 'Баллы текущего контроля, допуск, преподаватели и график сессии.')}
    <a class="lib-study-link" href="#library">Библиотека курса →</a>
    <section class="stats" aria-label="Показатели">
      <div class="stat"><span class="num">${st.avg}</span><span class="l">средний балл из 100</span></div>
      <div class="stat"><span class="num">${st.admitted}<small>/${st.total}</small></span><span class="l">дисциплин с допуском</span></div>
      <div class="stat"><span class="num">${next ? daysBetween(t, next.date) : '—'}</span><span class="l">дней до ближайшего контроля</span></div>
      <div class="stat"><span class="num">${toSession > 0 ? toSession : 0}</span><span class="l">дней до начала сессии</span></div></section>
    ${risk}
    <section class="sec">${secHead('Семестр')}<div class="strip" role="img" aria-label="Идёт ${s.week}-я неделя из ${s.weeks}, сессия с ${dayMonth(s.session_starts)}">${Array.from({length: s.weeks}, (_, i) => `<div class="${i + 1 < s.week ? 'done' : i + 1 === s.week ? 'cur' : ''}"><b>${i + 1}</b>${i + 1 === s.week ? 'сейчас' : 'нед.'}</div>`).join('')}<div class="session"><b>Сессия</b>с ${dayMonth(s.session_starts)}</div></div></section>
    ${gradeBarsSection()}
    <section class="sec">${secHead('Баллы по дисциплинам')}<div class="courses">${d.grades.map((g) => `<article class="card course"><div class="course-head"><div class="ring-wrap sm">${ring(g.points, {size: 76, stroke: 9, tone: g.points < 60 ? 'papaya' : 'ink', label: `${g.points} баллов из 100`})}<span class="ring-num"><span data-count="${g.points}">${g.points}</span></span></div>
      <div class="course-info"><h3>${esc(g.title)}</h3><span class="small muted">${esc(g.teacher.short)} · ${esc(g.assessment)}</span><span><span class="tag ${g.result === 'Нет допуска' ? 'papaya' : 'mint'}">${esc(g.result)}</span></span></div></div>
      <div class="spark-wrap">${sparkline(g.trend, {label: `Баллы по неделям: ${g.trend.join(', ')}`})}<div class="spark-axis"><span>1 нед.</span><span>порог 60</span><span>${g.trend.length} нед.</span></div></div>
      <p class="small muted">${advice(g)}</p>${attLine(g.course)}${courseBook(g.title)}</article>`).join('')}</div>
      <p class="cap">Кольцо — баллы из 100. График — накопление баллов по неделям, пунктир — порог допуска 60. Шкала перевода условная, данные демонстрационные.</p></section>
    ${teachersCarousel('Преподаватели семестра')}
    <section class="sec">${secHead('График сессии')}<div class="card">${d.grades.map((g) => `<div class="tl ${g.assessment === 'Экзамен' ? 'exam' : ''} ${g.date < t ? 'past' : ''}"><div class="tl-date"><b>${fmt(g.date, {day: 'numeric'})}</b><span>${fmt(g.date, {month: 'short'}).replace('.', '')}</span></div>
      <div><div class="row"><h3>${esc(g.title)}</h3><span class="tag ${g.assessment === 'Экзамен' ? 'marigold' : 'periwinkle'}">${esc(g.assessment)}</span></div><p>${g.start} · ${esc(g.place)} · ${esc(g.examiner)} · ${untilText(g.date, t)}${g.consultation ? `<br>Консультация: ${dayShort(g.consultation.date)}, ${g.consultation.start}, ${esc(g.consultation.place)}` : ''}</p></div></div>`).join('')}</div></section></div>`;
}

function courseBook(title) {
  const b = bookForCourse(title);
  return b ? `<a class="course-book" href="#library/${b.id}" data-lib-go="${b.i}">${icon('book')}<span><b>${esc(b.title)}</b><small>${esc(b.author)} · ${esc(b.shelf)}</small></span>${icon('arrow')}</a>` : '';
}
function attLine(course) {
  const a = S.data.attendance?.[course];
  if (!a || a.att === null) return '';
  return `<p class="att-line ${a.att < 75 ? 'low' : ''}"><span>Посещаемость</span><b>${a.att}%</b><span>${a.absent ? `${a.absent} ${plural(a.absent, ['пропуск', 'пропуска', 'пропусков'])}` : 'без пропусков'}${a.late ? ` · ${a.late} ${plural(a.late, ['опоздание', 'опоздания', 'опозданий'])}` : ''}</span></p>`;
}

/* ---------- Заявки ---------- */
export function viewRequests() {
  const rows = S.data.requests, dean = roomByKey('А-112');
  return `<div class="page">${head('Деканат онлайн', 'Заявки и справки', 'Закажите документ или направьте обращение. Статус, комментарии деканата и электронная версия документа — в истории заявки.')}
    <section class="sec" aria-label="Каталог документов"><div class="catalog">${DOCS.map((x) => `<article class="card doc"><span class="ico ${x.tone}">${icon(x.ico)}</span><p class="title">${x.kind}</p><p class="small">${x.what}</p>
      <div class="chips"><span class="tag">${icon('clock')}${x.sla}</span></div><p class="cap">${x.how}</p><button class="btn sm" data-request-kind="${x.kind}">Оформить</button></article>`).join('')}</div></section>
    <section class="sec">${secHead('История заявок')}${rows.length ? `<div class="history">${rows.map((r) => {
      const last = r.events[r.events.length - 1], idx = STEPS.indexOf(r.status);
      return `<article class="card req"><div class="row"><div><h3>${esc(r.kind)}</h3><span class="cap">№ ${esc(r.id.slice(0, 6).toUpperCase())} · от ${dayShort(r.created)}</span></div>${statusTag(r.status)}</div>
        ${r.status === 'Отклонена' ? '' : `<ol class="track" aria-label="Этапы заявки">${STEPS.map((x, i) => `<li class="${i < idx ? 'done' : i === idx ? 'cur' : ''}">${r.kind === APPEAL ? APPEAL_STEP[x] : x}</li>`).join('')}</ol>`}
        <p class="small">${esc(hintFor(r))}</p>
        ${r.note ? `<p class="small muted">Ваш комментарий: ${esc(r.note)}</p>` : ''}
        ${last && last.comment ? `<div class="quote"><b>${esc(last.author)}:</b> ${esc(last.comment)}</div>` : ''}
        ${r.document ? `<div class="chips"><a class="btn sm" href="#doc/${esc(r.id)}">${icon('requests')}Открыть электронный документ</a></div>` : ''}
        <details class="hist"><summary>История изменений · ${r.events.length}</summary><ol>${r.events.map((e) => `<li><strong>${esc(e.status)}</strong><p>${esc(stamp(e.at))} · ${esc(e.author)}</p>${e.comment ? `<p>${esc(e.comment)}</p>` : ''}</li>`).join('')}</ol></details></article>`;
    }).join('')}</div>` : empty('requests', 'Заявок пока нет', 'После отправки заявка появится здесь вместе со статусом.')}</section>
    <section class="sec">${secHead('Частые вопросы')}<div class="faqs"><details class="faq"><summary>Сколько готовится справка об обучении?</summary><p>Обычно 1–2 рабочих дня. Статус меняется в истории заявки, а когда документ готов, появляется его электронная версия.</p></details><details class="faq"><summary>Как проверить подлинность электронной справки?</summary><p>На документе есть QR-код и ссылка. Страница проверки открывается без входа в кабинет и показывает, действителен ли документ.</p></details><details class="faq"><summary>Где получить оригинал с печатью?</summary><p>В деканате: Корпус А, ауд. 112, 1 этаж. Приём по будням с 10:00 до 17:00, перерыв с 13:00 до 14:00. Возьмите студенческий билет.</p></details><details class="faq"><summary>Что делать, если заявку отклонили?</summary><p>Причина указана в комментарии деканата в истории заявки. Исправьте замечание и подайте заявку заново или направьте обращение.</p></details><details class="faq"><summary>Можно ли задать вопрос без справки?</summary><p>Да. Выберите «Обращение в деканат» и опишите вопрос. Ответ придёт в историю заявки, срок до 5 рабочих дней.</p></details></div></section>
    ${dean ? `<section class="card"><div class="stack"><p class="eyebrow">Где находится деканат</p><p class="title">Корпус А, ауд. ${esc(dean.room)}, ${dean.floor} этаж</p><p>${esc(dean.hint)}.</p><div class="chips"><button class="btn ghost sm" data-goto-room="${esc(dean.key)}">${icon('building')}Показать на схеме</button></div></div></section>` : ''}</div>`;
}
export function requestSheet(kind) {
  const doc = DOCS.find((x) => x.kind === kind) || DOCS[0];
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">Новая заявка</p><h2 id="sheet-title" class="title">${doc.kind}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <p class="small">${doc.what} Срок: ${doc.sla}. ${doc.how}.</p>
    <form id="request-form"><label for="kind">Тип заявки</label><select id="kind" name="kind">${DOCS.map((x) => `<option ${x.kind === doc.kind ? 'selected' : ''}>${x.kind}</option>`).join('')}</select>
    <label for="note">Комментарий <span class="muted">(необязательно)</span></label><textarea id="note" name="note" maxlength="1000" placeholder="Например: для оформления визы, нужен оригинал"></textarea>
    <p class="form-error" role="alert"></p><button class="btn block">Отправить заявку</button></form></div>`;
}
export function viewDoc(id) {
  const r = S.data.requests.find((x) => x.id === id), p = S.data.profile;
  if (!r || !r.document) return `<div class="page">${head('Документ', 'Документ не найден')}${empty('requests', 'Электронной версии нет', 'Она появится, когда деканат подготовит документ.')}<a class="btn ghost" href="#requests">К заявкам</a></div>`;
  const url = verifyUrl(r.document.code);
  const body = r.kind === 'Выписка об успеваемости'
    ? `<p>Настоящая выписка подтверждает результаты текущего контроля: ${esc(p.name)}, ${p.year} курс, группа ${esc(p.group_name)}, ${esc(S.data.semester.term.toLowerCase())}.</p><table class="bells"><tbody>${S.data.grades.map((g) => `<tr><td>${esc(g.title)}</td><td>${esc(g.assessment)}</td><td>${g.points} / 100</td></tr>`).join('')}</tbody></table>`
    : `<p>Настоящая справка подтверждает, что <b>${esc(p.name)}</b> обучается на ${p.year} курсе, группа ${esc(p.group_name)}. ${esc(p.faculty)}, направление «${esc(p.program)}». Уровень образования: ${esc((p.level || '').toLowerCase())}. Форма обучения: ${esc((p.form || '').toLowerCase())}.</p><p>Справка выдана для предъявления по месту требования.</p>`;
  return `<div class="page"><div class="row no-print"><a class="link" href="#requests">${icon('arrow')} К заявкам</a><div class="chips"><button class="btn sm" data-print>${icon('download')}Печать или PDF</button><button class="btn ghost sm" data-copy="${esc(url)}">Скопировать ссылку проверки</button></div></div>
    <article class="paper-doc"><p class="doc-note">Демонстрационный документ. Не имеет юридической силы.</p>
      <div class="center"><p class="eyebrow">Кампус · концепт</p><h2>${esc(r.kind)}</h2><p class="cap">№ ${esc(r.id.slice(0, 6).toUpperCase())} · выдана ${dayMonth(r.document.issued)} ${r.document.issued.slice(0, 4)} г.</p></div>
      <div class="body stack">${body}</div>
      <div class="doc-foot"><div class="stack"><p class="eyebrow">Проверка подлинности</p><p class="small">Наведите камеру на QR-код или откройте ссылку. Страница проверки покажет статус документа без входа в кабинет.</p><p class="small"><a href="${esc(url)}">${esc(url)}</a></p><p class="cap">Код: ${esc(r.document.code)}</p></div>${qrSvg(url)}</div></article></div>`;
}

export function viewNotices() {
  const list = S.noticeFilter === 'unread' ? S.data.notices.filter((n) => !n.read) : S.data.notices, u = unreadCount();
  return `<div class="page">${head('Уведомления', 'Объявления и изменения', 'Объявления деканата, изменения расписания и сроки в одной ленте.')}
    <div class="chips"><button class="chip" data-nfilter="all" aria-pressed="${S.noticeFilter === 'all'}">Все · ${S.data.notices.length}</button><button class="chip" data-nfilter="unread" aria-pressed="${S.noticeFilter === 'unread'}">Непрочитанные · ${u}</button>${u ? `<button class="link" data-read-all>Отметить все прочитанными</button>` : ''}</div>
    <section class="card">${list.length ? `<div class="list">${list.map((n) => `<article class="item"><span class="ico ${TAG_TONE[n.tag] || ''}">${icon({'Расписание': 'swap', 'Дедлайн': 'clock', 'Оценка': 'check', 'Задание': 'tasks'}[n.tag] || 'megaphone')}</span>
      <span><span class="chips"><span class="tag ${TAG_TONE[n.tag] || ''}">${esc(n.tag)}</span>${n.read ? '' : '<span class="dot" role="img" aria-label="Не прочитано"></span>'}<span class="cap">${dayShort(n.date)}</span></span><strong>${esc(n.title)}</strong><span class="sub">${esc(n.body)}</span>${n.read ? '' : `<button class="link" data-read="${esc(n.id)}">Отметить прочитанным</button>`}</span><span></span></article>`).join('')}</div>` : empty('bell', 'Нет уведомлений', 'Непрочитанных сообщений нет.')}</section></div>`;
}

/* ---------- Корпуса и аудитории ---------- */
function myRoomsAt(pair) {
  const t = mapDate();
  return new Set((day(t)?.lessons || []).filter((l) => l.pair === pair && !l.cancelled && l.building).map((l) => `${l.building}-${l.room}`));
}
function nextLessonIn(key) {
  const t=mskNow(),entry=scheduleEntries(S.data).find(({lesson:l,date})=>!l.cancelled&&l.format!=='Онлайн'&&`${l.building}-${l.room}`===key&&(date>t.date||date===t.date&&toMin(l.end)>t.minutes));
  if(entry)return `${cap(relativeDay(entry.date,t.date))}, ${entry.lesson.start}–${entry.lesson.end} — ${entry.lesson.title} · ${entry.lesson.teacher?.short||S.data.profile.name}`;
  return '';
}
export function roomCard(key, pair) {
  const r = roomByKey(key);
  if (!r) return `<section class="card"><div class="stack"><p class="title">Выберите аудиторию</p><p class="small muted">Нажмите на аудиторию на плане этажа или на номер в списке свободных, чтобы увидеть занятость по парам и как пройти.</p></div></section>`;
  const st = roomState(key, pair), next = nextLessonIn(key), cur = roomsIsToday()?defaultPair():0;
  return `<section class="card"><div class="stack"><div class="row"><div><p class="eyebrow">Корпус ${esc(r.building)} · ${r.floor} этаж</p><p class="title">Аудитория ${esc(r.room)}</p></div><span class="tag ${st.cls === 'free' ? 'mint' : st.cls === 'staff' ? 'papaya' : ''}">${st.cls === 'free' ? 'Свободна' : st.cls === 'off' ? 'Служебное' : st.cls==='unknown'?'Нет данных':'Занята'} · ${pair} пара</span></div>
    <p>${esc(r.kind)}${r.seats ? `, ${r.seats} мест` : ''}. ${esc(r.hint)}.</p>${st.cls === 'staff' ? `<p class="small">${esc(st.text)}</p>` : ''}
    ${r.seats ? `<div><p class="cap">Занятость ${esc(dayShort(mapDate()))} по парам</p><div class="pairs-row">${S.data.campus.bells.map((b) => { const x = roomState(key, b.pair); return `<span class="${x.cls === 'free' ? '' : x.cls} ${b.pair === cur ? 'cur' : ''}" title="${esc(x.text)}"><b>${b.pair}</b>${x.cls === 'free' ? 'своб.' : x.cls==='unknown'?'нет данных':'занята'}</span>`; }).join('')}</div></div>` : ''}
    ${next ? `<p class="small"><span class="tag marigold">Ваше занятие</span> ${esc(next)}</p>` : ''}</div></section>`;
}
const freeChip = (r) => `<button class="chip" data-room3="${esc(r.key)}" aria-pressed="${S.room === r.key}">${esc(r.room)} · ${r.seats} мест</button>`;
export function viewRooms() {
  const pair = activePair(), mine = myRoomsAt(pair);
  const floor = activeFloor(S.bld, mine);
  const free = freeRooms(pair, S.bld).filter((r) => r.floor === floor), total = S.data.campus.rooms.filter((r) => r.building === S.bld && r.floor === floor && r.seats).length;
  const b = building(S.bld);
  const target = S.room && !S.routeBlocked ? roomByKey(S.room) : null;
  return `<div class="page campus-page">${territoryScene(false, target ? {building: target.building, label: BUILDING_WING[target.building] && BUILDING_WING[target.building] !== target.building ? `${target.building} (на схеме — ${BUILDING_WING[target.building]})` : target.building, room: target.room} : null)}${head('Внутри корпуса', 'Аудитории и занятия', `Проектная версия по мотивам плана главного здания: внутренние дворы, коридоры и аудитории. Номера, назначение комнат и этажность придуманы для прототипа.`)}
    ${navigationPanel()}<div class="stack">${mapDate()===S.data.campus.rooms_date?roomsDayNote():''}${buildingSeg()}${pairChips(pair)}</div>
    <section class="card campus-card" id="campus-map"><div class="row"><div><p class="eyebrow">${esc(b.name)} · открыт ${esc(b.hours)}</p><p class="title">${floor} этаж · ${mapDate()===S.data.campus.rooms_date?`свободно ${free.length} из ${total}`:esc(dayShort(mapDate()))}</p></div>
        <div class="rot"><button class="icon-btn flip" data-rot="-15" aria-label="Повернуть корпус влево">${icon('arrow')}</button><button class="icon-btn" data-rot="15" aria-label="Повернуть корпус вправо">${icon('arrow')}</button></div></div>
      ${navigationCaption()}${building3d(S.bld, pair, {mine, selected: S.room})}${legend3d()}</section>
    <div class="cols"><div class="stack"><div id="room-card">${roomCard(S.room, pair)}</div>
        <section class="card"><div class="stack"><p class="title">Свободны на ${pair} паре</p>${free.length ? `<div class="free-list">${free.slice(0, 9).map(freeChip).join('')}</div>${free.length > 9 ? `<details class="more" ${free.slice(9).some((r) => r.key === S.room) ? 'open' : ''}><summary>Показать ещё ${free.length - 9}</summary><div class="free-list">${free.slice(9).map(freeChip).join('')}</div></details>` : ''}` : `<p class="muted">${mapDate()===S.data.campus.rooms_date?'На выбранном этаже нет свободных аудиторий на этой паре.':'Общая занятость на этот день неизвестна. На карте отмечены только ваши занятия.'}</p>`}<p class="cap">${esc(b.hint)}</p></div></section></div>
      <section class="card"><div class="stack"><label for="room-q" class="title">Найти аудиторию</label><input id="room-q" type="search" placeholder="Номер, например 512, или «деканат»" value="${esc(S.roomQuery)}" autocomplete="off" enterkeyhint="search"><div id="rooms-list">${roomsFiltered()}</div></div></section></div></div>`;
}
export function roomsFiltered() {
  const q = S.roomQuery.trim().toLowerCase();
  const mineAll = new Set(S.data.schedule.flatMap((dd) => dd.lessons.filter((l) => l.building).map((l) => `${l.building}-${l.room}`)));
  const rooms = S.data.campus.rooms.filter((r) => (q ? `${r.room} ${r.kind} ${r.place} ${r.building}${r.room}`.toLowerCase().includes(q) : mineAll.has(r.key))).slice(0, 12);
  if (!rooms.length) return empty('search', 'Ничего не найдено', 'Проверьте номер аудитории.');
  return `${q ? '' : '<p class="cap">Аудитории из вашего расписания</p>'}<div>${rooms.map((r) => `<div class="room ${mineAll.has(r.key) ? 'mine' : ''}"><button class="room-no btn-plain" data-room3="${esc(r.key)}" aria-label="Показать аудиторию ${esc(r.room)} на схеме"><span><small>КОРПУС ${esc(r.building)}</small>${esc(r.room)}</span></button><div class="room-info"><strong>${esc(r.kind)}</strong><span class="small muted">${r.floor} этаж${r.seats ? ` · ${r.seats} мест` : ''}</span><span class="small">${esc(r.hint)}</span>${nextLessonIn(r.key) ? `<span class="tag marigold">${esc(nextLessonIn(r.key))}</span>` : ''}</div></div>`).join('')}</div>`;
}

/* ---------- Помощник, профиль ---------- */
export function viewAssistant() {
  return `<div class="page">${head('Помощник', 'Справочный помощник', 'Отвечает по вашему расписанию, заданиям и срокам, консультациям, контролю и порядку оформления документов.')}
    <section class="card"><div class="stack"><div class="row"><p class="title">Беседа</p><span class="tag periwinkle">${S.data.ai_live ? 'ИИ подключён' : 'Справочный режим'}</span></div>
    <div class="messages" role="log" aria-label="Сообщения помощника" aria-live="polite" aria-busy="${S.busy}">${S.messages.length ? S.messages.map((m) => `<div class="msg ${m.from === 'user' ? 'me' : ''}"><small>${m.from === 'user' ? 'Вы' : 'Помощник'}</small>${esc(m.text)}</div>`).join('') : empty('chat', 'Задайте вопрос', 'Например: «Что завтра?» или «Есть ли изменения в расписании?»')}</div>
    <div class="chips">${QUESTIONS.map((q, i) => `<button class="chip" data-question="${i}" ${S.busy ? 'disabled' : ''}>${q}</button>`).join('')}</div>
    <form id="assistant-form"><label for="question">Ваш вопрос</label><div class="ask"><input id="question" name="question" maxlength="500" required placeholder="Введите вопрос" ${S.busy ? 'disabled' : ''} autocomplete="off"><button class="btn" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Отвечаю…' : 'Отправить'}</button></div></form></div></section></div>`;
}
export function viewProfile() {
  const p = S.data.profile;
  const rows = [['Факультет', p.faculty], ['Направление', p.program], ['Уровень образования', p.level], ['Форма обучения', p.form], ['Курс', p.year], ['Группа', p.group_name], ['Подгруппа', p.subgroup], ['Номер зачётной книжки', p.record_book], ['Куратор группы', p.curator]];
  const url = p.card_code ? verifyUrl(p.card_code) : '';
  const qr = url ? qrSvg(url) : '';
  return `<div class="page">${head('Профиль', 'Студенческий билет', 'Электронный билет с QR-кодом. По коду можно проверить статус обучения без входа в кабинет.')}
    <div class="cols even idcard3d-profile"><div class="stack">
      <div class="idcard3d" data-idcard>
        <button class="idcard3d-toggle" type="button" role="button" aria-label="Перевернуть билет" aria-pressed="false" data-idcard-toggle></button>
        <div class="idcard3d-tilt" data-idcard-tilt><div class="idcard3d-flip">
          <div class="idcard3d-edges" aria-hidden="true">${'<span></span>'.repeat(7)}</div>
          <article class="idcard sky idcard3d-front" aria-label="Электронный студенческий билет" data-idcard-front>
            <span class="ic-holo" aria-hidden="true"></span>
            <div class="row ic-top"><span class="ic-brand"><img src="/mark.png" alt="" width="28" height="28">Кампус</span><span class="tag mint">Обучается</span></div>
            <div class="ic-mid"><span class="ic-photo" aria-hidden="true">${esc(p.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span>
              <div class="who"><p class="ic-kicker">Студенческий билет</p><p class="h2">${esc(p.name)}</p><p>${esc(p.program)} · ${p.year} курс</p></div><span class="ic-chip" aria-hidden="true"></span></div>
            <div class="grid"><dl><div><dt>Группа</dt><dd>${esc(p.group_name)}</dd></div><div><dt>Зачётная книжка</dt><dd>${esc(p.record_book || '')}</dd></div><div><dt>Действителен до</dt><dd>${dayMonth(p.card_valid_until)} ${p.card_valid_until.slice(0, 4)}</dd></div></dl>${qr}</div>
          </article>
          <article class="idcard sky idcard3d-back" data-idcard-back inert>
            <p class="eyebrow">Кампус · студенческий билет</p>
            <div class="idcard3d-stripe" aria-hidden="true"></div>
            ${qr ? `<figure class="idcard3d-verify">${qr}<figcaption>Проверка подлинности</figcaption></figure>` : ''}
            <dl><div><dt>Зачётная книжка</dt><dd>${esc(p.record_book || '')}</dd></div></dl>
            <div class="idcard3d-note"><p>Демонстрационный билет, не является документом</p>
              ${url ? `<p>Ссылка проверки: <a href="${esc(url)}">${esc(url)}</a></p>` : ''}
            </div>
          </article>
        </div></div>
      </div>
      <p class="cap">Нажмите на билет, чтобы перевернуть</p>
      <section class="card"><div class="list">${item({href: 'notices', ico: 'bell', tone: 'marigold', title: 'Уведомления', sub: unreadCount() ? `Непрочитанных: ${unreadCount()}` : 'Все прочитаны'})}${item({href: 'assistant', ico: 'chat', tone: 'periwinkle', title: 'Помощник', sub: 'Ответы по расписанию, срокам и справкам'})}</div></section></div>
    <section class="card profile"><div class="stack"><p class="title">Сведения об обучении</p><dl>${rows.filter((r) => r[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <p class="cap">Логин: ${esc(p.login)}. Учётная запись демонстрационная, сведения вымышлены.</p><button class="btn ghost" data-logout>${icon('logout')}Выйти из кабинета</button></div></section></div></div>`;
}

/* ---------- Поиск ---------- */
export function searchSheet() {
  return `<div class="sheet-in"><div class="sheet-top"><h2 id="sheet-title" class="title">Поиск</h2><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <div class="search-box">${icon('search')}<input id="search-q" type="search" placeholder="Занятие, преподаватель, аудитория, справка" autocomplete="off" aria-label="Поиск по кабинету" enterkeyhint="search"></div>
    <div id="search-results" class="results">${searchResults('')}</div></div>`;
}
export function searchResults(query) {
  const q = query.trim().toLowerCase(), t = nowIso();
  const res = (attrs, ico, tone, title, sub) => `<${attrs.startsWith('href') ? 'a' : 'button'} class="res" ${attrs}><span class="ico ${tone}">${icon(ico)}</span><span><strong>${title}</strong><span>${sub}</span></span></${attrs.startsWith('href') ? 'a' : 'button'}>`;
  const out = [];
  const sections = [['today', 'Сегодня', 'главная сводка день'], ['schedule', 'Расписание', 'пары занятия неделя звонки календарь'], ['study', 'Учёба', 'баллы оценки сессия экзамен зачёт допуск успеваемость'], ['requests', 'Заявки и справки', 'деканат документ заявление статус'], ['notices', 'Уведомления', 'объявления новости изменения дедлайн'], ['rooms', 'Корпуса и аудитории', 'свободные аудитории кабинет схема этаж где'], ['assistant', 'Помощник', 'вопрос чат'], ['profile', 'Профиль и студенческий билет', 'студбилет qr группа']];
  const sec = sections.filter(([, name, keys]) => !q || `${name} ${keys}`.toLowerCase().includes(q));
  const docs = DOCS.filter((x) => !q || `${x.kind} ${x.what} справка документ заказать`.toLowerCase().includes(q));
  if (!q) {
    out.push('<p class="label">Частые действия</p>', res('data-request-kind="Справка об обучении"', 'requests', 'mint', 'Заказать справку об обучении', '1–2 рабочих дня'), res('href="#rooms"', 'building', 'sky', 'Свободные аудитории', 'Схема этажей по парам'), res('href="#schedule"', 'schedule', 'periwinkle', 'Расписание на неделю', 'С изменениями и окнами'), res('href="#study"', 'study', 'marigold', 'Баллы и сессия', 'Допуск и даты контроля'));
    return out.join('');
  }
  const lessons = [];
  for (const dd of S.data.schedule) {
    if (dd.date < t) continue;
    for (const l of dd.lessons) if (`${l.title} ${l.teacher.name} ${l.type} ${l.place}`.toLowerCase().includes(q)) lessons.push([l, dd]);
  }
  const rooms = S.data.campus.rooms.filter((r) => `${r.room} ${r.building}${r.room} ${r.building}-${r.room} ${r.kind}`.toLowerCase().includes(q)).slice(0, 5);
  const teachers = [...new Map(S.data.grades.map((g) => [g.teacher.name, g])).values()].filter((g) => g.teacher.name.toLowerCase().includes(q));
  if (lessons.length) out.push('<p class="label">Занятия</p>', ...lessons.slice(0, 5).map(([l, dd]) => res(`data-lesson="${esc(l.id)}"`, 'schedule', 'periwinkle', esc(l.title), `${cap(relativeDay(dd.date, t))}, ${l.start} · ${esc(l.type)} · ${esc(l.place)}`)));
  if (rooms.length) out.push('<p class="label">Аудитории</p>', ...rooms.map((r) => res(`data-goto-room="${esc(r.key)}"`, 'building', 'mint', `Корпус ${esc(r.building)}, ауд. ${esc(r.room)}`, `${esc(r.kind)} · ${r.floor} этаж`)));
  if (teachers.length) out.push('<p class="label">Преподаватели</p>', ...teachers.map((g) => res('href="#study"', 'user', 'sky', esc(g.teacher.name), `${esc(g.title)} · консультации: ${esc(g.teacher.hours)}`)));
  if (docs.length) out.push('<p class="label">Документы</p>', ...docs.map((x) => res(`data-request-kind="${x.kind}"`, x.ico, x.tone, `Оформить: ${x.kind.toLowerCase()}`, x.sla)));
  if (sec.length) out.push('<p class="label">Разделы</p>', ...sec.map(([id, name]) => res(`href="#${id}"`, 'arrow', '', name, 'Перейти в раздел')));
  return out.length ? out.join('') : empty('search', 'Ничего не найдено', 'Попробуйте название дисциплины, фамилию или номер аудитории.');
}
