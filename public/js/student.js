import {S, lessonIndex} from './state.js';
import {icon} from './icons.js';
import {esc, mskNow, toMin, dayLong, dayShort, dayMonth, weekdayShort, stamp, count, plural, duration, daysBetween, relativeDay, untilText, cap, fmt, qrSvg, verifyUrl} from './util.js';
import {building3d, legend3d, pairChips, buildingSeg, activePair, roomByKey, roomState, freeRooms, roomsDayNote, roomsIsToday, defaultPair} from './campus.js';
import {ring, sparkline, dayTimeline, weekGrid, heatmap, miniTrack} from './viz.js';

export const NAV = [['today', 'Сегодня', 'today'], ['schedule', 'Расписание', 'schedule'], ['study', 'Учёба', 'study'], ['requests', 'Заявки', 'requests'], ['more', 'Ещё', 'more']];
export const ROUTES = ['today', 'schedule', 'study', 'requests', 'more', 'notices', 'rooms', 'assistant', 'profile', 'doc'];
export const NAV_OF = {notices: 'more', rooms: 'more', assistant: 'more', profile: 'more', doc: 'requests'};
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
const TAG_TONE = {'Расписание': 'marigold', 'Деканат': 'periwinkle', 'Дедлайн': 'papaya', 'Мероприятие': 'mint'};
const TYPE_TONE = {'Лекция': 't-lec', 'Семинар': 't-sem', 'Практика': 't-prac', 'Лабораторная работа': 't-lab'};
export const QUESTIONS = ['Какие пары сегодня?', 'Что завтра?', 'Есть ли изменения в расписании?', 'Когда сессия?', 'Как заказать справку?'];

export const nowIso = () => mskNow().date;
const day = (iso) => S.data.schedule.find((d) => d.date === iso);
export const unreadCount = () => S.data.notices.filter((n) => !n.read).length;
export const readyCount = () => S.data.requests.filter((r) => r.status === 'Готова').length;
const building = (id) => S.data.campus.buildings.find((b) => b.id === id);
export const statusTag = (s) => `<span class="tag ${STATUS_TONE[s] || ''}">${esc(s)}</span>`;
export const empty = (ico, title, text = '') => `<div class="empty">${icon(ico)}<strong>${title}</strong>${text ? `<span>${text}</span>` : ''}</div>`;
export const head = (eyebrow, title, lede = '') => `<header class="page-head"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</header>`;
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
  if (isNow(l, iso, t)) tags.push('<span class="tag ink"><span class="dot pulse"></span>Идёт сейчас</span>');
  if (l.cancelled) tags.push('<span class="tag papaya">Отменено</span>');
  else if (l.change) tags.push(`<span class="tag marigold">${esc(l.change.label)}</span>`);
  if (l.subgroup) tags.push(`<span class="tag">${esc(l.subgroup)}</span>`);
  if (l.format === 'Онлайн') tags.push('<span class="tag sky">Онлайн</span>');
  if (l.parity) tags.push(`<span class="tag">${l.parity === 'odd' ? 'Нечётные недели' : 'Чётные недели'}</span>`);
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

function nowCard() {
  const t = mskNow(), d = day(t.date);
  const list = (d?.lessons || []).filter((l) => !l.cancelled);
  const cur = list.find((l) => isNow(l, t.date, t));
  const next = list.find((l) => toMin(l.start) > t.minutes);
  const meta = (l) => `<div class="meta"><span>${icon('clock')}${l.start}–${l.end}, ${l.pair} пара · ${esc(l.type)}</span><span>${icon('pin')}${where(l)}</span><span>${icon('user')}${esc(l.teacher.name)}</span></div>`;
  if (cur) {
    const total = toMin(cur.end) - toMin(cur.start), left = toMin(cur.end) - t.minutes;
    return `<section class="now" aria-label="Идёт занятие"><div class="row"><span class="tag ink"><span class="dot pulse"></span>Идёт сейчас</span><span class="small muted">осталось ${duration(left)}</span></div>
      <p class="title">${esc(cur.title)}</p>${meta(cur)}<div class="bar" data-pct="${Math.round((total - left) / total * 100)}"></div>
      ${next ? `<p class="small muted">Далее в ${next.start}: ${esc(next.title)}, ${esc(next.place)}</p>` : ''}<button class="btn sm" data-lesson="${esc(cur.id)}">Подробности</button></section>`;
  }
  if (next) {
    return `<section class="now" aria-label="Следующее занятие"><div class="row"><span class="tag periwinkle">Следующая пара</span><span class="small muted">через ${duration(toMin(next.start) - t.minutes)}</span></div>
      <p class="title">${esc(next.title)}</p>${meta(next)}<button class="btn sm" data-lesson="${esc(next.id)}">Подробности</button></section>`;
  }
  const upcoming = nextLessonDay(t.date), first = upcoming?.lessons.find((l) => !l.cancelled);
  return `<section class="now" aria-label="Расписание на сегодня"><div class="row"><span class="tag mint">${d?.lessons.length ? 'День завершён' : 'Свободный день'}</span></div>
    <p class="title">${d?.lessons.length ? 'Занятия на сегодня закончились' : 'Сегодня занятий нет'}</p>
    ${first ? `<div class="meta"><span>${icon('schedule')}Ближайшее занятие: ${esc(relativeDay(upcoming.date, t.date))}, ${first.start}, ${first.pair} пара</span><span>${icon('book')}${esc(first.title)}</span><span>${icon('pin')}${where(first)}</span></div><button class="btn sm" data-lesson="${esc(first.id)}">Подробности</button>` : '<p class="muted">В ближайшие дни занятий нет.</p>'}</section>`;
}

