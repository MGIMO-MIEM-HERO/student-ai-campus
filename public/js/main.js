import {S, indexLessons, lessonIndex} from './state.js';
import {api} from './api.js';
import {icon} from './icons.js';
import {esc, buildIcs, downloadIcs, dayMonth} from './util.js';
import {activePair, roomByKey} from './campus.js';
import * as stu from './student.js';
import * as stf from './staff.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const sheet = document.querySelector('#sheet');
const sheetBody = document.querySelector('#sheet-body');
const DEMO_PASSWORD = 'Campus-demo-2026';
let toastTimer, lastFocus;

const isStaff = () => S.data?.role === 'staff';
const routes = () => (isStaff() ? stf.ROUTES : stu.ROUTES);
const hashParts = () => location.hash.slice(1).split('/');
const route = () => { const k = hashParts()[0]; return routes().includes(k) ? k : routes()[0]; };
function flash(message) {
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 5000);
}
const brand = (href) => `<a class="brand" href="${href}"><img src="/mark.svg" alt=""><b>Цифровой деканат</b></a>`;
const footer = () => `<footer class="foot"><p>Концепт-прототип для конкурса MGIMO×AI Challenge. Не является официальным сервисом университета, логотип университета не используется. Все данные вымышлены.</p></footer>`;

