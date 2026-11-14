import {S, indexLessons, lessonIndex} from './state.js';
import {api} from './api.js';
import {icon} from './icons.js';
import {esc, buildIcs, downloadIcs} from './util.js';
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
const route = () => { const k = location.hash.slice(1); return routes().includes(k) ? k : routes()[0]; };
function flash(message) {
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 5000);
}

/* тема оформления */
try { S.theme = localStorage.getItem('campus-theme') || 'system'; } catch { S.theme = 'system'; }
function setTheme(id) {
  S.theme = id;
  if (id === 'light' || id === 'dark') document.documentElement.setAttribute('data-theme', id); else document.documentElement.removeAttribute('data-theme');
  try { if (id === 'system') localStorage.removeItem('campus-theme'); else localStorage.setItem('campus-theme', id); } catch { /* хранилище недоступно */ }
}

/* оболочка */
function shell(content, key) {
  const staff = isStaff();
  const nav = staff ? stf.NAV : stu.NAV;
  const navKey = staff ? key : (stu.NAV_OF[key] || key);
  const name = S.data.profile.name;
  const badge = (id) => (staff ? (id === 'queue' ? stf.activeCount() : 0) : id === 'more' ? stu.unreadCount() : id === 'requests' ? stu.readyCount() : 0);
  return `<header class="topbar"><div class="topbar-in"><a class="brand" href="#${nav[0][0]}"><img src="/mark.svg" alt=""><span class="brand-text"><strong>Цифровой деканат</strong><small>${staff ? 'Кабинет сотрудника' : 'Личный кабинет студента'}</small></span></a><span class="grow"></span><span class="concept">Концепт</span>
    <a class="user-chip" href="#profile" aria-label="Профиль: ${esc(name)}"><span class="avatar" aria-hidden="true">${esc(name[0])}</span><span>${esc(name)}</span></a></div></header>
  <div class="shell"><nav class="nav" aria-label="Разделы кабинета"><ul>${nav.map(([id, label, ico]) => {
    const b = badge(id);
    return `<li><a href="#${id}" ${id === navKey ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span>${b ? `<span class="badge" aria-label="${b} новых">${b}</span>` : ''}</a></li>`;
  }).join('')}</ul></nav><main id="main" tabindex="-1">${content}</main></div>
  <footer class="foot"><p>Концепт-прототип для конкурса MGIMO×AI Challenge. Не является официальным сервисом университета. Все данные вымышлены.</p><p>Время в расписании московское.</p></footer>`;
}

function loginScreen(error = '', login = '') {
  const demo = [['alina', 'Алина Северова', 'студентка, ПИ-241, 2 курс'], ['mark', 'Марк Луговой', 'студент, МО-251, 1 курс'], ['dekanat', 'Вера Деканова', 'сотрудник деканата']];
  app.innerHTML = `<div class="login"><div class="login-in"><section class="login-copy">
    <a class="brand" href="/"><img src="/mark.svg" alt=""><span class="brand-text"><strong>Цифровой деканат</strong><small>Личный кабинет студента</small></span></a>
    <h1>Учёба, документы и деканат в одном кабинете</h1>
    <p class="lede">Расписание с изменениями, баллы и график сессии, заявки на справки со статусом и объявления деканата. Работает на телефоне и компьютере.</p>
    <ul class="facts-list"><li>${icon('schedule')}Расписание по парам, корпусам и аудиториям, чётные и нечётные недели</li><li>${icon('study')}Баллы, допуск к контролю и график сессии</li><li>${icon('requests')}Справки и обращения со статусом и историей</li><li>${icon('bell')}Объявления деканата и сроки в одной ленте</li></ul></section>
    <section class="card"><h2>Вход в кабинет</h2>
    <form id="login-form"><label for="login">Логин</label><input id="login" name="login" required autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(login)}">
    <label for="password">Пароль</label><input type="password" id="password" name="password" required autocomplete="current-password">
    <p class="form-error" role="alert">${esc(error)}</p><button class="btn block">Войти</button></form>
    <p class="label">Демонстрационные аккаунты</p>
    <div class="demo-grid">${demo.map(([id, name, role]) => `<button class="demo" data-demo="${id}"><span><strong>${name}</strong><span>${role}</span></span>${icon('arrow')}</button>`).join('')}</div>
    <p class="disclaimer">Концепт-прототип для конкурса MGIMO×AI Challenge. Не является официальным сервисом университета, логотип университета не используется. Все данные вымышлены. Пароль демонстрационных аккаунтов: <b>${DEMO_PASSWORD}</b>.</p></section></div></div>`;
  app.setAttribute('aria-busy', 'false');
}
function errorScreen() {
  app.innerHTML = `<div class="state"><h1>Не удалось загрузить кабинет</h1><p class="lede">Проверьте подключение к интернету и повторите попытку.</p><button class="btn" data-retry>Повторить</button></div>`;
  app.setAttribute('aria-busy', 'false');
}

function decorate(root) { root.querySelectorAll('[data-pct]').forEach((el) => el.style.setProperty('--pct', el.dataset.pct)); }
function render() {
  if (!S.data) return loginScreen();
  const key = route();
  const views = isStaff() ? {queue: stf.viewQueue, announce: stf.viewAnnounce, profile: stf.viewStaffProfile} : {today: stu.viewToday, schedule: stu.viewSchedule, study: stu.viewStudy, requests: stu.viewRequests, more: stu.viewMore, notices: stu.viewNotices, rooms: stu.viewRooms, assistant: stu.viewAssistant, profile: stu.viewProfile};
  app.innerHTML = shell(views[key](), key);
  decorate(app);
  app.setAttribute('aria-busy', 'false');
}
function openSheet(html) {
  if (!html) return;
  lastFocus = document.activeElement;
  sheetBody.innerHTML = html;
  decorate(sheetBody);
  if (!sheet.open) sheet.showModal();
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('close', () => { sheetBody.innerHTML = ''; lastFocus?.focus?.(); });

function setData(next) { S.data = next; indexLessons(); }
function resetUi() { S.day = null; S.week = 0; S.messages = []; S.busy = false; S.noticeFilter = 'all'; S.queueFilter = 'active'; S.roomQuery = ''; }
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

/* события */
document.addEventListener('click', async (event) => {
  const el = event.target.closest('[data-demo],[data-lesson],[data-day],[data-week],[data-theme],[data-request-kind],[data-read],[data-read-all],[data-nfilter],[data-qfilter],[data-question],[data-calendar],[data-ics-lesson],[data-logout],[data-close],[data-retry]');
  if (!el) { if (event.target === sheet) closeSheet(); return; }
  const d = el.dataset;
  try {
    if (d.retry !== undefined) return location.reload();
    if (d.demo) return doLogin(d.demo, DEMO_PASSWORD);
    if (d.close !== undefined) return closeSheet();
    if (d.lesson) return openSheet(stu.lessonSheet(d.lesson));
    if (d.requestKind) { closeSheet(); return openSheet(stu.requestSheet(d.requestKind)); }
    if (d.day) { S.day = d.day; render(); return document.querySelector(`[data-day="${d.day}"]`)?.focus(); }
    if (d.week !== undefined) { S.week = Number(d.week); S.day = S.week === 0 ? (S.data.schedule.slice(0, 7).find((x) => x.date === stu.nowIso()) || S.data.schedule[0]).date : S.data.schedule[7].date; render(); return document.querySelector(`[data-week="${S.week}"]`)?.focus(); }
    if (d.theme) { setTheme(d.theme); render(); return; }
    if (d.nfilter) { S.noticeFilter = d.nfilter; render(); return document.querySelector(`[data-nfilter="${d.nfilter}"]`)?.focus(); }
    if (d.qfilter) { S.queueFilter = d.qfilter; render(); return document.querySelector(`[data-qfilter="${d.qfilter}"]`)?.focus(); }
    if (d.question !== undefined) return ask(stu.QUESTIONS[d.question]);
    if (d.logout !== undefined) { el.disabled = true; return logout(); }
    if (d.calendar) {
      const days = d.calendar === 'week' ? S.data.schedule.slice(S.week * 7, S.week * 7 + 7) : S.data.schedule.filter((x) => x.date === (S.day || stu.nowIso()));
      const ics = buildIcs(days);
      if (!ics) return flash('В выбранном периоде занятий нет.');
      downloadIcs(ics, d.calendar === 'week' ? `raspisanie-nedelya-${days[0].week}.ics` : `raspisanie-${days[0].date}.ics`);
      return flash(`Выгружено занятий: ${ics.count}. Откройте файл в приложении «Календарь».`);
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
  } catch (e) {
    if (e.status === 401) { S.data = null; return render(); }
    el.disabled = false; flash(e.message);
  }
});

document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target, fields = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button:not([type=button])');
  const fail = (e) => { if (e.status === 401) { S.data = null; closeSheet(); return render(); } const box = form.querySelector('.form-error'); if (box) box.textContent = e.message; if (button) button.disabled = false; };
  if (form.id === 'login-form') { if (button) button.disabled = true; return doLogin(String(fields.login || '').trim(), String(fields.password || '')); }
  if (form.id === 'assistant-form') return ask(String(fields.question || ''));
  if (button) button.disabled = true;
  try {
    if (form.id === 'request-form') {
      await mutate('requests', fields, () => { closeSheet(); if (route() !== 'requests') location.hash = 'requests'; });
      return flash('Заявка отправлена. Статус отображается в истории заявок.');
    }
    if (form.id === 'announce-form') { await mutate('staff/announcements', fields); return flash('Объявление опубликовано. Студенты увидят его в уведомлениях.'); }
    if (form.classList.contains('status-form')) { await mutate(`staff/requests/${form.dataset.request}`, fields); return flash('Статус обновлён. Студент увидит его в истории заявки.'); }
  } catch (e) { fail(e); }
});
document.addEventListener('input', (event) => {
  if (event.target.id !== 'room-q') return;
  S.roomQuery = event.target.value;
  const box = document.querySelector('#rooms-list');
  if (box) box.innerHTML = stu.roomsFiltered();
});
window.addEventListener('hashchange', () => {
  closeSheet(); render(); window.scrollTo(0, 0);
  if (S.data) document.querySelector('#main')?.focus({preventScroll: true});
});

/* актуальность данных */
const busyUi = () => sheet.open || document.activeElement?.matches?.('input,textarea,select') || S.busy;
async function refresh() {
  if (!S.data || busyUi() || document.hidden) return;
  const version = S.version;
  try { const next = await api('dashboard'); if (version === S.version && !busyUi()) { setData(next); render(); } }
  catch (e) { if (e.status === 401) { S.data = null; render(); } }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(refresh, 90000);

/* старт */
try {
  const first = await api('session');
  if (first.anonymous) loginScreen(); else { setData(first); render(); }
} catch (e) {
  if (e.status === 401) loginScreen(); else errorScreen();
}
