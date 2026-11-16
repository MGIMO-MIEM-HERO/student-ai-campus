/* Кабинет преподавателя: сегодня, расписание, журнал, задания, аудитории, профиль. */
import {S} from './state.js';
import {icon} from './icons.js';
import {esc, mskNow, toMin, dayLong, dayShort, weekdayShort, cap, count, plural, duration, relativeDay, daysBetween, fmt, stamp} from './util.js';
import {weekGrid} from './viz.js';
import {roomState, roomByKey} from './campus.js';
import {head, secHead, empty, face, clockText} from './student.js';

export const NAV = [['today', 'Сегодня', 'today'], ['schedule', 'Расписание', 'schedule'], ['journal', 'Журнал', 'study'], ['tasks', 'Задания', 'tasks'], ['rooms', 'Аудитории', 'building']];
export const ROUTES = ['today', 'schedule', 'journal', 'tasks', 'rooms', 'profile'];
export const NAV_OF = {profile: 'today'};

const MARK = {p: 'Был', l: 'Опоздал', a: 'Не был', e: 'Уважительная', '-': 'Не отмечен'};
const MARK_SHORT = {p: '', l: 'О', a: 'Н', e: 'У', '-': ''};
const NEXT_MARK = {'-': 'p', p: 'a', a: 'l', l: 'e', e: '-'};
const TYPE_LETTER = {'Лекция': 'Л', 'Семинар': 'С', 'Практика': 'П', 'Лабораторная работа': 'Лб'};

export const todayIso = () => mskNow().date;
const day = (iso) => S.data.schedule.find((d) => d.date === iso);
const lessonById = (id) => { for (const d of S.data.schedule) { const l = d.lessons.find((x) => x.id === id); if (l) return {...l, date: d.date}; } return null; };
const journalOf = (course, group) => S.data.journals[`${course}:${group}`];
const groupsLine = (l) => l.groups.join(', ');
const go = (href, text) => `<a class="link" href="#${href}">${text} ${icon('arrow')}</a>`;
const where = (l) => (l.format === 'Онлайн' ? 'Онлайн' : `${esc(l.place)}${l.floor ? `, ${l.floor} этаж` : ''}`);
const isNow = (l, iso, t) => !l.cancelled && iso === t.date && toMin(l.start) <= t.minutes && t.minutes < toMin(l.end);
const groupPills = (groups) => groups.map((g) => `<span class="gpill">${esc(g)}</span>`).join('');
export const reviewCount = () => S.data.tasks.filter((t) => t.submitted > t.graded).length;

/* Посещаемость занятия по журналу: [отмечено, присутствовало, всего]. */
function lessonTally(l) {
  let marked = 0, present = 0, total = 0;
  for (const g of l.groups) {
    const j = journalOf(l.course, g);
    const i = j ? j.lessons.findIndex((x) => x.id === l.id) : -1;
    for (const s of j?.students || []) { total++; if (i < 0) continue; const m = s.marks[i]; if (m !== '-') marked++; if (m === 'p' || m === 'l') present++; }
  }
  return {marked, present, total};
}
function avgAttendance() {
  const vals = Object.values(S.data.journals).flatMap((j) => j.students.map((s) => s.att)).filter((v) => v !== null);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}
function riskList() {
  const out = [];
  for (const j of Object.values(S.data.journals)) for (const s of j.students) {
    const why = [];
    if (s.points < 60) why.push(`${s.points} баллов`);
    if (s.att !== null && s.att < 75) why.push(`посещаемость ${s.att}%`);
    if (why.length) out.push({j, s, why});
  }
  return out.sort((a, b) => a.s.points - b.s.points);
}

