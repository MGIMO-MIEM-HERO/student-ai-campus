import {S, indexLessons, lessonIndex} from './state.js';
import {api} from './api.js';
import {icon} from './icons.js';
import {esc, buildIcs, downloadIcs, dayMonth} from './util.js';
import {activePair, roomByKey} from './campus.js';
import * as stu from './student.js';
import * as stf from './staff.js';
import * as tch from './teacher.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const sheet = document.querySelector('#sheet');
const sheetBody = document.querySelector('#sheet-body');
const DEMO_PASSWORD = 'Campus-demo-2026';
let toastTimer, lastFocus, lastKey = '', drag = null, suppressClick = false;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isStaff = () => S.data?.role === 'staff';
const isTeacher = () => S.data?.role === 'teacher';
const roleModule = () => (isStaff() ? stf : isTeacher() ? tch : stu);
const routes = () => roleModule().ROUTES;
const ROLE_LABEL = {staff: 'кабинет деканата', teacher: 'кабинет преподавателя', student: 'кабинет студента'};
const hashParts = () => location.hash.slice(1).split('/');
const route = () => { const k = hashParts()[0]; return routes().includes(k) ? k : routes()[0]; };
function flash(message) {
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 5000);
}
/* Название продукта. Keystone — замковый камень арки: держит всю конструкцию, как кабинет держит учёбу. */
const BRAND = 'Keystone';
const brand = (href) => `<a class="brand" href="${href}"><img src="/mark.svg" alt=""><span class="brand-text"><b>${BRAND}</b><small>${ROLE_LABEL[S.data?.role] || 'личный кабинет'} · концепт</small></span></a>`;
const footer = () => `<footer class="foot"><img class="foot-mark" src="/mark.svg" alt="" width="28" height="28"><p>${BRAND} — концепт-прототип личного кабинета студента и преподавателя для конкурса MGIMO×AI Challenge. Не является официальным сервисом университета, логотип университета не используется. Все люди, данные и новости вымышлены, портреты преподавателей сгенерированы нейросетью. Шрифт Golos Text, лицензия SIL OFL.</p></footer>`;

