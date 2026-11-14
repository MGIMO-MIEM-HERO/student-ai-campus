import {S, lessonIndex} from './state.js';
import {icon} from './icons.js';
import {esc, mskNow, toMin, dayLong, dayShort, dayMonth, weekdayShort, stamp, count, duration, daysBetween, relativeDay, untilText, cap, fmt} from './util.js';

export const NAV = [['today', 'Сегодня', 'today'], ['schedule', 'Расписание', 'schedule'], ['study', 'Учёба', 'study'], ['requests', 'Заявки', 'requests'], ['more', 'Ещё', 'more']];
export const ROUTES = ['today', 'schedule', 'study', 'requests', 'more', 'notices', 'rooms', 'assistant', 'profile'];
export const NAV_OF = {notices: 'more', rooms: 'more', assistant: 'more', profile: 'more'};
export const DOCS = [
  {kind: 'Справка об обучении', ico: 'cap', what: 'Подтверждает, что вы обучаетесь в университете. Требуется для военкомата, визы, банка, места работы.', sla: '1–2 рабочих дня', how: 'Оригинал выдаётся в деканате'},
  {kind: 'Выписка об успеваемости', ico: 'study', what: 'Перечень дисциплин с оценками и баллами за пройденные семестры.', sla: '2–3 рабочих дня', how: 'Оригинал выдаётся в деканате'},
  {kind: 'Обращение в деканат', ico: 'chat', what: 'Вопрос по учёбе: индивидуальный график, пересдача, перевод, академический отпуск.', sla: 'Ответ до 5 рабочих дней', how: 'Ответ приходит в историю заявки'},
];
const STEPS = ['Принята', 'В работе', 'Готова', 'Выдана'];
const STATUS_TONE = {'Принята': 'info', 'В работе': 'warn', 'Готова': 'ok', 'Выдана': 'neutral', 'Отклонена': 'bad'};
const STATUS_HINT = {'Принята': 'Заявка получена деканатом.', 'В работе': 'Документ готовится.', 'Готова': 'Документ можно получить в деканате при предъявлении студенческого билета.', 'Выдана': 'Документ выдан.', 'Отклонена': 'Заявка отклонена. Причина указана в комментарии.'};
const TAG_TONE = {'Расписание': 'warn', 'Деканат': 'info', 'Дедлайн': 'bad', 'Мероприятие': 'ok'};
export const QUESTIONS = ['Какие пары сегодня?', 'Что завтра?', 'Есть ли изменения в расписании?', 'Когда сессия?', 'Как заказать справку?'];

export const nowIso = () => mskNow().date;
const day = (iso) => S.data.schedule.find((d) => d.date === iso);
export const unreadCount = () => S.data.notices.filter((n) => !n.read).length;
export const readyCount = () => S.data.requests.filter((r) => r.status === 'Готова').length;
const room = (building, number) => S.data.campus.rooms.find((r) => r.building === building && r.room === number);
const building = (id) => S.data.campus.buildings.find((b) => b.id === id);
export const statusTag = (s) => `<span class="tag ${STATUS_TONE[s] || 'info'}">${esc(s)}</span>`;
export const empty = (ico, title, text = '') => `<div class="empty">${icon(ico)}<strong>${title}</strong>${text ? `<span>${text}</span>` : ''}</div>`;
export const head = (eyebrow, title, lede = '') => `<header class="page-head"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</header>`;
export const section = (title, extra = '') => `<div class="section-head"><h2>${title}</h2>${extra}</div>`;
const go = (href, text) => `<a class="link" href="#${href}">${text} ${icon('arrow')}</a>`;
export function item({href, data, ico, tone = '', title, sub = ''}) {
  const inner = `<span class="ico ${tone}">${icon(ico)}</span><span><strong>${title}</strong>${sub ? `<span class="sub">${sub}</span>` : ''}</span>${icon('chevron')}`;
  return href ? `<a class="item" href="#${href}">${inner}</a>` : `<button class="item" ${data}>${inner}</button>`;
}