/* оболочка */
function shell(content, key) {
  const staff = isStaff();
  const nav = staff ? stf.NAV : stu.NAV;
  const navKey = staff ? key : (stu.NAV_OF[key] || key);
  const name = S.data.profile.name;
  const badge = (id) => (staff ? (id === 'queue' ? stf.activeCount() : 0) : id === 'more' ? stu.unreadCount() : id === 'requests' ? stu.readyCount() : 0);
  return `<header class="topbar"><div class="topbar-in">${brand('#' + nav[0][0])}<span class="tag">${staff ? 'Деканат' : 'Концепт'}</span>
    <nav class="nav" aria-label="Разделы кабинета"><ul>${nav.map(([id, label, ico]) => {
      const b = badge(id);
      return `<li><a href="#${id}" ${id === navKey ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span>${b ? `<span class="badge" aria-label="${b} новых">${b}</span>` : ''}</a></li>`;
    }).join('')}</ul></nav><span class="grow"></span>
    ${staff ? '' : `<button class="search-btn" data-search>${icon('search')}Поиск<kbd>/</kbd></button><button class="icon-btn search-icon" data-search aria-label="Поиск">${icon('search')}</button>`}
    <a class="avatar" href="#profile" aria-label="Профиль: ${esc(name)}">${esc(name[0])}</a></div></header>
  <div class="wrap"><main id="main" tabindex="-1">${content}</main></div>${footer()}`;
}

function loginScreen(error = '', login = '') {
  const demo = [['alina', 'Алина Северова', 'студентка, ПИ-241, 2 курс'], ['mark', 'Марк Луговой', 'студент, МО-251, 1 курс'], ['dekanat', 'Вера Деканова', 'сотрудник деканата']];
  const features = [['schedule', 'periwinkle', 'Расписание с изменениями, окнами и аудиториями'], ['study', 'marigold', 'Баллы, допуск и график сессии'], ['requests', 'mint', 'Справки с QR-проверкой и статусом'], ['building', 'sky', 'Схема корпусов и свободные аудитории']];
  app.innerHTML = `<div class="login"><section class="login-hero">
      <div class="login-top">${brand('/')}<span class="tag">Концепт</span></div><p class="eyebrow">Личный кабинет студента</p><h1>Деканат, в который не нужно идти</h1><p class="lede">Расписание, баллы, справки и связь с деканатом в одном спокойном месте. С телефона и компьютера.</p></section>
    <div class="login-pad"><div class="login-stage"><section class="card login-card"><h2 class="title">Вход в кабинет</h2>
      <form id="login-form"><label for="login">Логин</label><input id="login" name="login" required autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(login)}">
      <label for="password">Пароль</label><input type="password" id="password" name="password" required autocomplete="current-password">
      <p class="form-error" role="alert">${esc(error)}</p><button class="btn block">Войти</button></form>
      <p class="eyebrow">Демонстрационные аккаунты</p>
      <div class="demo-grid">${demo.map(([id, name, role]) => `<button class="demo" data-demo="${id}"><span class="avatar" aria-hidden="true">${name[0]}</span><span><strong>${name}</strong><span>${role}</span></span>${icon('arrow')}</button>`).join('')}</div>
      <p class="cap">Пароль демонстрационных аккаунтов: <b>${DEMO_PASSWORD}</b></p></section></div>
    <ul class="features">${features.map(([ico, tone, text]) => `<li><span class="ico ${tone}">${icon(ico)}</span>${text}</li>`).join('')}</ul>
    <p class="disclaimer">Концепт-прототип для конкурса MGIMO×AI Challenge. Не является официальным сервисом университета, логотип университета не используется. Все данные вымышлены.</p></div></div>`;
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

function decorate(root) { root.querySelectorAll('[data-pct]').forEach((el) => el.style.setProperty('--pct', el.dataset.pct)); }
function render() {
  if (hashParts()[0] === 'verify') return verifyScreen(hashParts()[1]);
  if (!S.data) return loginScreen();
  const key = route();
  const views = isStaff() ? {queue: stf.viewQueue, rooms: stf.viewStaffRooms, announce: stf.viewAnnounce, profile: stf.viewStaffProfile}
    : {today: stu.viewToday, schedule: stu.viewSchedule, study: stu.viewStudy, requests: stu.viewRequests, more: stu.viewMore, notices: stu.viewNotices, rooms: stu.viewRooms, assistant: stu.viewAssistant, profile: stu.viewProfile, doc: () => stu.viewDoc(hashParts()[1])};
  app.innerHTML = shell(views[key](), key);
  decorate(app);
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
function openSearch() { if (!S.data || isStaff()) return; openSheet(stu.searchSheet()); document.querySelector('#search-q')?.focus(); }

function setData(next) { S.data = next; indexLessons(); }
function resetUi() { Object.assign(S, {day: null, week: 0, messages: [], busy: false, noticeFilter: 'all', queueFilter: 'active', roomQuery: '', bld: 'А', pair: null, room: ''}); }
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
  S.bld = r.building; S.room = key;
  closeSheet();
  if (route() !== 'rooms') location.hash = 'rooms'; else render();
}

/* события */
const ACTIONS = '[data-demo],[data-lesson],[data-day],[data-week],[data-request-kind],[data-read],[data-read-all],[data-nfilter],[data-qfilter],[data-question],[data-calendar],[data-ics-lesson],[data-logout],[data-close],[data-retry],[data-search],[data-room3],[data-pair],[data-bld],[data-goto-room],[data-print],[data-copy],[data-unmark]';
document.addEventListener('click', async (event) => {
  const el = event.target.closest(ACTIONS);
  if (!el) { if (event.target === sheet) closeSheet(); return; }
  const d = el.dataset;
  try {
    if (d.retry !== undefined) return location.reload();
    if (d.demo) return doLogin(d.demo, DEMO_PASSWORD);
    if (d.close !== undefined) return closeSheet();
    if (d.search !== undefined) return openSearch();
    if (d.print !== undefined) return window.print();
    if (d.copy) { try { await navigator.clipboard.writeText(d.copy); flash('Ссылка проверки скопирована.'); } catch { flash('Не удалось скопировать. Выделите ссылку вручную.'); } return; }
    if (d.lesson) return openSheet(stu.lessonSheet(d.lesson));
    if (d.requestKind) return openSheet(stu.requestSheet(d.requestKind));
    if (d.gotoRoom) return showRoom(d.gotoRoom);
    if (d.room3) { const r = roomByKey(d.room3); S.room = d.room3; if (r) S.bld = r.building; render(); return document.querySelector(`.b3d [data-room3="${CSS.escape(d.room3)}"]`)?.focus({preventScroll: true}); }
    if (d.pair) { S.pair = Number(d.pair); render(); return document.querySelector(`[data-pair="${d.pair}"]`)?.focus({preventScroll: true}); }
    if (d.bld) { S.bld = d.bld; S.room = ''; render(); return document.querySelector(`[data-bld="${CSS.escape(d.bld)}"]`)?.focus({preventScroll: true}); }
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
  if (form.id === 'login-form') { if (button) button.disabled = true; return doLogin(String(fields.login || '').trim(), String(fields.password || '')); }
  if (form.id === 'assistant-form') return ask(String(fields.question || ''));
  if (button) button.disabled = true;
  try {
    if (form.id === 'request-form') {
      await mutate('requests', fields, () => { closeSheet(); if (route() !== 'requests') location.hash = 'requests'; });
      return flash('Заявка отправлена. Статус отображается в истории заявок.');
    }
    if (form.id === 'announce-form') { await mutate('staff/announcements', fields); return flash('Объявление опубликовано.'); }
    if (form.id === 'room-form') {
      await mutate('staff/rooms', {building: form.dataset.building, room: form.dataset.room, pair: fields.scope === 'day' ? 0 : activePair(), state: fields.state, note: fields.note || ''});
      return flash('Отметка сохранена. Студенты уже видят её на схеме.');
    }
    if (form.classList.contains('status-form')) { await mutate(`staff/requests/${form.dataset.request}`, fields); return flash('Статус обновлён. Студент увидит его в истории заявки.'); }
  } catch (e) {
    if (e.status === 401) { S.data = null; closeSheet(); return render(); }
    const box = form.querySelector('.form-error'); if (box) box.textContent = e.message;
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