/* ---------- Сегодня ---------- */
function gradeStats() {
  const g = S.data.grades;
  return {avg: g.length ? Math.round(g.reduce((s, x) => s + x.points, 0) / g.length) : 0, admitted: g.filter((x) => x.result !== 'Нет допуска').length, total: g.length, risk: g.filter((x) => x.result === 'Нет допуска')};
}
const weeksBar = (s) => `<div class="weeks" role="img" aria-label="Идёт ${s.week}-я неделя из ${s.weeks}">${Array.from({length: s.weeks}, (_, i) => `<i class="${i + 1 < s.week ? 'done' : i + 1 === s.week ? 'cur' : ''}"></i>`).join('')}</div>`;
const period = (m) => (m < 360 ? 'night' : m < 660 ? 'morning' : m < 1020 ? 'day' : m < 1260 ? 'evening' : 'night');
export const clockText = () => { const m = mskNow().minutes; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export function viewToday() {
  const t = nowIso(), m = mskNow().minutes, d = S.data, s = d.semester, st = gradeStats();
  const today = day(t), todayLessons = today?.lessons || [];
  const greet = m < 300 ? 'Доброй ночи' : m < 720 ? 'Доброе утро' : m < 1080 ? 'Добрый день' : 'Добрый вечер';
  const notes = [];
  for (const dd of d.schedule) {
    if (dd.date < t) continue;
    for (const l of dd.lessons) {
      if (!l.change) continue;
      const when = `${cap(relativeDay(dd.date, t))}, ${l.pair} пара`;
      notes.push(`<button class="change ${l.cancelled ? 'is-cancel' : ''}" data-lesson="${esc(l.id)}"><span class="change-kind">${esc(l.change.label)}</span><span class="change-body"><strong>${esc(l.title)}</strong><span class="change-diff">${when} · ${l.cancelled ? esc(l.change.reason) : `<s>${esc(l.change.was)}</s> <span aria-hidden="true">→</span> <b>${esc(l.change.now)}</b>`}</span></span>${icon('chevron')}</button>`);
    }
  }
  for (const n of d.notices.filter((x) => !x.read && x.tag !== 'Расписание' && x.tag !== 'Дедлайн')) {
    notes.push(`<a class="change" href="#notices"><span class="change-kind">${esc(n.tag)}</span><span class="change-body"><strong>${esc(n.title)}</strong><span class="change-diff">${esc(n.body)}</span></span>${icon('chevron')}</a>`);
  }
  const todo = [];
  for (const r of d.requests.filter((x) => x.status === 'Готова')) todo.push(item({href: r.document ? `doc/${r.id}` : 'requests', ico: 'requests', tone: 'mint', title: `Документ готов: ${esc(r.kind.toLowerCase())}`, sub: 'Электронная версия в кабинете, оригинал в ауд. А-112.'}));
  for (const n of d.notices.filter((x) => x.tag === 'Дедлайн')) todo.push(item({href: 'notices', ico: 'clock', tone: 'marigold', title: esc(n.title), sub: esc(n.body)}));
  for (const g of st.risk) todo.push(item({href: 'study', ico: 'alert', tone: 'papaya', title: `Нет допуска: ${esc(g.title)}`, sub: `До порога допуска не хватает ${60 - g.points} ${60 - g.points === 1 ? 'балла' : 'баллов'}.`}));
  const nextControl = d.grades.filter((g) => g.date >= t)[0];
  const nextExam = d.grades.filter((g) => g.date >= t && g.assessment === 'Экзамен')[0] || nextControl;
  const toSession = daysBetween(t, s.session_starts);
  const pair = defaultPair();
  const freeNow = freeRooms(pair, 'А').length, totalA = S.data.campus.rooms.filter((r) => r.building === 'А' && r.seats).length;
  const pairsToday = todayLessons.filter((l) => !l.cancelled).length;
  const lastReq = d.requests[0];
  const daysToExam = nextExam ? daysBetween(t, nextExam.date) : 0;
  return `<div class="page">
    <section class="hero hero-${period(m)}"><span class="orb o1" aria-hidden="true"></span><span class="orb o2" aria-hidden="true"></span><span class="orb o3" aria-hidden="true"></span>
      <div class="hero-copy"><p class="eyebrow">${cap(dayLong(t))} · <span data-clock>${clockText()}</span></p><h1>${greet},<br>${esc(d.profile.name.split(' ')[0])}</h1><p class="lede">${esc(d.profile.group_name)} · ${esc(d.profile.program)}</p>
        <div class="hero-day"><div class="row"><span class="small"><b>Ваш день</b> · ${pairsToday ? count(pairsToday, ['пара', 'пары', 'пар']) : 'пар нет'}</span><span class="small">неделя ${s.week} из ${s.weeks}, ${s.parity_label}</span></div>${dayTimeline(today, t)}</div></div>
      ${nowCard()}</section>
    <div class="bento">
      <section class="card b-changes"><div class="sec-head"><p class="title">Что изменилось</p>${go('notices', 'Все уведомления')}</div>${notes.length ? `<div class="changes">${notes.join('')}</div>` : empty('check', 'Изменений нет', 'Занятия проходят по расписанию.')}</section>
      <section class="card b-count">${nextExam ? `<p class="eyebrow">До ${nextExam.assessment === 'Экзамен' ? 'экзамена' : 'зачёта'}</p>
        <div class="count"><span class="big" data-count="${daysToExam}">${daysToExam}</span><span>${plural(daysToExam, ['день', 'дня', 'дней'])}</span></div>
        <p class="b-count-title">${esc(nextExam.title)}</p><p class="small">${dayMonth(nextExam.date)}, ${nextExam.start} · ${esc(nextExam.place)}</p>
        <div class="b-count-foot"><span class="small">Неделя ${s.week} из ${s.weeks}${toSession > 0 ? ` · сессия через ${count(toSession, ['день', 'дня', 'дней'])}` : ''}</span>${weeksBar(s)}</div>` : '<p class="title">Сессия завершена</p>'}</section>
      <a class="card b-ring" href="#study"><div class="ring-wrap">${ring(st.avg, {size: 132, stroke: 7, label: `Средний балл ${st.avg} из 100`})}<span class="ring-num"><span data-count="${st.avg}">${st.avg}</span><small>из 100</small></span></div>
        <div class="stack-sm"><p class="eyebrow">Успеваемость</p><p class="b-big">Средний балл</p><p class="small muted">Допуск по ${st.admitted} из ${st.total} дисциплин${st.risk.length ? `. Требует внимания: ${esc(st.risk[0].title)}` : ''}</p></div></a>
      <a class="card b-rooms" href="#rooms"><div class="row"><p class="eyebrow">Корпус А · ${pair} пара${roomsIsToday() ? '' : ', завтра'}</p><span class="tag mint">${freeNow} свободно</span></div>${heatmap('А', pair)}<p class="small muted">Свободно ${freeNow} из ${totalA} аудиторий. Нажмите, чтобы открыть схему.</p></a>
      <a class="card b-req" href="#requests">${lastReq ? `<p class="eyebrow">Последняя заявка</p><p class="b-big">${esc(lastReq.kind)}</p><span>${statusTag(lastReq.status)}</span>${lastReq.status === 'Отклонена' ? '' : miniTrack(lastReq.status, STEPS)}<p class="small muted">${esc(hintFor(lastReq))}</p>` : '<p class="eyebrow">Заявки</p><p class="b-big">Справка за 1–2 дня</p><p class="small muted">Закажите онлайн и следите за статусом.</p>'}</a>
      <section class="b-today"><div class="sec-head"><p class="title">Сегодня</p>${go('schedule', 'Вся неделя')}</div>${todayLessons.length ? lessonsList(todayLessons, t) : empty('schedule', 'Занятий нет', 'Свободный день.')}</section>
      <section class="card b-todo"><div class="stack"><p class="title">Что нужно сделать</p>${todo.length ? `<div class="list">${todo.join('')}</div>` : empty('check', 'Срочных дел нет')}
        <div class="b-actions"><button class="btn block" data-request-kind="Справка об обучении">${icon('requests')}Заказать справку</button><button class="btn ghost block" data-calendar="week">${icon('download')}Неделя в календарь</button></div></div></section>
    </div></div>`;
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
  return `<div class="page">${head(S.data.semester.term, 'Расписание', 'Нажмите на занятие, чтобы увидеть преподавателя, этаж и как пройти. Время московское.')}
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
    <div class="chips">${tags}</div>${change}
    <dl class="facts">
      ${row('Время', `${l.start}–${l.end}, ${l.pair} пара`)}
      ${row('Место', l.format === 'Онлайн' ? 'Онлайн. Ссылка для подключения размещена в LMS на странице дисциплины.' : `${esc(l.place)}${l.floor ? `, ${l.floor} этаж` : ''}${r ? `<br><span class="muted">${esc(r.kind)}. ${esc(r.hint)}.</span>` : ''}`)}
      ${row('Корпус', b ? `${esc(b.name)}, открыт ${esc(b.hours)}<br><span class="muted">${esc(b.hint)}</span>` : '')}
      ${row('Преподаватель', `${esc(l.teacher.name)}<br><span class="muted">${esc(l.teacher.title)}</span>`)}${row('Кафедра', esc(l.teacher.dept))}${row('Консультации', esc(l.teacher.hours))}
      ${row('Неделя', `${d.week}-я, ${d.parity === 'odd' ? 'нечётная' : 'чётная'}${l.parity ? `. Занятие проходит только по ${l.parity === 'odd' ? 'нечётным' : 'чётным'} неделям` : ''}`)}
    </dl><div class="chips">${l.cancelled ? '' : `<button class="btn sm" data-ics-lesson="${esc(l.id)}">${icon('download')}В календарь</button>`}${r ? `<button class="btn ghost sm" data-goto-room="${esc(r.key)}">${icon('building')}Показать на схеме</button>` : ''}</div></div>`;
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
  return `<div class="page">${head(s.term, 'Учёба', 'Баллы текущего контроля, допуск и график сессии.')}
    <section class="stats" aria-label="Показатели">
      <div class="stat"><span class="num">${st.avg}</span><span class="l">средний балл из 100</span></div>
      <div class="stat"><span class="num">${st.admitted}<small>/${st.total}</small></span><span class="l">дисциплин с допуском</span></div>
      <div class="stat"><span class="num">${next ? daysBetween(t, next.date) : '—'}</span><span class="l">дней до ближайшего контроля</span></div>
      <div class="stat"><span class="num">${toSession > 0 ? toSession : 0}</span><span class="l">дней до начала сессии</span></div></section>
    ${risk}
    <section class="sec">${secHead('Семестр')}<div class="strip" role="img" aria-label="Идёт ${s.week}-я неделя из ${s.weeks}, сессия с ${dayMonth(s.session_starts)}">${Array.from({length: s.weeks}, (_, i) => `<div class="${i + 1 < s.week ? 'done' : i + 1 === s.week ? 'cur' : ''}"><b>${i + 1}</b>${i + 1 === s.week ? 'сейчас' : 'нед.'}</div>`).join('')}<div class="session"><b>Сессия</b>с ${dayMonth(s.session_starts)}</div></div></section>
    <section class="sec">${secHead('Баллы по дисциплинам')}<div class="courses">${d.grades.map((g) => `<article class="card course"><div class="course-head"><div class="ring-wrap sm">${ring(g.points, {size: 76, stroke: 9, tone: g.points < 60 ? 'papaya' : 'ink', label: `${g.points} баллов из 100`})}<span class="ring-num"><span data-count="${g.points}">${g.points}</span></span></div>
      <div class="course-info"><h3>${esc(g.title)}</h3><span class="small muted">${esc(g.teacher.short)} · ${esc(g.assessment)}</span><span><span class="tag ${g.result === 'Нет допуска' ? 'papaya' : 'mint'}">${esc(g.result)}</span></span></div></div>
      <div class="spark-wrap">${sparkline(g.trend, {label: `Баллы по неделям: ${g.trend.join(', ')}`})}<div class="spark-axis"><span>1 нед.</span><span>порог 60</span><span>${g.trend.length} нед.</span></div></div>
      <p class="small muted">${advice(g)}</p></article>`).join('')}</div>
      <p class="cap">Кольцо — баллы из 100. График — накопление баллов по неделям, пунктир — порог допуска 60. Шкала перевода условная, данные демонстрационные.</p></section>
    <section class="sec">${secHead('График сессии')}<div class="card">${d.grades.map((g) => `<div class="tl ${g.assessment === 'Экзамен' ? 'exam' : ''} ${g.date < t ? 'past' : ''}"><div class="tl-date"><b>${fmt(g.date, {day: 'numeric'})}</b><span>${fmt(g.date, {month: 'short'}).replace('.', '')}</span></div>
      <div><div class="row"><h3>${esc(g.title)}</h3><span class="tag ${g.assessment === 'Экзамен' ? 'marigold' : 'periwinkle'}">${esc(g.assessment)}</span></div><p>${g.start} · ${esc(g.place)} · ${esc(g.examiner)} · ${untilText(g.date, t)}${g.consultation ? `<br>Консультация: ${dayShort(g.consultation.date)}, ${g.consultation.start}, ${esc(g.consultation.place)}` : ''}</p></div></div>`).join('')}</div></section></div>`;
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
      <div class="center"><p class="eyebrow">Цифровой деканат · концепт</p><h2>${esc(r.kind)}</h2><p class="cap">№ ${esc(r.id.slice(0, 6).toUpperCase())} · выдана ${dayMonth(r.document.issued)} ${r.document.issued.slice(0, 4)} г.</p></div>
      <div class="body stack">${body}</div>
      <div class="doc-foot"><div class="stack"><p class="eyebrow">Проверка подлинности</p><p class="small">Наведите камеру на QR-код или откройте ссылку. Страница проверки покажет статус документа без входа в кабинет.</p><p class="small"><a href="${esc(url)}">${esc(url)}</a></p><p class="cap">Код: ${esc(r.document.code)}</p></div>${qrSvg(url)}</div></article></div>`;
}

/* ---------- Ещё ---------- */
export function viewMore() {
  const u = unreadCount();
  return `<div class="page">${head('Ещё', 'Сервисы')}
    <div class="cols even"><section class="card"><div class="list">
      ${item({href: 'notices', ico: 'bell', tone: 'marigold', title: 'Уведомления', sub: u ? `Непрочитанных: ${u}` : 'Все прочитаны'})}
      ${item({href: 'rooms', ico: 'building', tone: 'mint', title: 'Корпуса и аудитории', sub: 'Схема этажей и свободные аудитории'})}
      ${item({href: 'assistant', ico: 'chat', tone: 'periwinkle', title: 'Помощник', sub: 'Ответы по расписанию, срокам и справкам'})}
      ${item({href: 'profile', ico: 'user', tone: 'sky', title: 'Профиль и студенческий билет', sub: 'Сведения об обучении, билет с QR'})}</div></section>
    <section class="card"><div class="stack"><p class="eyebrow">О сервисе</p><p>Концепт цифрового деканата для конкурса MGIMO×AI Challenge. Не является официальным сервисом университета. Все данные вымышлены.</p><p class="cap">Данные обновлены: ${esc(stamp(S.data.updated))} по Москве.</p><button class="btn ghost" data-logout>${icon('logout')}Выйти из кабинета</button></div></section></div></div>`;
}

export function viewNotices() {
  const list = S.noticeFilter === 'unread' ? S.data.notices.filter((n) => !n.read) : S.data.notices, u = unreadCount();
  return `<div class="page">${head('Уведомления', 'Объявления и изменения', 'Объявления деканата, изменения расписания и сроки в одной ленте.')}
    <div class="chips"><button class="chip" data-nfilter="all" aria-pressed="${S.noticeFilter === 'all'}">Все · ${S.data.notices.length}</button><button class="chip" data-nfilter="unread" aria-pressed="${S.noticeFilter === 'unread'}">Непрочитанные · ${u}</button>${u ? `<button class="link" data-read-all>Отметить все прочитанными</button>` : ''}</div>
    <section class="card">${list.length ? `<div class="list">${list.map((n) => `<article class="item"><span class="ico ${TAG_TONE[n.tag] || ''}">${icon(n.tag === 'Расписание' ? 'swap' : n.tag === 'Дедлайн' ? 'clock' : 'megaphone')}</span>
      <span><span class="chips"><span class="tag ${TAG_TONE[n.tag] || ''}">${esc(n.tag)}</span>${n.read ? '' : '<span class="dot" role="img" aria-label="Не прочитано"></span>'}<span class="cap">${dayShort(n.date)}</span></span><strong>${esc(n.title)}</strong><span class="sub">${esc(n.body)}</span>${n.read ? '' : `<button class="link" data-read="${esc(n.id)}">Отметить прочитанным</button>`}</span><span></span></article>`).join('')}</div>` : empty('bell', 'Нет уведомлений', 'Непрочитанных сообщений нет.')}</section></div>`;
}

/* ---------- Корпуса и аудитории ---------- */
function myRoomsAt(pair) {
  const t = S.data.campus.rooms_date;
  return new Set((day(t)?.lessons || []).filter((l) => l.pair === pair && !l.cancelled && l.building).map((l) => `${l.building}-${l.room}`));
}
function nextLessonIn(key) {
  const t = nowIso();
  for (const dd of S.data.schedule) {
    if (dd.date < t) continue;
    const l = dd.lessons.find((x) => `${x.building}-${x.room}` === key && !x.cancelled);
    if (l) return `${cap(relativeDay(dd.date, t))}, ${l.start} — ${l.title}`;
  }
  return '';
}
export function roomCard(key, pair) {
  const r = roomByKey(key);
  if (!r) return `<section class="card"><div class="stack"><p class="title">Выберите аудиторию</p><p class="small muted">Нажмите на плитку на схеме или на номер в списке свободных, чтобы увидеть занятость по парам и как пройти.</p></div></section>`;
  const st = roomState(key, pair), next = nextLessonIn(key), cur = defaultPair();
  return `<section class="card"><div class="stack"><div class="row"><div><p class="eyebrow">Корпус ${esc(r.building)} · ${r.floor} этаж</p><p class="title">Аудитория ${esc(r.room)}</p></div><span class="tag ${st.cls === 'free' ? 'mint' : st.cls === 'staff' ? 'papaya' : ''}">${st.cls === 'free' ? 'Свободна' : st.cls === 'off' ? 'Служебное' : 'Занята'} · ${pair} пара</span></div>
    <p>${esc(r.kind)}${r.seats ? `, ${r.seats} мест` : ''}. ${esc(r.hint)}.</p>${st.cls === 'staff' ? `<p class="small">${esc(st.text)}</p>` : ''}
    ${r.seats ? `<div><p class="cap">Занятость сегодня по парам</p><div class="pairs-row">${S.data.campus.bells.map((b) => { const x = roomState(key, b.pair); return `<span class="${x.cls === 'free' ? '' : x.cls} ${b.pair === cur ? 'cur' : ''}" title="${esc(x.text)}"><b>${b.pair}</b>${x.cls === 'free' ? 'своб.' : 'занята'}</span>`; }).join('')}</div></div>` : ''}
    ${next ? `<p class="small"><span class="tag marigold">Ваше занятие</span> ${esc(next)}</p>` : ''}</div></section>`;
}
const freeChip = (r) => `<button class="chip" data-room3="${esc(r.key)}" aria-pressed="${S.room === r.key}">${esc(r.room)} · ${r.seats} мест</button>`;
export function viewRooms() {
  const pair = activePair(), mine = myRoomsAt(pair);
  const free = freeRooms(pair, S.bld), total = S.data.campus.rooms.filter((r) => r.building === S.bld && r.seats).length;
  const b = building(S.bld);
  return `<div class="page">${head('Корпуса и аудитории', 'Где свободно', `Схема этажей на сегодня. Выберите корпус и пару: свободные аудитории подсвечены. ${esc(S.data.campus.note)}`)}
    <div class="stack">${roomsDayNote()}${buildingSeg()}${pairChips(pair)}</div>
    <div class="cols"><section class="card"><div class="row"><div><p class="eyebrow">${esc(b.name)}</p><p class="title">${pair} пара: свободно ${free.length} из ${total}</p></div></div>
        <div class="b3d-wrap">${building3d(S.bld, pair, {mine, selected: S.room})}</div><div class="rot"><button class="icon-btn flip" data-rot="-15" aria-label="Повернуть влево">${icon('arrow')}</button><span class="cap">Потяните схему, чтобы повернуть</span><button class="icon-btn" data-rot="15" aria-label="Повернуть вправо">${icon('arrow')}</button></div>${legend3d()}</section>
      <div class="stack lg"><div id="room-card">${roomCard(S.room, pair)}</div>
        <section class="card"><div class="stack"><p class="title">Свободны на ${pair} паре</p>${free.length ? `<div class="free-list">${free.slice(0, 9).map(freeChip).join('')}</div>${free.length > 9 ? `<details class="more" ${free.slice(9).some((r) => r.key === S.room) ? 'open' : ''}><summary>Показать ещё ${free.length - 9}</summary><div class="free-list">${free.slice(9).map(freeChip).join('')}</div></details>` : ''}` : '<p class="muted">В этом корпусе свободных аудиторий на выбранной паре нет.</p>'}<p class="cap">${esc(b.name)}: открыт ${esc(b.hours)}. ${esc(b.hint)}</p></div></section>
        <section class="card"><div class="stack"><label for="room-q" class="title">Найти аудиторию</label><input id="room-q" type="search" placeholder="Номер, например 512, или «деканат»" value="${esc(S.roomQuery)}" autocomplete="off" enterkeyhint="search"><div id="rooms-list">${roomsFiltered()}</div></div></section></div></div></div>`;
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
  return `<div class="page">${head('Помощник', 'Справочный помощник', 'Отвечает по вашему расписанию, срокам контроля и порядку оформления документов.')}
    <section class="card"><div class="stack"><div class="row"><p class="title">Беседа</p><span class="tag periwinkle">${S.data.ai_live ? 'ИИ подключён' : 'Справочный режим'}</span></div>
    <div class="messages" role="log" aria-label="Сообщения помощника" aria-live="polite" aria-busy="${S.busy}">${S.messages.length ? S.messages.map((m) => `<div class="msg ${m.from === 'user' ? 'me' : ''}"><small>${m.from === 'user' ? 'Вы' : 'Помощник'}</small>${esc(m.text)}</div>`).join('') : empty('chat', 'Задайте вопрос', 'Например: «Что завтра?» или «Есть ли изменения в расписании?»')}</div>
    <div class="chips">${QUESTIONS.map((q, i) => `<button class="chip" data-question="${i}" ${S.busy ? 'disabled' : ''}>${q}</button>`).join('')}</div>
    <form id="assistant-form"><label for="question">Ваш вопрос</label><div class="ask"><input id="question" name="question" maxlength="500" required placeholder="Введите вопрос" ${S.busy ? 'disabled' : ''} autocomplete="off"><button class="btn" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Отвечаю…' : 'Отправить'}</button></div></form></div></section></div>`;
}
export function viewProfile() {
  const p = S.data.profile;
  const rows = [['Факультет', p.faculty], ['Направление', p.program], ['Уровень образования', p.level], ['Форма обучения', p.form], ['Курс', p.year], ['Группа', p.group_name], ['Подгруппа', p.subgroup], ['Номер зачётной книжки', p.record_book], ['Куратор группы', p.curator]];
  const url = p.card_code ? verifyUrl(p.card_code) : '';
  return `<div class="page">${head('Профиль', 'Студенческий билет', 'Электронный билет с QR-кодом. По коду можно проверить статус обучения без входа в кабинет.')}
    <div class="cols even"><div class="stack"><article class="idcard" aria-label="Электронный студенческий билет">
      <div class="row"><p class="eyebrow">Студенческий билет</p><span class="tag mint">Обучается</span></div>
      <div class="who"><p class="h2">${esc(p.name)}</p><p>${esc(p.program)} · ${p.year} курс</p></div>
      <div class="grid"><dl><div><dt>Группа</dt><dd>${esc(p.group_name)}</dd></div><div><dt>Зачётная книжка</dt><dd>${esc(p.record_book || '')}</dd></div><div><dt>Действителен до</dt><dd>${dayMonth(p.card_valid_until)} ${p.card_valid_until.slice(0, 4)}</dd></div></dl>${url ? qrSvg(url) : ''}</div></article>
      <p class="cap">Демонстрационный билет, не является документом. ${url ? `Ссылка проверки: <a href="${esc(url)}">${esc(url)}</a>` : ''}</p></div>
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