/* ---------- занятия ---------- */
export function lessonRow(l) {
  const tags = [];
  if (l.cancelled) tags.push('<span class="tag bad">Отменено</span>');
  else if (l.change) tags.push(`<span class="tag warn">${esc(l.change.label)}</span>`);
  if (l.subgroup) tags.push(`<span class="tag neutral">${esc(l.subgroup)}</span>`);
  if (l.format === 'Онлайн') tags.push('<span class="tag info">Онлайн</span>');
  if (l.parity) tags.push(`<span class="tag neutral">${l.parity === 'odd' ? 'Нечётные недели' : 'Чётные недели'}</span>`);
  let change = '';
  if (l.cancelled) change = `<span class="l-change cancel">${esc(l.change.reason)}</span>`;
  else if (l.change) change = `<span class="l-change"><b>Было:</b> ${esc(l.change.was)}<br><b>Стало:</b> ${esc(l.change.now)}</span>`;
  const where = l.format === 'Онлайн' ? 'Онлайн, ссылка в LMS' : `${esc(l.place)}${l.floor ? ` · ${l.floor} этаж` : ''}`;
  return `<button class="lesson ${l.cancelled ? 'is-cancelled' : ''}" data-lesson="${esc(l.id)}">
    <span class="l-time"><b>${l.start}</b><span>${l.end}</span><em>${l.pair} пара</em></span>
    <span class="l-main"><span class="l-title">${esc(l.title)}</span><span class="l-meta">${esc(l.type)} · ${esc(l.teacher.short)}</span><span class="l-place">${where}</span>${tags.length ? `<span class="l-tags">${tags.join('')}</span>` : ''}${change}</span>${icon('chevron')}</button>`;
}
export function lessonsList(lessons) {
  const out = [];
  let prev = null;
  for (const l of lessons) {
    if (prev && !l.cancelled && !prev.cancelled) {
      const gap = toMin(l.start) - toMin(prev.end);
      if (gap >= 50) out.push(`<div class="gap">Окно ${duration(gap)}</div>`);
    }
    out.push(lessonRow(l));
    if (!l.cancelled) prev = l;
  }
  return `<div class="lessons">${out.join('')}</div>`;
}

function nextLessonDay(afterIso) {
  return S.data.schedule.find((d) => d.date > afterIso && d.lessons.some((l) => !l.cancelled));
}
function nowCard() {
  const t = mskNow();
  const d = day(t.date);
  const list = (d?.lessons || []).filter((l) => !l.cancelled);
  const cur = list.find((l) => toMin(l.start) <= t.minutes && t.minutes < toMin(l.end));
  const next = list.find((l) => toMin(l.start) > t.minutes);
  const details = (l) => `<div class="meta"><span>${icon('clock')}${l.start}–${l.end}, ${l.pair} пара · ${esc(l.type)}</span><span>${icon('pin')}${l.format === 'Онлайн' ? 'Онлайн, ссылка в LMS' : `${esc(l.place)}${l.floor ? `, ${l.floor} этаж` : ''}`}</span><span>${icon('user')}${esc(l.teacher.name)}</span></div>`;
  if (cur) {
    const total = toMin(cur.end) - toMin(cur.start), left = toMin(cur.end) - t.minutes;
    return `<section class="now" aria-label="Идёт занятие"><div class="row"><span class="tag ok">Идёт сейчас</span><span class="muted">осталось ${duration(left)}</span></div>
      <h2>${esc(cur.title)}</h2>${details(cur)}<div class="bar" data-pct="${Math.round((total - left) / total * 100)}" role="presentation"></div>
      <button class="link" data-lesson="${esc(cur.id)}">Подробности ${icon('chevron')}</button></section>`;
  }
  if (next) {
    const wait = toMin(next.start) - t.minutes;
    return `<section class="now" aria-label="Следующее занятие"><div class="row"><span class="tag info">Следующая пара</span><span class="muted">начнётся через ${duration(wait)}</span></div>
      <h2>${esc(next.title)}</h2>${details(next)}<button class="link" data-lesson="${esc(next.id)}">Подробности ${icon('chevron')}</button></section>`;
  }
  const upcoming = nextLessonDay(t.date);
  const first = upcoming?.lessons.find((l) => !l.cancelled);
  const title = d?.lessons.length ? 'Занятия на сегодня закончились' : 'Сегодня занятий нет';
  return `<section class="now idle" aria-label="Расписание на сегодня"><div class="row"><span class="tag neutral">${d?.lessons.length ? 'День завершён' : 'Свободный день'}</span></div><h2>${title}</h2>
    ${first ? `<div class="meta"><span>${icon('schedule')}Ближайшие занятия: ${esc(relativeDay(upcoming.date, t.date))}, ${first.pair} пара, ${first.start}</span><span>${icon('book')}${esc(first.title)}</span><span>${icon('pin')}${esc(first.place)}</span></div><button class="link" data-lesson="${esc(first.id)}">Подробности ${icon('chevron')}</button>` : '<p class="muted">В ближайшие дни занятий нет.</p>'}</section>`;
}