/* ---------- Сегодня ---------- */
function nowCard() {
  const t = mskNow(), d = day(t.date), list = (d?.lessons || []).filter((l) => !l.cancelled);
  const cur = list.find((l) => isNow(l, t.date, t)), next = list.find((l) => toMin(l.start) > t.minutes);
  const card = (label, extra, l, iso) => {
    const tally = iso === t.date ? lessonTally(l) : null;
    return `<section class="now sky" aria-label="${esc(label)}"><div class="now-top"><span class="pill">${label}</span><span class="now-extra">${extra}</span></div>
      <p class="now-time">${l.start}<span>–${l.end}</span></p><p class="now-title">${esc(l.title)}</p>
      <div class="now-meta"><span>${icon('pin')}${where(l)}</span><span>${icon('user')}${groupsLine(l)} · ${l.students} студ.</span><span>${icon('study')}${esc(l.type)}</span></div>
      <div class="now-foot">${tally ? `<span class="now-who"><span class="tally">${tally.marked ? `${tally.present}/${tally.total}` : '—'}</span><span><b>${tally.marked ? 'Присутствуют' : 'Посещаемость'}</b><span>${tally.marked ? `отмечено ${tally.marked} из ${tally.total}` : 'ещё не отмечена'}</span></span></span>` : '<span></span>'}
        <div class="chips">${iso === t.date ? `<button class="btn light sm" data-att="${esc(l.id)}">${icon('check')}Отметить посещаемость</button>` : ''}<button class="btn light sm" data-lesson="${esc(l.id)}">Подробнее</button></div></div></section>`;
  };
  if (cur) return card('Идёт сейчас', `осталось ${duration(toMin(cur.end) - t.minutes)}`, cur, t.date);
  if (next) return card('Следующее занятие', `через ${duration(toMin(next.start) - t.minutes)}`, next, t.date);
  const up = S.data.schedule.find((x) => x.date > t.date && x.lessons.some((l) => !l.cancelled));
  const first = up?.lessons.find((l) => !l.cancelled);
  if (!first) return '<section class="now sky"><p class="now-title">В ближайшие две недели занятий нет</p></section>';
  const done = list.length ? 'Занятия закончились' : 'Сегодня занятий нет';
  return card(done, `ближайшее ${esc(relativeDay(up.date, t.date))}`, first, up.date);
}
function miniLesson(l, iso) {
  const t = mskNow(), tally = iso <= t.date ? lessonTally(l) : null;
  return `<button class="mini-l ${l.cancelled ? 'is-cancelled' : ''} ${isNow(l, iso, t) ? 'is-now' : ''}" data-lesson="${esc(l.id)}"><b>${l.start}</b><span><strong>${esc(l.title)}</strong><span>${l.change ? `<em class="chg-${l.cancelled ? 'bad' : 'warn'}">${esc(l.change.label)}</em> · ` : ''}${esc(l.type)} · ${groupsLine(l)} · ${where(l)}</span></span>${tally ? `<span class="tally sm ${tally.marked ? 'ok' : ''}" title="Посещаемость">${tally.marked ? `${tally.present}/${tally.total}` : '—'}</span>` : ''}</button>`;
}
export function viewToday() {
  const t = todayIso(), s = S.data.semester, today = day(t)?.lessons || [];
  const review = S.data.tasks.filter((x) => x.submitted > x.graded);
  const risk = riskList();
  const lessonsN = today.filter((l) => !l.cancelled).length;
  return `<div class="page">
    <header class="today-head"><div><p class="eyebrow">${cap(dayLong(t))} · ${s.week}-я неделя, ${s.parity_label} · <span data-clock>${clockText()}</span></p><h1>Сегодня</h1></div>
      <div class="chips"><button class="btn ghost sm" data-tannounce>${icon('megaphone')}Сообщение группе</button><button class="btn sm" data-newtask>${icon('tasks')}Новое задание</button></div></header>
    <div class="today-grid">${nowCard()}
      <section class="card day-card"><div class="row"><p class="title">Занятия сегодня</p><a class="link" href="#schedule">Неделя ${icon('arrow')}</a></div>
        ${today.length ? `<div class="mini-lessons">${today.map((l) => miniLesson(l, t)).join('')}</div>` : '<p class="muted small">Сегодня занятий нет. Хорошее время проверить работы.</p>'}</section></div>
    <section class="stats" aria-label="Коротко">
      <a class="stat" href="#schedule"><span class="num" data-count="${lessonsN}">${lessonsN}</span><span class="l">${plural(lessonsN, ['занятие', 'занятия', 'занятий'])} сегодня</span></a>
      <a class="stat" href="#tasks"><span class="num" data-count="${review.reduce((a, x) => a + x.submitted - x.graded, 0)}">${review.reduce((a, x) => a + x.submitted - x.graded, 0)}</span><span class="l">работ ждут проверки</span></a>
      <a class="stat" href="#journal"><span class="num">${avgAttendance()}<small>%</small></span><span class="l">средняя посещаемость</span></a>
      <a class="stat" href="#journal"><span class="num" data-count="${risk.length}">${risk.length}</span><span class="l">${plural(risk.length, ['студент', 'студента', 'студентов'])} в зоне риска</span></a></section>
    <div class="cols"><section class="sec">${secHead('Нужно проверить', go('tasks', 'Все задания'))}${review.length ? `<div class="hw-list">${review.slice(0, 4).map(taskCard).join('')}</div>` : empty('check', 'Всё проверено', 'Новых сданных работ нет.')}</section>
      <section class="sec">${secHead('Зона риска', go('journal', 'Журнал'))}${risk.length ? `<div class="card flush"><div class="risk">${risk.slice(0, 6).map(({j, s, why}) => `<button class="risk-row" data-stud="${esc(j.group)}|${esc(s.id)}"><span class="face mono sm f${s.id.length % 5}" aria-hidden="true">${esc(s.initials)}</span><span><strong>${esc(s.name)}</strong><span>${esc(j.group)} · ${why.map(esc).join(' · ')}</span></span>${icon('chevron')}</button>`).join('')}</div></div>` : empty('check', 'Рисков нет', 'Все студенты набирают баллы и ходят на занятия.')}
        <p class="cap">Зона риска: меньше 60 баллов текущего контроля или посещаемость ниже 75%.</p></section></div>
    ${consultSection()}
    ${groupsSection()}</div>`;
}
function consultSection() {
  const days = S.data.consults || [];
  if (!days.length) return '';
  return `<section class="sec">${secHead('Консультации', `<span class="small muted">${esc(S.data.profile.hours)}</span>`)}<div class="cs-grid">${days.map((d) => {
    const booked = d.slots.filter((s) => s.name);
    return `<article class="card"><div class="stack"><div class="row"><p class="title">${esc(cap(dayLong(d.date)))}</p><span class="tag">${count(booked.length, ['запись', 'записи', 'записей'])} из ${d.slots.length}</span></div>
      <ul class="cs-list">${d.slots.map((s) => `<li class="${s.name ? '' : 'free'}"><b>${s.time}</b>${s.name ? `<span><strong>${esc(s.name)}</strong><span>${esc(s.group)} · ${esc(s.topic)}</span></span>${s.login ? '<span class="tag sky">из кабинета</span>' : ''}` : '<span class="muted">свободно</span>'}</li>`).join('')}</ul></div></article>`;
  }).join('')}</div><p class="cap">Студенты записываются сами из карточки преподавателя; запись на 15 минут.</p></section>`;
}
function groupsSection() {
  return `<section class="sec">${secHead('Мои группы')}<div class="groups">${S.data.offerings.map((o) => {
    const j = S.data.journals[o.id], st = j.students;
    const att = st.filter((x) => x.att !== null), avgAtt = att.length ? Math.round(att.reduce((a, x) => a + x.att, 0) / att.length) : 0;
    const avgPts = Math.round(st.reduce((a, x) => a + x.points, 0) / st.length), admitted = st.filter((x) => x.points >= 60).length;
    const tasks = S.data.tasks.filter((x) => x.course === o.course && x.group === o.group && !x.past).length;
    return `<article class="card gcard"><div class="row"><div><p class="eyebrow">${esc(o.title)} · ${esc(o.assessment.toLowerCase())} ${dayShort(o.control)}</p><p class="title">${esc(o.group)}</p></div><span class="tag">${count(st.length, ['студент', 'студента', 'студентов'])}</span></div>
      <div class="gstats"><div><b>${avgAtt}%</b><span>посещаемость</span></div><div><b>${avgPts}</b><span>средний балл</span></div><div><b>${admitted}/${st.length}</b><span>с допуском</span></div><div><b>${tasks}</b><span>активных заданий</span></div></div>
      <div class="faces" aria-hidden="true">${st.slice(0, 8).map((x) => `<span class="face mono xs f${x.id.charCodeAt(x.id.length - 1) % 5}">${esc(x.initials)}</span>`).join('')}${st.length > 8 ? `<span class="more-n">+${st.length - 8}</span>` : ''}</div>
      <div class="chips"><button class="btn sm" data-off="${esc(o.id)}" data-goto="journal">${icon('study')}Журнал</button><button class="btn ghost sm" data-newtask="${esc(o.id)}">${icon('tasks')}Задание группе</button></div></article>`;
  }).join('')}</div></section>`;
}