/* оболочка */
function shell(content, key) {
  const staff = isStaff();
  const mod = roleModule(), nav = mod.NAV;
  const navKey = mod.NAV_OF?.[key] || key;
  const name = S.data.profile.name;
  const badge = (id) => (staff ? (id === 'queue' ? stf.activeCount() : 0) : isTeacher() ? (id === 'tasks' ? tch.reviewCount() : 0) : id === 'requests' ? stu.readyCount() : id === 'tasks' ? stu.activeHomework().filter((h) => h.status === 'overdue').length : 0);
  return `<header class="topbar"><div class="topbar-in">${brand('#' + nav[0][0])}
    <nav class="nav" aria-label="Разделы кабинета"><ul>${nav.map(([id, label, ico]) => {
      const b = badge(id);
      return `<li><a href="#${id}" ${id === navKey ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span>${b ? `<span class="badge" aria-label="${b} новых">${b}</span>` : ''}</a></li>`;
    }).join('')}</ul></nav><span class="grow"></span>
    ${staff || isTeacher() ? '' : `<button class="search-btn" data-search>${icon('search')}Поиск<kbd>/</kbd></button><button class="icon-btn search-icon" data-search aria-label="Поиск">${icon('search')}</button><a class="icon-btn" href="#notices" aria-label="Уведомления${stu.unreadCount() ? `, непрочитанных: ${stu.unreadCount()}` : ''}">${icon('bell')}${stu.unreadCount() ? `<span class="badge">${stu.unreadCount()}</span>` : ''}</a>`}
    <a class="avatar" href="#profile" aria-label="Профиль: ${esc(name)}">${S.data.profile.photo ? `<img src="${esc(S.data.profile.photo)}" alt="" width="38" height="38">` : esc(name[0])}</a></div></header>
  <div class="wrap"><main id="main" tabindex="-1">${content}</main></div>${footer()}`;
}

function loginScreen(error = '', login = '') {
  const demo = [['alina', 'Алина Северова', 'студентка, ПИ-241, 2 курс'], ['mark', 'Марк Луговой', 'студент, МО-251, 1 курс'], ['vetrova', 'Ирина Ветрова', 'преподаватель, высшая математика', '/assets/people/vetrova.webp'], ['dekanat', 'Вера Деканова', 'сотрудник деканата']];
  lastKey = '';
  app.innerHTML = `<div class="login enter"><section class="login-side sky">${brand('/')}
      <div class="login-copy"><h1>Учёба в одном кабинете</h1><p class="lede">Студенту — расписание с заменами, задания со сроками, баллы и справки. Преподавателю — журнал, посещаемость и проверка работ. С телефона и с компьютера.</p></div>
      <div class="hero-ui" aria-hidden="true">
        <div class="ui-card ui-a"><span class="pill dark">Следующая пара · через 25 мин</span><b>Базы данных</b><span>10:40–12:10 · Корпус Б, ауд. 512</span><span class="ui-who"><img src="/assets/people/granov.webp" alt="" width="28" height="28">Гранов М. А. · практика</span></div>
        <div class="ui-card ui-b"><span class="ui-row"><i class="ui-check"></i><span><b>Лабораторная работа 4</b><span>Алгоритмы · до четверга, 23:59</span></span></span><span class="ui-row"><i class="ui-check on">${icon('check')}</i><span><b>Типовой расчёт № 3</b><span>Математический анализ · сделано</span></span></span></div>
        <div class="ui-card ui-c"><span class="ui-label">Замена аудитории</span><span><s>А-305</s> → <b>Б-512</b></span></div>
      </div></section>
    <main class="login-main" id="main" tabindex="-1"><div class="login-card"><h2 class="title">Вход в кабинет</h2>
      <form id="login-form"><label for="login">Логин</label><input id="login" name="login" required autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(login)}">
      <label for="password">Пароль</label><input type="password" id="password" name="password" required autocomplete="current-password">
      <p class="form-error" role="alert">${esc(error)}</p><p class="form-status" role="status" aria-live="polite"></p><button class="btn block">Войти</button></form>
      <p class="eyebrow">Демонстрационные аккаунты</p>
      <div class="demo-grid">${demo.map(([id, name, role, photo]) => `<button class="demo" data-demo="${id}">${photo ? `<img class="avatar" src="${photo}" alt="" width="38" height="38">` : `<span class="avatar" aria-hidden="true">${name[0]}</span>`}<span><strong>${name}</strong><span>${role}</span></span>${icon('arrow')}</button>`).join('')}</div>
      <p class="cap">Пароль демонстрационных аккаунтов: <b>${DEMO_PASSWORD}</b></p></div>
      <p class="disclaimer">${BRAND} — концепт-прототип для конкурса MGIMO×AI Challenge. Не является официальным сервисом университета, логотип университета не используется. Все данные вымышлены.</p></main></div>`;
  decorate(app);
  app.setAttribute('aria-busy', 'false');
}
function errorScreen() {
  app.innerHTML = `<div class="state"><h1>Не удалось загрузить кабинет</h1><p class="lede">Проверьте подключение к интернету и повторите попытку.</p><button class="btn" data-retry>Повторить</button></div>`;
  app.setAttribute('aria-busy', 'false');
}
async function verifyScreen(code) {
  const frame = (inner) => { app.innerHTML = `<header class="topbar"><div class="topbar-in">${brand('/')}<span class="tag">Концепт</span></div></header><div class="verify">${inner}<p class="disclaimer">Страница проверки концепт-прототипа. Документы не имеют юридической силы. Персональные данные показаны в сокращённом виде.</p><a class="btn ghost" href="/">Перейти в кабинет</a></div>`; app.setAttribute('aria-busy', 'false'); };
  frame('<div class="sk"></div>');
  const row = (k, v) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`;
  try {
    const d = await api(`verify/${encodeURIComponent(code || '')}`);
    if (!d.valid) throw Object.assign(new Error('not found'), {status: 404});
    const facts = d.type === 'card'
      ? row('Владелец', d.holder) + row('Статус', d.status) + row('Факультет', d.faculty) + row('Направление', d.program) + row('Группа', `${d.group}, ${d.year} курс`) + row('Действителен до', `${dayMonth(d.valid_until)} ${d.valid_until.slice(0, 4)}`)
      : row('Документ', d.kind) + row('Номер', d.number) + row('Выдан', `${dayMonth(d.issued)} ${d.issued.slice(0, 4)}`) + row('Кому', d.holder) + row('Группа', d.group);
    frame(`<section class="card"><div class="stack"><span class="seal">${icon('check')}</span><p class="eyebrow">Проверка подлинности</p><h1>${d.type === 'card' ? 'Студенческий билет действителен' : 'Документ действителен'}</h1><dl class="facts">${facts}</dl></div></section>`);
  } catch (e) {
    frame(`<section class="card"><div class="stack"><span class="seal bad">${icon('alert')}</span><p class="eyebrow">Проверка подлинности</p><h1>Документ не найден</h1><p class="lede">${e.status === 404 ? 'Кода нет в реестре: документ не выдавался или был отозван.' : 'Не удалось выполнить проверку. Повторите попытку позже.'}</p></div></section>`);
  }
}

function decorate(root) {
  root.querySelectorAll('[data-pct]').forEach((el) => el.style.setProperty('--pct', el.dataset.pct));
  root.querySelectorAll('[data-vars]').forEach((el) => el.dataset.vars.split(';').forEach((pair) => {
    const i = pair.indexOf(':');
    if (i > 0) el.style.setProperty(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }));
}
function countUp(root) {
  if (reduceMotion()) return;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target) || target <= 0) return;
    const t0 = performance.now(), dur = 900;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(target * eased));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  });
}
function render() {
  if (hashParts()[0] === 'verify') return verifyScreen(hashParts()[1]);
  if (!S.data) return loginScreen();
  const key = route();
  const views = isStaff() ? {queue: stf.viewQueue, rooms: stf.viewStaffRooms, announce: stf.viewAnnounce, profile: stf.viewStaffProfile}
    : isTeacher() ? {today: tch.viewToday, schedule: tch.viewSchedule, journal: tch.viewJournal, tasks: tch.viewTasks, rooms: stu.viewRooms, profile: tch.viewProfile}
    : {today: stu.viewToday, schedule: stu.viewSchedule, study: stu.viewStudy, requests: stu.viewRequests, notices: stu.viewNotices, news: stu.viewNews, tasks: stu.viewTasks, rooms: stu.viewRooms, assistant: stu.viewAssistant, profile: stu.viewProfile, doc: () => stu.viewDoc(hashParts()[1])};
  const entering = key !== lastKey;
  lastKey = key;
  app.innerHTML = shell(views[key](), key);
  decorate(app);
  if (entering) { const main = app.querySelector('#main'); main.classList.add('enter'); countUp(main); }
  app.setAttribute('aria-busy', 'false');
}
function openSheet(html) {
  if (!html) return;
  if (!sheet.open) lastFocus = document.activeElement;
  sheetBody.innerHTML = html;
  decorate(sheetBody);
  if (!sheet.open) sheet.showModal();
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('close', () => { sheetBody.innerHTML = ''; if (lastFocus?.isConnected) lastFocus.focus(); });
function openSearch() { if (!S.data || isStaff() || isTeacher()) return; openSheet(stu.searchSheet()); document.querySelector('#search-q')?.focus(); }

function setData(next) { S.data = next; indexLessons(); }
function resetUi() { Object.assign(S, {day: null, week: 0, messages: [], busy: false, noticeFilter: 'all', queueFilter: 'active', roomQuery: '', bld: 'А', pair: null, room: '', floor: null, hwFilter: 'active', newsCat: 'all', off: null, tfilter: 'review'}); }
async function doLogin(login, password) {
  try {
    setData(await api('login', {login, password}));
    S.version++; resetUi();
    location.hash = routes()[0];
    render();
  } catch (e) { loginScreen(e.message || 'Не удалось войти.', login); }
}
async function logout() {
  try { await api('logout', {}); } catch { /* сессия уже недействительна */ }
  S.version++; S.data = null; resetUi(); closeSheet(); location.hash = ''; render();
}
async function ask(question) {
  if (!question.trim() || S.busy) return;
  S.busy = true; S.messages.push({from: 'user', text: question.trim()}); render();
  const version = S.version;
  try { const r = await api('assistant', {question: question.trim()}); if (version === S.version) S.messages.push({from: 'bot', text: r.answer}); }
  catch (e) { if (version === S.version) S.messages.push({from: 'bot', text: e.message}); }
  finally { if (version === S.version) { S.busy = false; if (route() === 'assistant') { render(); document.querySelector('#question')?.focus(); } } }
}
async function mutate(path, body, after) {
  const version = S.version;
  const updated = await api(path, body);
  if (version !== S.version) return;
  setData(updated); after?.(); render();
}
function showRoom(key) {
  const r = roomByKey(key);
  if (!r) return;
  S.bld = r.building; S.room = key; S.floor = r.floor;
  closeSheet();
  if (route() !== 'rooms') location.hash = 'rooms'; else render();
}

/* события */
const ACTIONS = '[data-demo],[data-lesson],[data-day],[data-week],[data-request-kind],[data-read],[data-read-all],[data-nfilter],[data-qfilter],[data-question],[data-calendar],[data-ics-lesson],[data-logout],[data-close],[data-retry],[data-search],[data-room3],[data-pair],[data-bld],[data-goto-room],[data-print],[data-copy],[data-unmark],[data-rot],[data-news],[data-ncat],[data-hw],[data-task],[data-hwf],[data-scroll],[data-floor],[data-att],[data-mark],[data-attall],[data-review],[data-newtask],[data-tannounce],[data-deltask],[data-off],[data-stud],[data-tf],[data-chg],[data-restore]';
document.addEventListener('click', async (event) => {
  if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
  const el = event.target.closest(ACTIONS);
  if (!el) { if (event.target === sheet) closeSheet(); return; }
  const d = el.dataset;
  try {
    if (d.retry !== undefined) return location.reload();
    if (d.rot) { setRotation(S.rz + Number(d.rot)); return; }
    if (d.demo) return doLogin(d.demo, DEMO_PASSWORD);
    if (d.close !== undefined) return closeSheet();
    if (d.search !== undefined) return openSearch();
    if (d.print !== undefined) return window.print();
    if (d.copy) { try { await navigator.clipboard.writeText(d.copy); flash('Ссылка проверки скопирована.'); } catch { flash('Не удалось скопировать. Выделите ссылку вручную.'); } return; }
    if (d.lesson) return openSheet(isTeacher() ? tch.lessonSheet(d.lesson) : stu.lessonSheet(d.lesson));
    if (d.att) return openSheet(tch.attSheet(d.att));
    if (d.chg) return openSheet(tch.changeSheet(d.chg));
    if (d.restore) { el.disabled = true; return await mutate('teacher/lesson', {lesson_id: d.restore, kind: 'restore'}, () => { openSheet(tch.lessonSheet(d.restore)); flash('Занятие вернулось в расписание как было. Студенты увидят это сразу.'); }); }
    if (d.review) return openSheet(tch.reviewSheet(d.review));
    if (d.newtask !== undefined) return openSheet(tch.taskFormSheet(d.newtask));
    if (d.tannounce !== undefined) return openSheet(tch.announceSheet());
    if (d.stud) return openSheet(tch.studentSheet(d.stud));
    if (d.tf) { S.tfilter = d.tf; render(); return document.querySelector(`[data-tf="${d.tf}"]`)?.focus(); }
    if (d.off) { S.off = d.off; if (d.goto) { location.hash = d.goto; return; } render(); return document.querySelector(`[data-off="${CSS.escape(d.off)}"]`)?.focus(); }
    if (d.mark || d.attall) {
      const [lesson, group, course, student, mark] = (d.mark || d.attall).split('|');
      let students = [student];
      if (d.attall) { const j = S.data.journals[`${course}:${group}`]; const i = j.lessons.findIndex((x) => x.id === lesson); students = j.students.filter((s) => s.marks[i] === '-').map((s) => s.id); if (!students.length) return flash('Все студенты уже отмечены.'); }
      const inSheet = sheet.open, focusKey = d.mark;
      el.disabled = true;
      return await mutate('teacher/attendance', {group, course, lesson_id: lesson, students, mark: d.attall ? 'p' : mark}, () => {
        if (inSheet) { openSheet(tch.attSheet(lesson)); sheetBody.querySelector(`[data-mark^="${CSS.escape(lesson + '|' + group + '|' + course + '|' + student + '|')}"][aria-pressed="true"], [data-attall]`)?.focus(); }
        else requestAnimationFrame(() => { const [l, g, c, s] = focusKey.split('|'); document.querySelector(`.jr [data-mark^="${CSS.escape(`${l}|${g}|${c}|${s}|`)}"]`)?.focus({preventScroll: true}); });
      });
    }
    if (d.deltask) { if (!window.confirm('Удалить задание? Оценки по нему тоже удалятся.')) return; el.disabled = true; return await mutate('teacher/tasks/delete', {id: d.deltask}, () => { closeSheet(); flash('Задание удалено.'); }); }
    if (d.news) return openSheet(stu.newsSheet(d.news));
    if (d.task) return openSheet(stu.taskSheet(d.task));
    if (d.hwf) { S.hwFilter = d.hwf; render(); return document.querySelector(`[data-hwf="${d.hwf}"]`)?.focus(); }
    if (d.scroll) { const box = el.closest('.sec')?.querySelector('[data-carousel]'); const card = box?.querySelector('.tcard'); if (box && card) box.scrollBy({left: Number(d.scroll) * (card.offsetWidth + 16), behavior: reduceMotion() ? 'auto' : 'smooth'}); return; }
    if (d.hw) {
      const h = S.data.homework.find((x) => x.id === d.hw); if (!h) return;
      const done = h.status !== 'done'; el.disabled = true;
      const inSheet = sheet.open;
      return await mutate('homework', {id: d.hw, done}, () => { if (inSheet) openSheet(stu.taskSheet(d.hw)); flash(done ? 'Отмечено как сданное. Преподаватель это увидит.' : 'Отметка «Сдано» снята.'); });
    }
    if (d.ncat) { S.newsCat = d.ncat; render(); return document.querySelector(`[data-ncat="${d.ncat}"]`)?.focus(); }
    if (d.requestKind) return openSheet(stu.requestSheet(d.requestKind));
    if (d.gotoRoom) return showRoom(d.gotoRoom);
    if (d.room3) { const r = roomByKey(d.room3); S.room = d.room3; if (r) { S.bld = r.building; S.floor = r.floor; } render(); return document.querySelector(`.plan [data-room3="${CSS.escape(d.room3)}"]`)?.focus({preventScroll: true}); }
    if (d.floor) { S.floor = Number(d.floor); render(); return document.querySelector(`.floor-chips [data-floor="${d.floor}"]`)?.focus({preventScroll: true}); }
    if (d.pair) { S.pair = Number(d.pair); render(); return document.querySelector(`[data-pair="${d.pair}"]`)?.focus({preventScroll: true}); }
    if (d.bld) { S.bld = d.bld; S.room = ''; S.floor = null; render(); return document.querySelector(`[data-bld="${CSS.escape(d.bld)}"]`)?.focus({preventScroll: true}); }
    if (d.day) { S.day = d.day; render(); return document.querySelector(`[data-day="${d.day}"]`)?.focus({preventScroll: true}); }
    if (d.week !== undefined) { S.week = Number(d.week); S.day = S.week === 0 ? (S.data.schedule.slice(0, 7).find((x) => x.date === stu.nowIso()) || S.data.schedule[0]).date : S.data.schedule[7].date; render(); return document.querySelector(`[data-week="${S.week}"]`)?.focus({preventScroll: true}); }
    if (d.nfilter) { S.noticeFilter = d.nfilter; render(); return document.querySelector(`[data-nfilter="${d.nfilter}"]`)?.focus(); }
    if (d.qfilter) { S.queueFilter = d.qfilter; render(); return document.querySelector(`[data-qfilter="${d.qfilter}"]`)?.focus(); }
    if (d.question !== undefined) return ask(stu.QUESTIONS[d.question]);
    if (d.logout !== undefined) { el.disabled = true; return logout(); }
    if (d.calendar) {
      const days = d.calendar === 'week' ? S.data.schedule.slice(S.week * 7, S.week * 7 + 7) : S.data.schedule.filter((x) => x.date === (S.day || stu.nowIso()));
      const ics = buildIcs(days);
      if (!ics) return flash('В выбранном периоде занятий нет.');
      downloadIcs(ics, d.calendar === 'week' ? `raspisanie-nedelya-${days[0].week}.ics` : `raspisanie-${days[0].date}.ics`);
      return flash(`Выгружено занятий: ${ics.count}. Откройте файл в календаре.`);
    }
    if (d.icsLesson) {
      const found = lessonIndex.get(d.icsLesson);
      const ics = found && buildIcs([{date: found.day.date, lessons: [found.lesson]}]);
      if (!ics) return flash('Занятие отменено, в календарь не добавляется.');
      downloadIcs(ics, `${found.day.date}-${found.lesson.pair}-para.ics`);
      return flash('Файл календаря сохранён.');
    }
    if (d.read) { el.disabled = true; return await mutate('notice', {id: d.read}, () => flash('Уведомление отмечено прочитанным.')); }
    if (d.readAll !== undefined) { el.disabled = true; return await mutate('notice', {id: 'all'}, () => flash('Все уведомления отмечены прочитанными.')); }
    if (d.unmark) { const [building, room, pair] = d.unmark.split('|'); el.disabled = true; return await mutate('staff/rooms', {building, room, pair: Number(pair), state: 'auto'}, () => flash('Отметка снята.')); }
  } catch (e) {
    if (e.status === 401) { S.data = null; return render(); }
    el.disabled = false; flash(e.message);
  }
});

document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target, fields = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button:not([type=button])');
  if (form.id === 'login-form') { if (button) button.disabled = true; const st = form.querySelector('.form-status'); if (st) st.textContent = 'Выполняется вход…'; return doLogin(String(fields.login || '').trim(), String(fields.password || '')); }
  if (form.id === 'assistant-form') return ask(String(fields.question || ''));
  if (button) button.disabled = true;
  try {
    if (form.id === 'request-form') {
      await mutate('requests', fields, () => { closeSheet(); if (route() !== 'requests') location.hash = 'requests'; });
      return flash('Заявка отправлена. Статус отображается в истории заявок.');
    }
    if (form.id === 'announce-form') { await mutate('staff/announcements', fields); return flash('Объявление опубликовано.'); }
    if (form.id === 'lesson-form') {
      const [building, room] = String(fields.room || '|').split('|');
      const body = {lesson_id: form.dataset.lid, kind: fields.kind, reason: fields.reason || '', building, room, pair: Number(fields.pair)};
      await mutate('teacher/lesson', body, () => openSheet(tch.lessonSheet(form.dataset.lid)));
      return flash(fields.kind === 'cancel' ? 'Занятие отменено. Студенты получили уведомление.' : 'Изменение сохранено. Студенты получили уведомление.');
    }
    if (form.id === 'tannounce-form') { await mutate('teacher/announce', fields, closeSheet); return flash('Сообщение отправлено группе.'); }
    if (form.id === 'task-form') {
      const data = new FormData(form);
      const body = {course: fields.course, groups: data.getAll('groups'), title: fields.title, text: fields.text || '', kind: fields.kind, points_max: Number(fields.points_max), due_mode: fields.due_mode, due_date: fields.due_date, due_time: fields.due_time || '23:59'};
      if (!body.groups.length) throw new Error('Выберите хотя бы одну группу.');
      await mutate('teacher/tasks', body, () => { closeSheet(); S.tfilter = 'active'; if (route() !== 'tasks') location.hash = 'tasks'; });
      return flash('Задание выдано. Студенты уже видят его в разделе «Задания».');
    }
    if (form.classList.contains('grade-form')) {
      const raw = String(fields.points ?? '').trim();
      const body = {task_id: form.dataset.gtask, student_id: form.dataset.student, points: raw === '' ? null : Number(raw), comment: fields.comment || ''};
      await mutate('teacher/grade', body, () => { openSheet(tch.reviewSheet(form.dataset.gtask)); sheetBody.querySelector(`.grade-form[data-student="${CSS.escape(body.student_id)}"] input`)?.focus(); });
      return flash(body.points === null && !body.comment ? 'Оценка снята.' : 'Оценка сохранена.');
    }
    if (form.id === 'room-form') {
      await mutate('staff/rooms', {building: form.dataset.building, room: form.dataset.room, pair: fields.scope === 'day' ? 0 : activePair(), state: fields.state, note: fields.note || ''});
      return flash('Отметка сохранена. Студенты уже видят её на схеме.');
    }
    if (form.classList.contains('status-form')) { await mutate(`staff/requests/${form.dataset.request}`, fields); return flash('Статус обновлён. Студент увидит его в истории заявки.'); }
  } catch (e) {
    if (e.status === 401) { S.data = null; closeSheet(); return render(); }
    const box = form.querySelector('.form-error') || sheetBody.querySelector('.form-error'); if (box) box.textContent = e.message; else flash(e.message);
    if (button) button.disabled = false;
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'room-q') { S.roomQuery = event.target.value; const box = document.querySelector('#rooms-list'); if (box) box.innerHTML = stu.roomsFiltered(); }
  if (event.target.id === 'search-q') { const box = document.querySelector('#search-results'); if (box) box.innerHTML = stu.searchResults(event.target.value); }
});
document.addEventListener('keydown', (event) => {
  const typing = event.target.matches?.('input,textarea,select');
  if ((event.key === '/' && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) { event.preventDefault(); return openSearch(); }
  if (event.key === 'Enter' && event.target.id === 'search-q') { event.preventDefault(); document.querySelector('#search-results .res')?.click(); }
});
window.addEventListener('hashchange', () => {
  closeSheet(); render(); window.scrollTo(0, 0);
  if (S.data) document.querySelector('#main')?.focus({preventScroll: true});
});

/* вращение 3D-схемы */
function setRotation(value) {
  S.rz = Math.max(-80, Math.min(40, Math.round(value)));
  document.querySelectorAll('.b3d-stage,.stage3d').forEach((el) => el.style.setProperty('--rz', `${S.rz}deg`));
}
document.addEventListener('pointerdown', (event) => {
  const el = event.target.closest('[data-drag3d]');
  if (!el || event.button > 0) return;
  drag = {x: event.clientX, rz: S.rz, moved: false};
});
document.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.x;
  if (Math.abs(dx) > 5) drag.moved = true;
  if (drag.moved) setRotation(drag.rz + dx * 0.35);
});
const endDrag = () => { if (drag?.moved) suppressClick = true; drag = null; setTimeout(() => { suppressClick = false; }, 0); };
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', () => { drag = null; });

/* живые часы на главной */
setInterval(() => { document.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = stu.clockText(); }); }, 15000);

/* актуальность данных */
const busyUi = () => sheet.open || document.activeElement?.matches?.('input,textarea,select') || S.busy;
async function refresh() {
  if (!S.data || busyUi() || document.hidden || hashParts()[0] === 'verify') return;
  const version = S.version;
  try { const next = await api('dashboard'); if (version === S.version && !busyUi()) { setData(next); render(); } }
  catch (e) { if (e.status === 401) { S.data = null; render(); } }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(refresh, 60000);

/* старт */
try {
  if (hashParts()[0] === 'verify') { api('session').then((d) => { if (!d.anonymous) setData(d); }).catch(() => {}); render(); }
  else { const first = await api('session'); if (!first.anonymous) setData(first); render(); }
} catch (e) { errorScreen(); }

/* Комнаты на плане — элементы SVG с role="button": Enter и пробел работают как щелчок. */
document.addEventListener('keydown', (event) => {
  const el = event.target;
  if ((event.key === 'Enter' || event.key === ' ') && el instanceof SVGElement && el.matches('[role="button"]')) {
    event.preventDefault();
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
  }
});