/* ---------- Сегодня ---------- */
function gradeStats() {
  const g = S.data.grades;
  const avg = g.length ? Math.round(g.reduce((s, x) => s + x.points, 0) / g.length) : 0;
  return {avg, admitted: g.filter((x) => x.result !== 'Нет допуска').length, total: g.length, risk: g.filter((x) => x.result === 'Нет допуска')};
}
export function viewToday() {
  const t = nowIso();
  const d = S.data, s = d.semester, st = gradeStats();
  const todayLessons = day(t)?.lessons || [];
  const changes = [];
  for (const dd of d.schedule) {
    if (dd.date < t) continue;
    for (const l of dd.lessons) {
      if (!l.change) continue;
      const cancel = l.cancelled;
      changes.push(item({data: `data-lesson="${esc(l.id)}"`, ico: cancel ? 'alert' : 'swap', tone: cancel ? 'bad' : 'warn',
        title: `${esc(l.change.label)} · ${esc(l.title)}`,
        sub: `${cap(relativeDay(dd.date, t))}, ${l.pair} пара. ${cancel ? esc(l.change.reason) : `${esc(l.change.was)} → ${esc(l.change.now)}`}`}));
    }
  }
  for (const n of d.notices.filter((x) => !x.read && x.tag !== 'Расписание' && x.tag !== 'Дедлайн')) {
    changes.push(item({href: 'notices', ico: 'megaphone', tone: 'info', title: esc(n.title), sub: `${esc(n.tag)} · ${dayShort(n.date)}`}));
  }
  const todo = [];
  for (const r of d.requests.filter((x) => x.status === 'Готова')) todo.push(item({href: 'requests', ico: 'requests', tone: 'ok', title: `Получить документ: ${esc(r.kind.toLowerCase())}`, sub: 'Деканат, Корпус А, ауд. 112, пн–пт 10:00–17:00. Возьмите студенческий билет.'}));
  for (const n of d.notices.filter((x) => x.tag === 'Дедлайн')) todo.push(item({href: 'notices', ico: 'clock', tone: 'warn', title: esc(n.title), sub: esc(n.body)}));
  for (const g of st.risk) todo.push(item({href: 'study', ico: 'alert', tone: 'bad', title: `Нет допуска: ${esc(g.title)}`, sub: `Не хватает ${60 - g.points} ${60 - g.points === 1 ? 'балла' : 'баллов'} до порога допуска (60).`}));
  const nextControl = d.grades.filter((g) => g.date >= t)[0];
  if (nextControl) todo.push(item({href: 'study', ico: 'study', tone: 'info', title: `Ближайший контроль: ${esc(nextControl.title)}`, sub: `${esc(nextControl.assessment)}, ${dayMonth(nextControl.date)} в ${nextControl.start}, ${esc(nextControl.place)} · ${untilText(nextControl.date, t)}`}));
  for (const r of d.requests.filter((x) => x.status === 'Принята' || x.status === 'В работе')) todo.push(item({href: 'requests', ico: 'requests', tone: '', title: `Заявка в обработке: ${esc(r.kind.toLowerCase())}`, sub: esc(STATUS_HINT[r.status])}));
  const first = d.profile.name.split(' ')[0];
  return `<div class="page">
    ${head(`${cap(dayLong(t))} · неделя ${s.week} из ${s.weeks}, ${s.parity_label}`, `Здравствуйте, ${esc(first)}`, `${esc(d.profile.group_name)} · ${esc(d.profile.program)}`)}
    ${nowCard()}
    <div class="tiles">
      <a class="tile" href="#schedule"><span class="v">${todayLessons.filter((l) => !l.cancelled).length}</span><span class="l">пар сегодня</span></a>
      <a class="tile" href="#study"><span class="v">${st.avg}<small>/100</small></span><span class="l">средний балл</span></a>
      <a class="tile" href="#study"><span class="v">${st.admitted}<small>/${st.total}</small></span><span class="l">допуск к контролю</span></a>
    </div>
    <div class="grid-2">
      <div class="stack">
        <section class="card">${section('Что изменилось', go('notices', 'Все уведомления'))}${changes.length ? `<div class="list">${changes.join('')}</div>` : empty('check', 'Изменений нет', 'Занятия проходят по расписанию.')}</section>
        <section class="card">${section('Расписание на сегодня', go('schedule', 'Вся неделя'))}${todayLessons.length ? lessonsList(todayLessons) : empty('schedule', 'Занятий нет')}</section>
      </div>
      <div class="stack">
        <section class="card">${section('Что нужно сделать')}${todo.length ? `<div class="list">${todo.join('')}</div>` : empty('check', 'Срочных дел нет')}</section>
        <section class="card">${section('Быстрые действия')}<div class="stack">
          <button class="btn block" data-request-kind="Справка об обучении">${icon('requests')}Заказать справку</button>
          <button class="btn ghost block" data-calendar="week">${icon('download')}Расписание в календарь</button>
          <a class="btn ghost block" href="#rooms">${icon('building')}Найти аудиторию</a></div></section>
      </div>
    </div></div>`;
}