/* ---------- Посещаемость ---------- */
export function attSheet(lessonId) {
  const l = lessonById(lessonId);
  if (!l) return '';
  const blocks = l.groups.map((g) => {
    const j = journalOf(l.course, g), i = j ? j.lessons.findIndex((x) => x.id === l.id) : -1;
    if (i < 0) return `<p class="muted">${esc(g)}: отметить посещаемость можно в день занятия.</p>`;
    const present = j.students.filter((s) => 'pl'.includes(s.marks[i])).length, marked = j.students.filter((s) => s.marks[i] !== '-').length;
    return `<section class="att-group"><div class="row"><p class="title">${esc(g)}</p><span class="small muted">присутствуют ${present} из ${j.students.length}${marked < j.students.length ? ` · не отмечено ${j.students.length - marked}` : ''}</span></div>
      <button class="btn ghost sm" data-attall="${esc(l.id)}|${esc(g)}|${esc(l.course)}">${icon('check')}Отметить всех неотмеченных: был</button>
      <ul class="att-list">${j.students.map((s) => `<li><span class="face mono sm f${s.id.charCodeAt(s.id.length - 1) % 5}" aria-hidden="true">${esc(s.initials)}</span><span class="att-name"><strong>${esc(s.name)}</strong><span>${s.att === null ? 'нет отметок' : `посещаемость ${s.att}%`}</span></span>
        <span class="att-seg" role="group" aria-label="${esc(s.name)}">${['p', 'l', 'a', 'e'].map((m) => `<button class="m-${m}" data-mark="${esc(l.id)}|${esc(g)}|${esc(l.course)}|${esc(s.id)}|${s.marks[i] === m ? '-' : m}" aria-pressed="${s.marks[i] === m}">${MARK[m] === 'Уважительная' ? 'Уваж.' : MARK[m]}</button>`).join('')}</span></li>`).join('')}</ul></section>`;
  }).join('');
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">${esc(cap(dayLong(l.date)))} · ${l.start}–${l.end} · ${esc(l.type)}</p><h2 id="sheet-title" class="title">Посещаемость: ${esc(l.title)}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <p class="small muted">Отметка сохраняется сразу. Повторное нажатие снимает её. Студент видит посещаемость в своём кабинете.</p>${blocks}</div>`;
}