/* ---------- Расписание ---------- */
export function viewSchedule() {
  const t = nowIso();
  const week = S.data.schedule.slice(S.week * 7, S.week * 7 + 7);
  if (!week.some((x) => x.date === S.day)) S.day = (week.find((x) => x.date === t) || week[0]).date;
  const current = week.find((x) => x.date === S.day);
  const range = (w) => `${fmt(w[0].date, {day: 'numeric'})}–${dayShort(w[6].date)} · неделя ${w[0].week}`;
  const w0 = S.data.schedule.slice(0, 7), w1 = S.data.schedule.slice(7, 14);
  const lessons = current.lessons;
  const active = lessons.filter((l) => !l.cancelled);
  const summary = lessons.length ? `${count(active.length, ['занятие', 'занятия', 'занятий'])}${active.length ? ` · ${active[0].start}–${active[active.length - 1].end}` : ''}` : 'Занятий нет';
  const upcoming = !lessons.length ? nextLessonDay(current.date) : null;
  const nextFirst = upcoming?.lessons.find((l) => !l.cancelled);
  return `<div class="page">${head('Расписание', 'Расписание занятий', `${S.data.semester.term}. Время московское. Нажмите на занятие, чтобы увидеть преподавателя, этаж и как пройти.`)}
    <div class="seg" role="group" aria-label="Неделя"><button data-week="0" aria-pressed="${S.week === 0}">Эта неделя<br><small>${range(w0)}</small></button><button data-week="1" aria-pressed="${S.week === 1}">Следующая<br><small>${range(w1)}</small></button></div>
    <div class="grid-2"><div class="stack">
      <div class="days" role="group" aria-label="Дни недели">${week.map((x) => {
        const n = x.lessons.filter((l) => !l.cancelled).length;
        const wk = ['воскресенье', 'суббота'].includes(x.weekday);
        return `<button class="day ${x.date === t ? 'today' : ''} ${wk ? 'weekend' : ''}" data-day="${x.date}" aria-pressed="${x.date === S.day}" aria-label="${esc(dayLong(x.date))}, ${count(n, ['занятие', 'занятия', 'занятий'])}${x.lessons.some((l) => l.change) ? ', есть изменения' : ''}"><small>${weekdayShort(x.date)}</small><strong>${fmt(x.date, {day: 'numeric'})}</strong><i>${'<b></b>'.repeat(Math.min(n, 4))}</i>${x.lessons.some((l) => l.change) ? '<span class="chg"></span>' : ''}</button>`;
      }).join('')}</div>
      <section class="card">${section(cap(dayLong(current.date)), `<span class="muted">неделя ${current.week}, ${current.parity === 'odd' ? 'нечётная' : 'чётная'}</span>`)}
        <p class="hint">${summary}</p>
        ${lessons.length ? lessonsList(lessons) : empty('schedule', 'Занятий нет', nextFirst ? `Ближайшие занятия: ${esc(relativeDay(upcoming.date, t))}, ${nextFirst.pair} пара, ${nextFirst.start} — ${esc(nextFirst.title)}.` : '')}
      </section></div>
      <div class="stack">
        <section class="card">${section('Календарь')}<p class="hint">Файл .ics открывается в Яндекс Календаре, Google Календаре и на телефоне.</p><div class="stack">
          <button class="btn ghost block" data-calendar="day">${icon('download')}Выбранный день</button>
          <button class="btn ghost block" data-calendar="week">${icon('download')}Неделя целиком</button></div></section>
        <section class="card">${section('Звонки')}<table class="bells"><tbody>${S.data.campus.bells.map((b) => `<tr><th scope="row">${b.pair} пара</th><td>${b.start}–${b.end}</td></tr>`).join('')}</tbody></table><p class="hint">Перерыв на обед между 2 и 3 парой — 30 минут.</p></section>
        <section class="card"><div class="legend"><p class="label">Обозначения</p><span><span class="tag warn">Изменение</span> замена аудитории, времени или преподавателя</span><span><span class="tag bad">Отменено</span> занятие не состоится</span><span><span class="tag neutral">Нечётные недели</span> занятие проходит через неделю</span><span><span class="tag neutral">Подгруппа</span> занятие только для вашей подгруппы</span></div></section>
      </div></div></div>`;
}