/* ---------- Расписание ---------- */
export function viewSchedule() {
  const t = todayIso(), week = S.data.schedule.slice(S.week * 7, S.week * 7 + 7);
  if (!S.day || !week.some((d) => d.date === S.day)) S.day = (week.find((d) => d.date === t) || week[0]).date;
  const range = (w) => `${dayShort(w[0].date)} – ${dayShort(w[5].date)}`;
  const w0 = S.data.schedule.slice(0, 7), w1 = S.data.schedule.slice(7, 14);
  const total = week.reduce((a, d) => a + d.lessons.filter((l) => !l.cancelled).length, 0);
  const seg = `<div class="seg" role="group" aria-label="Неделя"><button data-week="0" aria-pressed="${S.week === 0}">Эта неделя<small>${range(w0)}</small></button><button data-week="1" aria-pressed="${S.week === 1}">Следующая<small>${range(w1)}</small></button></div>`;
  const agenda = week.filter((d) => d.lessons.length).map((d) => `<section class="agenda-day ${d.date === t ? 'is-today' : ''}"><h2 class="hw-h">${cap(dayLong(d.date))}${d.date === t ? '<span>сегодня</span>' : ''}</h2><div class="mini-lessons">${d.lessons.map((l) => miniLesson(l, d.date)).join('')}</div></section>`).join('');
  return `<div class="page">${head(S.data.semester.term, 'Расписание', `${count(total, ['занятие', 'занятия', 'занятий'])} на неделе. Нажмите на занятие: группы, аудитория, задания к паре и отметка посещаемости.`)}
    ${seg}<div class="card wk-card only-desk">${weekGrid(week, t, S.day)}</div>
    <div class="cols tasks-cols"><div class="stack">${agenda || empty('schedule', 'Занятий нет', 'На этой неделе занятий нет.')}</div>
      <div class="stack tasks-side"><section class="card"><div class="stack"><p class="title">Консультации</p><p>${esc(S.data.profile.hours)}</p><p class="cap">Время консультаций видят студенты в карточке преподавателя.</p></div></section>
        <section class="card"><div class="stack"><p class="title">В календарь</p><p class="small">Файл .ics откроется в Яндекс Календаре, Google Календаре и в календаре телефона.</p><button class="btn block" data-calendar="week">${icon('download')}Неделя целиком</button></div></section></div></div></div>`;
}
export function lessonSheet(id) {
  const l = lessonById(id);
  if (!l) return '';
  const t = todayIso(), tasks = S.data.tasks.filter((x) => x.lesson_id === l.id || (x.course === l.course && l.groups.includes(x.group) && x.due_date === l.date));
  const tally = l.date <= t ? lessonTally(l) : null;
  const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">${esc(cap(dayLong(l.date)))} · ${l.start}–${l.end}</p><h2 id="sheet-title" class="title">${esc(l.title)}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <div class="chips"><span class="tag">${esc(l.type)}</span>${groupPills(l.groups)}${l.cancelled ? '<span class="tag papaya">Отменено</span>' : ''}</div>
    ${l.change ? `<div class="l-diff ${l.cancelled ? 'cancel' : ''}"><b>${esc(l.change.label)}.</b> ${l.cancelled ? '' : `Было: ${esc(l.change.was)}. Стало: ${esc(l.change.now)}. `}${esc(l.change.reason)}. Студенты получили уведомление.</div>` : ''}
    <dl class="facts">${row('Время', `${l.start}–${l.end}, ${l.pair} пара`)}${row('Место', where(l))}${row('Группы', `${groupsLine(l)}, ${count(l.students, ['студент', 'студента', 'студентов'])}`)}
      ${row('Посещаемость', tally ? (tally.marked ? `присутствовало ${tally.present} из ${tally.total}` : 'ещё не отмечена') : 'отмечается в день занятия')}</dl>
    ${tasks.length ? `<div class="sheet-hw"><p class="eyebrow">Задания к этому занятию</p>${tasks.map(taskCard).join('')}</div>` : ''}
    <div class="chips">${tally ? `<button class="btn sm" data-att="${esc(l.id)}">${icon('check')}Посещаемость</button>` : ''}<button class="btn ghost sm" data-newtask="${esc(l.course)}:${esc(l.groups[0])}">${icon('tasks')}Задание</button>${l.date >= t ? (l.change ? `<button class="btn ghost sm" data-restore="${esc(l.id)}">${icon('swap')}Вернуть как было</button>` : `<button class="btn ghost sm" data-chg="${esc(l.id)}">${icon('swap')}Изменить занятие</button>`) : ''}${l.building ? `<button class="btn ghost sm" data-goto-room="${esc(l.building)}-${esc(l.room)}">${icon('building')}На схеме</button>` : ''}</div></div>`;
}

/* ---------- Журнал ---------- */
export function viewJournal() {
  const offs = S.data.offerings;
  if (!S.off || !S.data.journals[S.off]) S.off = offs[0]?.id;
  const j = S.data.journals[S.off];
  if (!j) return `<div class="page">${head('Журнал', 'Журнал')}${empty('study', 'Групп нет')}</div>`;
  const t = todayIso(), todayIdx = j.lessons.findIndex((l) => l.date === t);
  const cell = (l, s, i) => {
    const m = s.marks[i];
    return `<td><button class="jm m-${m === '-' ? 'n' : m}" data-mark="${esc(l.id)}|${esc(j.group)}|${esc(j.course)}|${esc(s.id)}|${NEXT_MARK[m]}" aria-label="${esc(s.name)}, ${dayShort(l.date)}: ${MARK[m]}. Нажмите, чтобы изменить">${MARK_SHORT[m]}</button></td>`;
  };
  const colTally = j.lessons.map((l, i) => { const marked = j.students.filter((s) => s.marks[i] !== '-').length; const present = j.students.filter((s) => 'pl'.includes(s.marks[i])).length; return marked ? `${present}` : '—'; });
  return `<div class="page">${head(`${j.title} · ${j.group}`, 'Журнал', 'Посещаемость за последние недели и баллы текущего контроля. Нажмите на клетку, чтобы сменить отметку: был → не был → опоздал → уважительная → пусто.')}
    <div class="chips" role="group" aria-label="Группа">${offs.map((o) => `<button class="chip" data-off="${esc(o.id)}" aria-pressed="${o.id === S.off}">${esc(o.group)} · ${esc(o.title)}</button>`).join('')}</div>
    <section class="card jr-card"><div class="row"><div class="legend jr-legend"><span><i class="jm m-p"></i>был</span><span><i class="jm m-l">О</i>опоздал</span><span><i class="jm m-a">Н</i>не был</span><span><i class="jm m-e">У</i>уважительная</span><span><i class="jm m-n"></i>не отмечен</span></div>
      ${todayIdx >= 0 ? `<button class="btn sm" data-att="${esc(j.lessons[todayIdx].id)}">${icon('check')}Отметить сегодняшнее занятие</button>` : ''}</div>
      <div class="jr-scroll" tabindex="0" aria-label="Журнал, прокрутка вбок"><table class="jr"><thead><tr><th scope="col" class="jr-name">Студент</th>${j.lessons.map((l) => `<th scope="col" class="${l.date === t ? 'is-today' : ''}"><span>${fmt(l.date, {day: 'numeric'})}.${l.date.slice(5, 7)}</span><small>${TYPE_LETTER[l.type] || '·'}</small></th>`).join('')}<th scope="col" class="jr-sum">Посещ.</th><th scope="col" class="jr-sum">Баллы</th></tr></thead>
        <tbody>${j.students.map((s) => `<tr class="${s.login ? 'has-login' : ''}"><th scope="row" class="jr-name"><button class="jr-stud" data-stud="${esc(j.group)}|${esc(s.id)}"><span class="face mono xs f${s.id.charCodeAt(s.id.length - 1) % 5}" aria-hidden="true">${esc(s.initials)}</span>${esc(s.short)}</button></th>${j.lessons.map((l, i) => cell(l, s, i)).join('')}
          <td class="jr-sum ${s.att !== null && s.att < 75 ? 'low' : ''}">${s.att === null ? '—' : `${s.att}%`}</td><td class="jr-sum ${s.points < 60 ? 'low' : ''}">${s.points}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" class="jr-name">Присутствовало</th>${colTally.map((v) => `<td>${v}</td>`).join('')}<td></td><td></td></tr></tfoot></table></div>
      <p class="cap">Буквы под датами: Л — лекция, С — семинар, П — практика. Баллы — текущий контроль из 100, допуск с 60. Строка студента с личным кабинетом выделена.</p></section>
    ${groupsSection()}</div>`;
}
export function studentSheet(key) {
  const [group, sid] = key.split('|');
  const offs = S.data.offerings.filter((o) => o.group === group);
  const s = offs.map((o) => S.data.journals[o.id].students.find((x) => x.id === sid)).find(Boolean);
  if (!s) return '';
  const tasks = S.data.tasks.filter((x) => x.group === group).map((x) => ({x, sub: x.subs.find((y) => y.id === sid)}));
  return `<div class="sheet-in"><div class="sheet-top"><div class="who-line"><span class="face mono sm f${sid.charCodeAt(sid.length - 1) % 5}" aria-hidden="true">${esc(s.initials)}</span><div><p class="eyebrow">${esc(group)}</p><h2 id="sheet-title" class="title">${esc(s.name)}</h2></div></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    ${offs.map((o) => { const x = S.data.journals[o.id].students.find((y) => y.id === sid); return `<dl class="facts"><div><dt>${esc(o.title)}</dt><dd>${x.points} баллов · ${x.points >= 60 ? 'допуск есть' : 'нет допуска'}</dd></div><div><dt>Посещаемость</dt><dd>${x.att === null ? 'нет отметок' : `${x.att}%`} · пропусков ${x.absent}, опозданий ${x.late}${x.excused ? `, по уважительной ${x.excused}` : ''}</dd></div></dl>`; }).join('')}
    <div class="sheet-hw"><p class="eyebrow">Задания</p>${tasks.map(({x, sub}) => `<button class="mini-task" data-review="${esc(x.id)}"><span><strong>${esc(x.title)}</strong><span>${sub?.submitted ? `сдано${sub.at ? ` ${dayShort(sub.at.slice(0, 10))}` : ''}` : x.past ? 'не сдано' : 'ещё не сдано'}</span></span><b>${sub?.points ?? '—'}<small>/${x.points_max}</small></b></button>`).join('')}</div>
    ${s.login ? '<p class="cap">У студента есть личный кабинет: оценки, комментарии и посещаемость он видит сразу.</p>' : '<p class="cap">Демонстрационный студент без личного кабинета.</p>'}</div>`;
}

/* ---------- Задания ---------- */
const noteHtml = (note) => (/^https?:\/\/\S+$/.test(note) ? `<a href="${esc(note)}" target="_blank" rel="noopener noreferrer">${esc(note)}</a>` : `«${esc(note)}»`);
function dueText(x) {
  const d = daysBetween(todayIso(), x.due_date);
  const word = d === 0 ? 'сегодня' : d === 1 ? 'завтра' : d === -1 ? 'вчера' : `${weekdayShort(x.due_date)}, ${dayShort(x.due_date)}`;
  return `${word}, ${x.due_time}`;
}
function taskCard(x) {
  const pct = Math.round(x.submitted / x.total * 100), toReview = x.submitted - x.graded;
  return `<article class="tk ${x.past ? 'is-past' : ''}"><button class="tk-body" data-review="${esc(x.id)}">
    <span class="hw-top"><span class="hw-course">${esc(x.course_title)}</span><span class="gpill">${esc(x.group)}</span><span class="hw-kind">${esc(x.kind)}</span>${x.source === 'teacher' ? '<span class="hw-kind">ваше</span>' : ''}</span>
    <strong>${esc(x.title)}</strong>
    <span class="tk-progress"><span class="bar" data-pct="${pct}"></span><span class="small">Сдали ${x.submitted} из ${x.total} · проверено ${x.graded}</span></span>
    <span class="hw-foot"><span class="due ${x.past ? '' : daysBetween(todayIso(), x.due_date) <= 1 ? 'warn' : ''}">${icon('clock')}${x.past ? 'Срок прошёл' : x.lesson_id ? 'К занятию' : 'Срок'} ${dueText(x)}</span>${toReview > 0 ? `<span class="tag marigold">Проверить: ${toReview}</span>` : x.past && x.graded >= x.submitted ? '<span class="tag mint">Проверено</span>' : ''}</span></button></article>`;
}
export function viewTasks() {
  const all = S.data.tasks, f = S.tfilter || 'review';
  const groups = {review: all.filter((x) => x.submitted > x.graded), active: all.filter((x) => !x.past), past: all.filter((x) => x.past)};
  const list = f === 'all' ? all : groups[f];
  const chip = (id, label, n) => `<button class="chip" data-tf="${id}" aria-pressed="${f === id}">${label} · ${n}</button>`;
  return `<div class="page">${head(S.data.semester.term, 'Задания', 'Задания вашим группам: кто сдал, что проверить, оценки и комментарии. Новое задание сразу появляется у студентов в разделе «Задания».', `<button class="btn" data-newtask>${icon('tasks')}Новое задание</button>`)}
    <div class="chips" role="group" aria-label="Фильтр">${chip('review', 'На проверку', groups.review.length)}${chip('active', 'Идут', groups.active.length)}${chip('past', 'Срок прошёл', groups.past.length)}${chip('all', 'Все', all.length)}</div>
    ${list.length ? `<div class="tk-grid">${list.map(taskCard).join('')}</div>` : empty('check', f === 'review' ? 'Всё проверено' : 'Заданий нет', f === 'review' ? 'Новых сданных работ нет.' : '')}</div>`;
}
export function reviewSheet(id) {
  const x = S.data.tasks.find((y) => y.id === id);
  if (!x) return '';
  const rank = (p) => { const s = x.subs.find((y) => y.id === p.id) || {}; return s.submitted && s.points == null ? 0 : s.points != null ? 1 : 2; };
  const roster = [...(S.data.rosters[x.group] || [])].sort((a, b) => rank(a) - rank(b));
  const rows = roster.map((p) => {
    const sub = x.subs.find((y) => y.id === p.id) || {};
    return `<li class="${sub.submitted ? 'is-sub' : ''}"><span class="face mono sm f${p.id.charCodeAt(p.id.length - 1) % 5}" aria-hidden="true">${esc(p.initials)}</span><span class="att-name"><strong>${esc(p.name)}</strong><span>${sub.submitted ? `сдано${sub.at ? ` ${esc(stamp(sub.at))}` : ''}` : x.past ? 'не сдано' : 'ещё не сдано'}</span>${sub.note ? `<span class="sub-note">${noteHtml(sub.note)}</span>` : ''}</span>
      <form class="grade-form" data-gtask="${esc(x.id)}" data-student="${esc(p.id)}"><input name="points" type="number" inputmode="numeric" min="0" max="${x.points_max}" value="${sub.points ?? ''}" placeholder="—" aria-label="Баллы: ${esc(p.name)}, из ${x.points_max}"><span class="of">/${x.points_max}</span>
        <input name="comment" maxlength="600" value="${esc(sub.comment || '')}" placeholder="Комментарий" aria-label="Комментарий: ${esc(p.name)}"><button class="btn sm" aria-label="Сохранить оценку: ${esc(p.name)}">${icon('check')}</button></form></li>`;
  }).join('');
  return `<div class="sheet-in wide"><div class="sheet-top"><div><p class="eyebrow">${esc(x.course_title)} · ${esc(x.group)} · ${esc(x.kind)}</p><h2 id="sheet-title" class="title">${esc(x.title)}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    ${x.text ? `<p>${esc(x.text)}</p>` : ''}
    <div class="chips"><span class="tag">${icon('clock')}${x.lesson_id ? 'К занятию' : 'Срок'} ${dueText(x)}</span><span class="tag">до ${x.points_max} баллов</span><span class="tag mint">сдали ${x.submitted} из ${x.total}</span><span class="tag">проверено ${x.graded}</span></div>
    <p class="cap">Сверху — сдавшие без оценки, затем проверенные, внизу — кто ещё не сдал.</p><ul class="att-list review">${rows}</ul><p class="form-error" role="alert"></p>
    <p class="cap">Оценка сохраняется по кнопке в строке. Пустые баллы и пустой комментарий снимают оценку. Студент сразу видит баллы и комментарий.</p>
    ${x.source === 'teacher' ? `<div><button class="btn ghost sm danger" data-deltask="${esc(x.id)}">${icon('x')}Удалить задание</button></div>` : ''}</div>`;
}
export function taskFormSheet(prefill = '') {
  const offs = S.data.offerings;
  const [pCourse, pGroup] = prefill.includes(':') ? prefill.split(':') : [offs[0]?.course, ''];
  const courses = [...new Map(offs.map((o) => [o.course, o.title])).entries()];
  const groupsOf = (c) => offs.filter((o) => o.course === c).map((o) => o.group);
  const due = new Date(Date.parse(todayIso() + 'T12:00:00Z') + 3 * 864e5).toISOString().slice(0, 10);
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">Задание группам</p><h2 id="sheet-title" class="title">Новое задание</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <form id="task-form"><label for="tf-course">Дисциплина</label><select id="tf-course" name="course">${courses.map(([c, title]) => `<option value="${esc(c)}" ${c === pCourse ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select>
      <fieldset class="checks"><legend>Группы</legend>${groupsOf(pCourse).map((g) => `<label class="check"><input type="checkbox" name="groups" value="${esc(g)}" ${!pGroup || g === pGroup ? 'checked' : ''}><span>${esc(g)}</span></label>`).join('')}</fieldset>
      <label for="tf-title">Название</label><input id="tf-title" name="title" required minlength="3" maxlength="140" placeholder="Например: Типовой расчёт № 4">
      <label for="tf-text">Что сделать <span class="muted">(необязательно)</span></label><textarea id="tf-text" name="text" maxlength="2000" placeholder="Номера задач, требования к оформлению, куда загрузить"></textarea>
      <div class="form-row"><div><label for="tf-kind">Формат сдачи</label><select id="tf-kind" name="kind">${S.data.kinds.map((k) => `<option>${esc(k)}</option>`).join('')}</select></div>
        <div><label for="tf-points">Баллы</label><input id="tf-points" name="points_max" type="number" inputmode="numeric" min="1" max="100" value="10" required></div></div>
      <fieldset class="checks"><legend>Срок</legend><label class="check"><input type="radio" name="due_mode" value="lesson" checked><span>К ближайшему занятию группы</span></label><label class="check"><input type="radio" name="due_mode" value="date"><span>К дате</span></label></fieldset>
      <div class="form-row due-when"><div><label for="tf-date">Дата</label><input id="tf-date" name="due_date" type="date" value="${due}" min="${todayIso()}"></div><div><label for="tf-time">Время</label><input id="tf-time" name="due_time" type="time" value="23:59"></div></div>
      <p class="form-error" role="alert"></p><button class="btn block">Выдать задание</button></form></div>`;
}

/* ---------- Сообщение группе ---------- */
export function announceSheet() {
  const groups = [...new Set(S.data.offerings.map((o) => o.group))];
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">Объявление попадёт в уведомления студентов группы</p><h2 id="sheet-title" class="title">Сообщение группе</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <form id="tannounce-form"><label for="ta-group">Группа</label><select id="ta-group" name="group">${groups.map((g) => `<option>${esc(g)}</option>`).join('')}</select>
      <label for="ta-title">Заголовок</label><input id="ta-title" name="title" required minlength="3" maxlength="120" placeholder="Например: консультация перенесена">
      <label for="ta-body">Текст</label><textarea id="ta-body" name="body" required minlength="3" maxlength="1000" placeholder="Когда, где и что взять с собой"></textarea>
      <p class="form-error" role="alert"></p><button class="btn block">Отправить</button></form>
    ${S.data.announcements.length ? `<div class="sheet-hw"><p class="eyebrow">Отправленные</p>${S.data.announcements.slice(0, 5).map((a) => `<div class="mini-task"><span><strong>${esc(a.title)}</strong><span>${esc(a.audience)} · ${esc(stamp(a.created))}</span></span></div>`).join('')}</div>` : ''}</div>`;
}

/* ---------- Профиль ---------- */
export function viewProfile() {
  const p = S.data.profile;
  return `<div class="page">${head('Профиль', 'Преподаватель')}
    <div class="cols even"><section class="card tprofile">${face(p, 'lg')}<div class="stack"><h2>${esc(p.full_name)}</h2><p class="muted">${esc(cap(p.title))}<br>${esc(p.dept)}</p>
        <div class="chips">${S.data.offerings.map((o) => `<span class="tag">${esc(o.title)} · ${esc(o.group)}</span>`).join('')}</div></div></section>
      <section class="card profile"><div class="stack"><p class="title">Контакты и приём</p><dl><div><dt>Консультации</dt><dd>${esc(p.hours)}</dd></div><div><dt>Почта</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd></div><div><dt>Логин</dt><dd>${esc(p.login)}</dd></div></dl>
        <p class="cap">Учётная запись демонстрационная, сведения вымышлены.</p><button class="btn ghost" data-logout>${icon('logout')}Выйти из кабинета</button></div></section></div></div>`;
}

/* ---------- Изменение занятия ---------- */
export function changeSheet(id) {
  const l = lessonById(id);
  if (!l) return '';
  const sameDay = (day(l.date)?.lessons || []).filter((x) => x.id !== l.id && !x.cancelled).map((x) => x.pair);
  const checkFree = l.date === S.data.campus.rooms_date;
  const rooms = S.data.campus.rooms.filter((r) => r.seats >= Math.min(l.students, 60) && !(r.building === l.building && r.room === l.room))
    .map((r) => ({r, free: checkFree ? roomState(r.key, l.pair).cls === 'free' : null}))
    .sort((a, b) => (b.free === true) - (a.free === true) || a.r.key.localeCompare(b.r.key));
  const roomOpt = ({r, free}) => `<option value="${esc(r.building)}|${esc(r.room)}">${esc(r.building)}-${esc(r.room)} · ${esc(r.kind.toLowerCase())}, ${r.seats} мест${free === true ? ' · свободна' : free === false ? ' · занята' : ''}</option>`;
  const pairs = S.data.campus.bells.filter((b) => b.pair !== l.pair).map((b) => `<option value="${b.pair}" ${sameDay.includes(b.pair) ? 'disabled' : ''}>${b.pair} пара, ${b.start}–${b.end}${sameDay.includes(b.pair) ? ' · у вас занятие' : ''}</option>`).join('');
  const cur = l.building ? roomByKey(`${l.building}-${l.room}`) : null;
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">${esc(cap(dayLong(l.date)))} · ${l.start}–${l.end} · ${groupsLine(l)}</p><h2 id="sheet-title" class="title">Изменить занятие</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <p class="small">${esc(l.title)}, ${esc(l.type.toLowerCase())}. Сейчас: ${where(l)}${cur ? `, ${cur.seats} мест` : ''}. Изменение сразу появится в расписании ${l.groups.length > 1 ? 'групп' : 'группы'} ${groupsLine(l)}, студенты получат уведомление.</p>
    <form id="lesson-form" data-lid="${esc(l.id)}">
      <fieldset class="checks"><legend>Что меняется</legend><label class="check"><input type="radio" name="kind" value="room" checked><span>Аудитория</span></label><label class="check"><input type="radio" name="kind" value="time"><span>Время</span></label><label class="check"><input type="radio" name="kind" value="cancel"><span>Отменить занятие</span></label></fieldset>
      <div class="when-room"><label for="lf-room">Новая аудитория${checkFree ? ` <span class="muted">(свободные на ${l.pair} паре — сверху)</span>` : ''}</label><select id="lf-room" name="room">${rooms.map(roomOpt).join('')}</select></div>
      <div class="when-time"><label for="lf-pair">Новое время</label><select id="lf-pair" name="pair">${pairs}</select></div>
      <label for="lf-reason">Причина <span class="muted">(видна студентам)</span></label><input id="lf-reason" name="reason" required minlength="3" maxlength="200" placeholder="Например: нужен компьютерный класс">
      <p class="form-error" role="alert"></p><button class="btn block">Сохранить и уведомить студентов</button></form></div>`;
}

/* ---------- Поиск ---------- */
export function searchSheet() {
  return `<div class="sheet-in"><div class="sheet-top"><h2 id="sheet-title" class="title">Поиск</h2><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <div class="search-box">${icon('search')}<input id="search-q" type="search" placeholder="Студент, задание, группа, аудитория" autocomplete="off" aria-label="Поиск по кабинету" enterkeyhint="search"></div>
    <div id="search-results" class="results">${searchResults('')}</div></div>`;
}
export function searchResults(query) {
  const q = query.trim().toLowerCase(), t = todayIso();
  const res = (attrs, ico, title, sub) => `<${attrs.startsWith('href') ? 'a' : 'button'} class="res" ${attrs}><span class="ico">${icon(ico)}</span><span><strong>${title}</strong><span>${sub}</span></span></${attrs.startsWith('href') ? 'a' : 'button'}>`;
  if (!q) {
    const next = S.data.schedule.flatMap((d) => d.lessons.map((l) => ({...l, date: d.date}))).find((l) => l.date >= t && !l.cancelled);
    return ['<p class="label">Частые действия</p>', res('data-newtask', 'tasks', 'Выдать задание', 'Одной или нескольким группам'), next ? res(`data-att="${esc(next.id)}"`, 'check', 'Отметить посещаемость', `${esc(cap(relativeDay(next.date, t)))}, ${next.start} · ${groupsLine(next)}`) : '', res('data-tannounce', 'megaphone', 'Сообщение группе', 'Попадёт в уведомления студентов'), res('href="#journal"', 'study', 'Журнал', 'Посещаемость и баллы')].join('');
  }
  const out = [];
  const students = [];
  for (const j of Object.values(S.data.journals)) for (const s of j.students) if (`${s.name} ${s.short} ${j.group}`.toLowerCase().includes(q) && !students.some((x) => x.s.id === s.id)) students.push({s, j});
  const tasks = S.data.tasks.filter((x) => `${x.title} ${x.group} ${x.course_title}`.toLowerCase().includes(q));
  const lessons = S.data.schedule.flatMap((d) => d.lessons.map((l) => ({...l, date: d.date}))).filter((l) => l.date >= t && `${l.title} ${l.place} ${l.groups.join(' ')} ${l.type}`.toLowerCase().includes(q));
  const rooms = S.data.campus.rooms.filter((r) => `${r.building}${r.room} ${r.building}-${r.room} ${r.kind}`.toLowerCase().includes(q)).slice(0, 4);
  if (students.length) out.push('<p class="label">Студенты</p>', ...students.slice(0, 6).map(({s, j}) => res(`data-stud="${esc(j.group)}|${esc(s.id)}"`, 'user', esc(s.name), `${esc(j.group)} · ${s.points} баллов · посещаемость ${s.att === null ? '—' : `${s.att}%`}`)));
  if (tasks.length) out.push('<p class="label">Задания</p>', ...tasks.slice(0, 5).map((x) => res(`data-review="${esc(x.id)}"`, 'tasks', esc(x.title), `${esc(x.group)} · сдали ${x.submitted} из ${x.total} · проверено ${x.graded}`)));
  if (lessons.length) out.push('<p class="label">Занятия</p>', ...lessons.slice(0, 4).map((l) => res(`data-lesson="${esc(l.id)}"`, 'schedule', esc(l.title), `${esc(cap(relativeDay(l.date, t)))}, ${l.start} · ${groupsLine(l)} · ${esc(l.place)}`)));
  if (rooms.length) out.push('<p class="label">Аудитории</p>', ...rooms.map((r) => res(`data-goto-room="${esc(r.key)}"`, 'building', `Корпус ${esc(r.building)}, ауд. ${esc(r.room)}`, `${esc(r.kind)} · ${r.floor} этаж`)));
  return out.length ? out.join('') : empty('search', 'Ничего не найдено', 'Попробуйте фамилию студента, название задания или номер аудитории.');
}