export function lessonSheet(id) {
  const found = lessonIndex.get(id);
  if (!found) return '';
  const {lesson: l, day: d} = found;
  const r = l.building ? room(l.building, l.room) : null, b = l.building ? building(l.building) : null;
  const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
  const tags = [l.cancelled ? '<span class="tag bad">Отменено</span>' : '', l.change && !l.cancelled ? `<span class="tag warn">${esc(l.change.label)}</span>` : '', l.subgroup ? `<span class="tag neutral">${esc(l.subgroup)}</span>` : '', l.format === 'Онлайн' ? '<span class="tag info">Онлайн</span>' : ''].join('');
  const change = l.change ? `<div class="l-change ${l.cancelled ? 'cancel' : ''}"><b>${esc(l.change.label)}.</b> ${l.cancelled ? '' : `Было: ${esc(l.change.was)}. Стало: ${esc(l.change.now)}. `}${esc(l.change.reason)}. Опубликовано ${esc(stamp(l.change.at))}.</div>` : '';
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">${esc(cap(dayLong(d.date)))}</p><h2 id="sheet-title">${esc(l.title)}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    ${tags ? `<div class="l-tags">${tags}</div>` : ''}${change}
    <dl class="facts">
      ${row('Время', `${l.start}–${l.end}, ${l.pair} пара`)}${row('Вид занятия', esc(l.type))}
      ${row('Место', l.format === 'Онлайн' ? 'Онлайн. Ссылка для подключения размещена в LMS на странице дисциплины.' : `${esc(l.place)}${l.floor ? `, ${l.floor} этаж` : ''}${r ? `<br><span class="muted">${esc(r.kind)}. ${esc(r.hint)}.</span>` : ''}`)}
      ${row('Корпус', b ? `${esc(b.name)}, открыт ${esc(b.hours)}<br><span class="muted">${esc(b.hint)}</span>` : '')}
      ${row('Преподаватель', `${esc(l.teacher.name)}<br><span class="muted">${esc(l.teacher.title)}</span>`)}${row('Кафедра', esc(l.teacher.dept))}${row('Консультации', esc(l.teacher.hours))}
      ${row('Подгруппа', esc(l.subgroup || ''))}${row('Неделя', `${d.week}-я, ${d.parity === 'odd' ? 'нечётная' : 'чётная'}${l.parity ? `. Занятие проходит только по ${l.parity === 'odd' ? 'нечётным' : 'чётным'} неделям` : ''}`)}
    </dl>${l.cancelled ? '' : `<button class="btn ghost" data-ics-lesson="${esc(l.id)}">${icon('download')}Добавить в календарь</button>`}</div>`;
}

/* ---------- Учёба ---------- */
export function viewStudy() {
  const t = nowIso(), d = S.data, st = gradeStats();
  const upcoming = d.grades.filter((g) => g.date >= t);
  const next = upcoming[0];
  const risk = st.risk.map((g) => `<div class="notice-box"><strong>Нет допуска: ${esc(g.title)}</strong><span>Не хватает ${60 - g.points} ${60 - g.points === 1 ? 'балла' : 'баллов'} до порога допуска. Контроль — ${dayMonth(g.date)}. Преподаватель: ${esc(g.teacher.name)}. Консультации: ${esc(g.teacher.hours)}.</span></div>`).join('');
  return `<div class="page">${head('Учёба', 'Успеваемость', `${d.semester.term}. Баллы текущего контроля и график сессии.`)}
    <div class="tiles">
      <div class="tile"><span class="v">${st.avg}<small>/100</small></span><span class="l">средний балл без учёта весов</span></div>
      <div class="tile"><span class="v">${st.admitted}<small>/${st.total}</small></span><span class="l">дисциплин с допуском</span></div>
      <div class="tile"><span class="v">${next ? daysBetween(t, next.date) : '—'}<small>${next ? ' дн.' : ''}</small></span><span class="l">до ближайшего контроля</span></div></div>
    ${risk}
    <div class="grid-2"><section class="card">${section('Баллы по дисциплинам')}
      ${d.grades.map((g) => {
        const margin = g.points - 60;
        return `<article class="course"><div class="course-head"><div><h3>${esc(g.title)}</h3><span class="muted">${esc(g.teacher.short)} · ${esc(g.assessment)}</span></div><div class="points">${g.points}<small> / 100</small></div></div>
          <div class="bar mark" data-pct="${g.points}" role="img" aria-label="${g.points} баллов из 100, порог допуска 60"></div>
          <div class="course-meta"><span class="tag ${g.result === 'Нет допуска' ? 'bad' : 'ok'}">${esc(g.result)}</span><span>${margin >= 0 ? `запас до порога допуска: ${margin}` : `до порога допуска не хватает ${-margin}`}</span></div></article>`;
      }).join('')}<p class="hint">Красная отметка на шкале — порог допуска, 60 баллов. Данные демонстрационные.</p></section>
    <section class="card">${section('График сессии')}<div class="timeline">${d.grades.map((g) => {
        const past = g.date < t;
        return `<div class="tl ${past ? 'past' : ''}"><div class="tl-date"><b>${fmt(g.date, {day: 'numeric'})}</b><span>${fmt(g.date, {month: 'short'}).replace('.', '')}</span></div>
          <div><h3>${esc(g.title)}</h3><p>${esc(g.assessment)} · ${g.start} · ${esc(g.place)}<br>${esc(g.examiner)} · ${untilText(g.date, t)}${g.consultation ? `<br>Консультация: ${dayShort(g.consultation.date)}, ${g.consultation.start}, ${esc(g.consultation.place)}` : ''}</p></div></div>`;
      }).join('')}</div></section></div></div>`;
}

/* ---------- Заявки ---------- */
export function viewRequests() {
  const rows = S.data.requests;
  const dean = room('А', '112');
  return `<div class="page">${head('Деканат', 'Заявки и справки', 'Закажите документ или направьте обращение. Статус и комментарии деканата отображаются в истории заявки.')}
    <section aria-label="Каталог документов"><div class="catalog">${DOCS.map((x) => `<article class="card doc"><span class="ico item-ico">${icon(x.ico)}</span><h3>${x.kind}</h3><p class="hint">${x.what}</p>
      <dl><div><dt>Срок: </dt><dd>${x.sla}</dd></div><div><dt>Получение: </dt><dd>${x.how}</dd></div></dl>
      <button class="btn" data-request-kind="${x.kind}">Оформить заявку</button></article>`).join('')}</div></section>
    ${dean ? `<section class="card tint-periwinkle"><p class="label">Где находится деканат</p><p><strong>Корпус А, ауд. ${dean.room}, ${dean.floor} этаж.</strong> ${esc(dean.hint)}.</p></section>` : ''}
    <section class="card">${section('История заявок')}${rows.length ? `<ul class="history">${rows.map((r) => {
      const last = r.events[r.events.length - 1];
      const idx = STEPS.indexOf(r.status);
      return `<li><div class="row"><div><h3>${esc(r.kind)}</h3><span class="hint">№ ${esc(r.id.slice(0, 6).toUpperCase())} · от ${dayShort(r.created)}</span></div>${statusTag(r.status)}</div>
        ${r.note ? `<p class="hint">Ваш комментарий: ${esc(r.note)}</p>` : ''}<p>${esc(STATUS_HINT[r.status] || '')}</p>
        ${last && last.comment ? `<div class="staff-note"><strong>${esc(last.author)}:</strong> ${esc(last.comment)}</div>` : ''}
        ${r.status === 'Отклонена' ? '' : `<div class="steps" aria-label="Этапы заявки">${STEPS.map((s, i) => `<span class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${s}</span>`).join('')}</div>`}
        <details class="hist"><summary>История изменений · ${r.events.length}</summary><ol>${r.events.map((e) => `<li><strong>${esc(e.status)}</strong><p>${esc(stamp(e.at))} · ${esc(e.author)}</p>${e.comment ? `<p>${esc(e.comment)}</p>` : ''}</li>`).join('')}</ol></details></li>`;
    }).join('')}</ul>` : empty('requests', 'Заявок пока нет', 'После отправки заявка появится здесь вместе со статусом.')}</section></div>`;
}
export function requestSheet(kind) {
  const doc = DOCS.find((x) => x.kind === kind) || DOCS[0];
  return `<div class="sheet-in"><div class="sheet-top"><div><p class="eyebrow">Новая заявка</p><h2 id="sheet-title">${doc.kind}</h2></div><button class="sheet-close" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <p class="hint">${doc.what} Срок: ${doc.sla}. ${doc.how}.</p>
    <form id="request-form"><label for="kind">Тип заявки</label><select id="kind" name="kind">${DOCS.map((x) => `<option ${x.kind === doc.kind ? 'selected' : ''}>${x.kind}</option>`).join('')}</select>
    <label for="note">Комментарий <span class="muted">(необязательно)</span></label><textarea id="note" name="note" maxlength="1000" placeholder="Например: требуется для оформления визы, нужен оригинал"></textarea>
    <p class="form-error" role="alert"></p><button class="btn block">Отправить заявку</button></form></div>`;
}

/* ---------- Ещё ---------- */
export function viewMore() {
  const u = unreadCount();
  return `<div class="page">${head('Ещё', 'Дополнительно')}
    <section class="card"><div class="list">
      ${item({href: 'notices', ico: 'bell', title: 'Уведомления', sub: u ? `Непрочитанных: ${u}` : 'Все прочитаны'})}
      ${item({href: 'rooms', ico: 'building', title: 'Корпуса и аудитории', sub: 'Где находится аудитория, как пройти'})}
      ${item({href: 'assistant', ico: 'chat', title: 'Помощник', sub: 'Ответы по расписанию, срокам и справкам'})}
      ${item({href: 'profile', ico: 'user', title: 'Профиль', sub: 'Сведения об обучении'})}</div></section>
    <section class="card">${section('Оформление')}<div class="seg" role="group" aria-label="Тема оформления">${[['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([id, name]) => `<button data-theme="${id}" aria-pressed="${S.theme === id}">${name}</button>`).join('')}</div></section>
    <section class="card flat"><p class="label">О сервисе</p><p class="hint">Концепт цифрового деканата, подготовленный для конкурса MGIMO×AI Challenge. Не является официальным сервисом университета. Все данные вымышлены.</p></section>
    <button class="btn ghost" data-logout>${icon('logout')}Выйти из кабинета</button></div>`;
}

export function viewNotices() {
  const list = S.noticeFilter === 'unread' ? S.data.notices.filter((n) => !n.read) : S.data.notices;
  const u = unreadCount();
  return `<div class="page">${head('Уведомления', 'Объявления и изменения', 'Объявления деканата, изменения расписания и сроки.')}
    <div class="chips"><button class="chip" data-nfilter="all" aria-pressed="${S.noticeFilter === 'all'}">Все · ${S.data.notices.length}</button><button class="chip" data-nfilter="unread" aria-pressed="${S.noticeFilter === 'unread'}">Непрочитанные · ${u}</button>${u ? `<button class="link" data-read-all>Отметить все прочитанными</button>` : ''}</div>
    <section class="card">${list.length ? `<div class="list">${list.map((n) => `<article class="item"><span class="ico ${TAG_TONE[n.tag] || ''}">${icon(n.tag === 'Расписание' ? 'swap' : n.tag === 'Дедлайн' ? 'clock' : 'megaphone')}</span>
      <span><span class="row"><span class="tag ${TAG_TONE[n.tag] || 'info'}">${esc(n.tag)}</span>${n.read ? '' : '<span class="dot" role="img" aria-label="Не прочитано"></span>'}<span class="hint">${dayShort(n.date)}</span></span><strong>${esc(n.title)}</strong><span class="sub">${esc(n.body)}</span>${n.read ? '' : `<button class="link" data-read="${esc(n.id)}">Отметить прочитанным</button>`}</span><span></span></article>`).join('')}</div>` : empty('bell', 'Нет уведомлений', 'Непрочитанных сообщений нет.')}</section></div>`;
}

export function viewRooms() {
  const t = nowIso(), q = S.roomQuery.trim().toLowerCase();
  const nextIn = (b, n) => {
    for (const dd of S.data.schedule) {
      if (dd.date < t) continue;
      const l = dd.lessons.find((x) => x.building === b && x.room === n && !x.cancelled);
      if (l) return `${cap(relativeDay(dd.date, t))}, ${l.start} — ${l.title}`;
    }
    return '';
  };
  const mine = new Set(S.data.schedule.flatMap((dd) => dd.lessons.map((l) => `${l.building}${l.room}`)));
  const rooms = S.data.campus.rooms.filter((r) => !q || `${r.room} ${r.kind} ${r.place} ${r.building}`.toLowerCase().includes(q));
  return `<div class="page">${head('Корпуса и аудитории', 'Где находится аудитория', S.data.campus.note)}
    <div class="grid-2 even">${S.data.campus.buildings.map((b) => `<section class="card bld"><h3>${esc(b.name)}</h3><p class="hint">Этажей: ${b.floors} · открыт ${esc(b.hours)}</p><p>${esc(b.hint)}</p></section>`).join('')}</div>
    <section class="card"><label for="room-q">Поиск аудитории</label><input id="room-q" type="search" placeholder="Номер, например 512, или название" value="${esc(S.roomQuery)}" autocomplete="off" enterkeyhint="search">
      <div id="rooms-list">${roomsList(rooms, mine, nextIn)}</div></section></div>`;
}
export function roomsList(rooms, mine, nextIn) {
  if (!rooms.length) return empty('search', 'Ничего не найдено', 'Проверьте номер аудитории или название.');
  return `<div class="rooms-grid">${rooms.map((r) => {
    const next = nextIn(r.building, r.room);
    return `<div class="room ${mine.has(`${r.building}${r.room}`) ? 'mine' : ''}"><div class="room-no"><span><small>${r.building}</small>${esc(r.room)}</span></div><div class="room-info"><strong>${esc(r.kind)}</strong><span class="hint">${r.floor ? `${r.floor} этаж · ` : ''}${r.seats ? `${r.seats} мест · ` : ''}Корпус ${r.building}</span><span>${esc(r.hint)}</span>${next ? `<span class="tag ok">${esc(next)}</span>` : ''}</div></div>`;
  }).join('')}</div>`;
}
export function roomsFiltered() {
  const q = S.roomQuery.trim().toLowerCase();
  const t = nowIso();
  const nextIn = (b, n) => {
    for (const dd of S.data.schedule) {
      if (dd.date < t) continue;
      const l = dd.lessons.find((x) => x.building === b && x.room === n && !x.cancelled);
      if (l) return `${cap(relativeDay(dd.date, t))}, ${l.start} — ${l.title}`;
    }
    return '';
  };
  const mine = new Set(S.data.schedule.flatMap((dd) => dd.lessons.map((l) => `${l.building}${l.room}`)));
  return roomsList(S.data.campus.rooms.filter((r) => !q || `${r.room} ${r.kind} ${r.place} ${r.building}`.toLowerCase().includes(q)), mine, nextIn);
}

export function viewAssistant() {
  return `<div class="page">${head('Помощник', 'Справочный помощник', 'Отвечает по вашему расписанию, срокам контроля и порядку оформления документов.')}
    <section class="card"><div class="section-head"><h2>Беседа</h2><span class="tag info">${S.data.ai_live ? 'ИИ подключён' : 'Справочный режим'}</span></div>
    <div class="messages" role="log" aria-label="Сообщения помощника" aria-live="polite" aria-busy="${S.busy}">${S.messages.length ? S.messages.map((m) => `<div class="msg ${m.from === 'user' ? 'me' : ''}"><small>${m.from === 'user' ? 'Вы' : 'Помощник'}</small>${esc(m.text)}</div>`).join('') : empty('chat', 'Задайте вопрос', 'Например: «Что завтра?» или «Есть ли изменения в расписании?»')}</div>
    <div class="chips">${QUESTIONS.map((q, i) => `<button class="chip" data-question="${i}" ${S.busy ? 'disabled' : ''}>${q}</button>`).join('')}</div>
    <form id="assistant-form"><label for="question">Ваш вопрос</label><div class="ask"><input id="question" name="question" maxlength="500" required placeholder="Введите вопрос" ${S.busy ? 'disabled' : ''} autocomplete="off"><button class="btn" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Отвечаю…' : 'Отправить'}</button></div></form></section></div>`;
}

export function viewProfile() {
  const p = S.data.profile;
  const rows = [['Факультет', p.faculty], ['Направление', p.program], ['Уровень образования', p.level], ['Форма обучения', p.form], ['Курс', p.year], ['Группа', p.group_name], ['Подгруппа', p.subgroup], ['Номер зачётной книжки', p.record_book], ['Куратор группы', p.curator]];
  return `<div class="page">${head('Профиль', 'Сведения об обучении')}<section class="card profile"><div class="row"><span class="avatar lg" aria-hidden="true">${esc(p.name[0])}</span><div><h2>${esc(p.name)}</h2><span class="hint">Логин: ${esc(p.login)}</span></div></div>
    <dl>${rows.filter((r) => r[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <p class="hint">Учётная запись демонстрационная. Все сведения вымышлены.</p></section>
    <button class="btn ghost" data-logout>${icon('logout')}Выйти из кабинета</button></div>`;
}
