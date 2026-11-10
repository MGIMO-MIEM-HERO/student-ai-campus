const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let data, day = 0, messages = [], busy = false, toastTimer, sessionVersion = 0;
const paths = {
  home: ['Обзор', 'M3 10l9-7 9 7v10H3z M9 20v-7h6v7'],
  schedule: ['Расписание', 'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4'],
  grades: ['Успеваемость', 'M4 19V9h4v10 M10 19V4h4v15 M16 19v-7h4v7 M2 20h20'],
  requests: ['Заявки и справки', 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8'],
  notices: ['Уведомления', 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 20h4'],
  assistant: ['Помощник', 'M4 4h16v12h-8l-5 4v-4H4z M8 10h8'],
  profile: ['Профиль', 'M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21v-2a8 8 0 0 1 16 0v2'],
};
const kinds = ['Справка об обучении', 'Выписка об успеваемости', 'Обращение в деканат'];
const questions = ['Какие пары сегодня?', 'Что с дедлайнами?', 'Когда сессия?', 'Как заказать справку?'];
const icon = (key) => `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${paths[key][1]}"/></svg>`;
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate = (value, opts) => new Intl.DateTimeFormat('ru-RU', {...opts, timeZone:'UTC'}).format(new Date(value + 'T12:00:00Z'));
const shortDate = (v) => formatDate(v, {day:'numeric',month:'short'});
const link = (page, label, cls='text-link') => `<a class="${cls}" href="#${page}">${label} <span aria-hidden="true">↗</span></a>`;
const brand = `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M9 20.5l7 7L31 12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 11h6M24 29h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><span>зачёт<span class="brand-dot">.</span></span>`;

function gradeSummary() {
  const average = data.grades.length ? Math.round(data.grades.reduce((sum, grade) => sum + grade.points, 0) / data.grades.length) : 0;
  const passed = data.grades.filter(grade => grade.result === 'Зачтено').length;
  const next = [...data.grades].sort((a,b) => a.date.localeCompare(b.date))[0];
  return {average, passed, next};
}

function icsEscape(value) {
  return String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/([,;])/g,'\\$1');
}
function icsFold(line) {
  let output = '', segment = '', bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) { output += segment + '\r\n '; segment = ''; bytes = 1; }
    segment += char; bytes += size;
  }
  return output + segment;
}
function downloadCalendar(scope) {
  const days = scope === 'week' ? data.week : [data.week[day]];
  if (!days.some(item => item.lessons.length)) return flash('На выбранный день занятий нет.');
  const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const events = days.flatMap(d => d.lessons.map((lesson,index) => {
    const date = d.date.replaceAll('-','');
    const start = lesson.start.replace(':','') + '00';
    const end = lesson.end.replace(':','') + '00';
    return ['BEGIN:VEVENT',`UID:${encodeURIComponent(lesson.title)}-${date}-${index}@campus-demo`,
      `DTSTAMP:${stamp}`,`DTSTART;TZID=Europe/Moscow:${date}T${start}`,`DTEND;TZID=Europe/Moscow:${date}T${end}`,
      `SUMMARY:${icsEscape(lesson.title)}`,`DESCRIPTION:${icsEscape(`${lesson.type} · ${lesson.teacher}${lesson.change ? ` · ${lesson.change}` : ''}`)}`,
      `LOCATION:${icsEscape(lesson.room)}`,'END:VEVENT'].join('\r\n');
  }));
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Campus//Student Schedule//RU','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'BEGIN:VTIMEZONE','TZID:Europe/Moscow','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0300','TZOFFSETTO:+0300','TZNAME:MSK','END:STANDARD','END:VTIMEZONE',
    ...events.flatMap(event => event.split('\r\n')),'END:VCALENDAR'];
  const calendar = lines.map(icsFold).join('\r\n');
  const url = URL.createObjectURL(new Blob([calendar],{type:'text/calendar;charset=utf-8'}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `kampus-${scope==='week'?'week':days[0].date}.ics`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  flash(`Выгружено занятий: ${events.length}. Файл можно импортировать в календарь.`);
}

async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? {} : {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('Не удалось получить ответ сервера. Попробуй ещё раз.'); }
  if (!response.ok) throw Object.assign(new Error(result.error), {status:response.status});
  return result;
}
function flash(message) {
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 4600);
}
function page() {
  const key = location.hash.slice(1);
  return Object.hasOwn(paths, key) ? key : 'home';
}
function heading(index, title, description) {
  return `<div class="page-heading"><p class="eyebrow">ЗАЧЁТ / ${index}</p><h1>${title}</h1><p class="lede">${description}</p></div>`;
}
function section(title, extra='') {
  return `<div class="section-head"><h2>${title}</h2>${extra}</div>`;
}
function lessonRows(lessons) {
  if (!lessons.length) return '<p class="empty">На этот день занятий нет.</p>';
  return `<ul class="rows lessons">${lessons.map((l,i) => `<li class="lesson">
    <div class="times mono"><strong>${l.start}</strong><span>${l.end}</span></div>
    <div class="lesson-info tone-${i%3}"><h3>${escape(l.title)}</h3><p>${escape(l.type)} · ${escape(l.teacher)}</p></div>
    <div class="room"><strong>${escape(l.room)}</strong>${l.change ? `<span class="tag orange">${escape(l.change)}</span>` : ''}</div>
  </li>`).join('')}</ul>`;
}
function noticeRows(notices, condensed=false) {
  return `<ul class="rows notices">${notices.map((n,i) => `<li>
    <div class="notice-meta"><span class="tag ${['orange','blue','green'][i%3]}">${escape(n.tag)}</span>${n.read ? '' : '<span class="dot" aria-label="Новое"></span>'}</div>
    <h3>${escape(n.title)}</h3><p>${escape(n.body)}</p>
    ${!condensed && !n.read ? `<button class="text-link" data-read="${escape(n.id)}">Отметить прочитанным</button>` : ''}
  </li>`).join('')}</ul>`;
}
function home() {
  const profile = data.profile;
  const stats = gradeSummary();
  return `<section class="hero">
    <div class="hero-copy"><p class="eyebrow"><span class="dot"></span> УЧЁБА · ${escape(profile.group_name)}</p>
    <h1>Привет, <em>${escape(profile.name.split(' ')[0])}.</em></h1>
    <p class="lede">Твой учебный день в одном месте. Здесь пары, оценки, справки и всё, что изменилось.</p>
    ${link('schedule','Моё расписание','button primary')}</div>
    <figure><img src="/print.svg" alt="Иллюстрация учебного блокнота"><figcaption>ЗАМЕТКИ О ТВОЕЙ УЧЁБЕ</figcaption></figure>
  </section>
  <div class="overview-label"><div><p class="eyebrow">ТВОЯ УЧЁБА</p><h2>Всё важное — рядом</h2></div><p>Коротко о твоём учебном дне</p></div>
  <div class="quick">
    ${[['schedule','Пар сегодня',data.week[0].lessons.length],['grades','Средний балл',stats.average],['grades','Зачтено',`${stats.passed}/${data.grades.length}`],['requests','Заявки',data.requests.length]].map(([key,label,value],i) => `<a href="#${key}" class="quick-item tone-${i%3}"><span class="mono">${label}</span><strong>${value}</strong><span class="quick-arrow" aria-hidden="true">↗</span></a>`).join('')}
  </div>
  <div class="columns">
    <section class="content-card">${section('Сегодня', link('schedule','Вся неделя'))}${lessonRows(data.week[0].lessons)}</section>
    <section class="content-card">${section('На заметку', link('notices','Все'))}${noticeRows(data.notices.slice(0,2),true)}</section>
  </div>
  <aside class="assistant-banner"><div><p class="eyebrow">ПОМОЩНИК РЯДОМ</p><h2>Спроси помощника</h2><p>Подскажет, где пара и что нужно сдать на неделе.</p></div>${link('assistant','Открыть','button secondary')}</aside>`;
}
function schedule() {
  const current = data.week[day];
  return heading('02','Расписание','Пары, преподаватели и изменения на ближайшие семь дней.') + `
  <div class="week" aria-label="Дни недели">${data.week.map((d,i) => `<button data-day="${i}" aria-pressed="${i===day}"><span class="mono">${formatDate(d.date,{weekday:'short'})}</span><strong>${formatDate(d.date,{day:'numeric'})}</strong></button>`).join('')}</div>
  <div class="calendar-actions"><p class="mono muted">Время указано по Москве</p><div><button class="button secondary" data-calendar="day">Скачать этот день <span aria-hidden="true">↓</span></button><button class="button secondary" data-calendar="week">Добавить неделю в календарь <span aria-hidden="true">↓</span></button></div></div>
  <section>${section(day===0 ? 'Сегодня' : formatDate(current.date,{weekday:'long',day:'numeric',month:'long'}), `<span class="mono muted">${shortDate(current.date)}</span>`)}${lessonRows(current.lessons)}</section>`;
}
function grades() {
  const {average,passed,next} = gradeSummary();
  if (!data.grades.length) return heading('03','Успеваемость','Текущие баллы и даты экзаменов и зачётов.') + '<p class="empty">Оценок пока нет. Они появятся здесь, когда их опубликуют.</p>';
  const top = [...data.grades].sort((a,b) => b.points-a.points)[0];
  return heading('03','Успеваемость','Текущие баллы и даты экзаменов и зачётов.') + `
  <div class="grade-overview"><article><span class="mono">СРЕДНИЙ ТЕКУЩИЙ БАЛЛ</span><strong>${average}<small>/100</small></strong><p>Среднее арифметическое, без весов дисциплин</p></article><article><span class="mono">ЗАЧТЕНО</span><strong>${passed}<small>/${data.grades.length}</small></strong><p>Ближайший контроль · ${shortDate(next.date)}</p></article><article><span class="mono">СИЛЬНАЯ ДИСЦИПЛИНА</span><strong class="grade-best">${escape(top.title)}</strong><p>${top.points} из 100 · ${escape(top.assessment.toLowerCase())}</p></article></div>
  <section>${section('Баллы и даты контроля')}<ul class="rows grades">${data.grades.map(g=>`<li><div class="grade-course"><h3>${escape(g.title)}</h3><p>${escape(g.assessment)} · ${shortDate(g.date)}</p><progress aria-label="${escape(g.title)}: ${g.points} из 100 баллов" max="100" value="${g.points}">${g.points}%</progress></div><span class="tag ${g.result==='Зачтено'?'green':'orange'}">${escape(g.result)}</span><strong class="grade">${g.points}<small>/100</small></strong></li>`).join('')}</ul></section>`;
}
function requests() {
  return heading('04','Заявки и справки','Закажи справку или напиши в деканат. Статусы сохраняются в истории.') + `
  <div class="columns forms">
  <section class="content-card">${section('Новая заявка')}<form id="request-form">
    <label for="kind">Тип заявки</label><select id="kind" name="kind">${kinds.map(k=>`<option>${k}</option>`).join('')}</select>
    <label for="note">Комментарий <span class="muted">(необязательно)</span></label><textarea name="note" id="note" maxlength="1000" rows="3" placeholder="Например, нужна справка для стажировки"></textarea>
    <button class="button primary">Отправить заявку <span aria-hidden="true">↗</span></button><p class="form-error" role="alert"></p>
  </form></section>
  <section class="content-card">${section('История')}${data.requests.length ? `<ul class="rows history">${data.requests.map(r=>`<li><p class="mono muted">№ ${escape(r.id.slice(0,6))} · ${shortDate(r.created)}</p><h3>${escape(r.kind)}</h3>${r.note ? `<p>${escape(r.note)}</p>` : ''}<span class="tag blue">${escape(r.status)}</span></li>`).join('')}</ul>` : '<p class="empty">Заявок пока нет. После отправки они появятся здесь.</p>'}</section></div>`;
}
function assistant() {
  return heading('06','Помощник','Спроси о парах, сроках, сессии или справках.') + `
  <section class="chat content-card"><div class="section-head"><h2>Беседа</h2><span class="tag blue">${data.ai_live?'ИИ подключён':'Справочный режим'}</span></div>
  <div class="messages" role="log" aria-label="Сообщения помощника" aria-relevant="additions text" aria-live="polite" aria-busy="${busy}">${messages.length ? messages.map(m=>`<div class="message ${m.from}"><span class="mono">${m.from==='user'?'ТЫ':'ЗАЧЁТ'}</span><p>${escape(m.text)}</p></div>`).join('') : '<p class="empty">Привет! С чего начнём?</p>'}</div>
  <div class="suggestions">${questions.map((q,i)=>`<button class="chip" data-question="${i}" ${busy?'disabled':''}>${q}</button>`).join('')}</div>
  <form id="assistant-form"><label for="question">Твой вопрос</label><div class="chat-input"><input id="question" name="question" maxlength="500" required placeholder="Например, что у меня завтра?" ${busy?'disabled':''}><button class="button primary" ${busy?'disabled':''}>${busy?'Отвечаю…':'Отправить'} <span aria-hidden="true">↗</span></button></div></form></section>`;
}
function profile() {
  const p = data.profile;
  return heading('07','Профиль','Учебные сведения твоего аккаунта.') + `<div class="profile-card">
    <span class="avatar large" aria-hidden="true">${escape(p.name[0])}</span><h2>${escape(p.name)}</h2>
    <dl>${[['Факультет',p.faculty],['Направление',p.program],['Курс',p.year],['Группа',p.group_name]].map(([k,v])=>`<div><dt class="mono muted">${k}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl>
    <button class="button secondary" data-logout>Выйти из кабинета</button></div>`;
}
function signIn(error='') {
  app.innerHTML = `<header class="mast"><div class="frame mast-inner"><a class="brand" href="/">${brand}</a><span class="mono muted">КОНКУРСНЫЙ ПРОТОТИП</span></div></header>
  <main id="main" class="frame login"><section class="login-intro"><p class="eyebrow">ПРОСТРАНСТВО ДЛЯ УЧЁБЫ</p><h1>Учёба —<br>на <em>отлично.</em></h1><p class="lede">Расписание, оценки и деканат в одном личном кабинете.</p><img src="/print.svg" alt="Иллюстрация учебного блокнота"></section>
  <section class="login-panel">${section('Вход в кабинет')}
    <form id="login-form"><label for="login">Логин</label><input id="login" name="login" required autocomplete="username">
    <label for="password">Пароль</label><input type="password" id="password" name="password" required autocomplete="current-password">
    <button class="button primary">Войти <span aria-hidden="true">↗</span></button><p class="form-error" role="alert">${escape(error)}</p></form>
    <p class="mono demo-label">ДЕМО-АККАУНТЫ</p><div class="suggestions"><button class="chip" data-demo="alina">Войти как Алина ↗</button><button class="chip" data-demo="mark">Войти как Марк ↗</button></div>
    <p class="muted">Вымышленные учебные данные. Концепт для конкурса.</p></section></main>`;
  app.setAttribute('aria-busy','false');
}
function render() {
  if (!data) return signIn();
  const key = page();
  const content = {home,schedule,grades,requests,assistant,profile,
    notices:()=>heading('05','Уведомления','Объявления деканата, дедлайны и изменения расписания.') + noticeRows(data.notices)};
  const unread = data.notices.filter(n=>!n.read).length;
  app.innerHTML = `<header class="mast"><div class="frame mast-inner">
  <a href="#home" class="brand" aria-label="Зачёт, обзор">${brand}</a>
  <span class="mast-date mono">${formatDate(data.week[0].date,{weekday:'long',day:'numeric',month:'long'})}</span>
  <a class="mast-profile" href="#profile"><span class="avatar" aria-hidden="true">${escape(data.profile.name[0])}</span><span>${escape(data.profile.name)}</span></a>
  </div></header>
  <div class="frame layout"><aside class="sidebar"><p class="eyebrow">РАЗДЕЛЫ</p><nav aria-label="Разделы кабинета">
    ${Object.entries(paths).map(([id,[label]],i)=>`<a href="#${id}" ${id===key?'aria-current="page"':''}>${icon(id)}<span>${label}</span>${id==='notices'&&unread?`<small>${unread}</small>`:`<small>0${i+1}</small>`}</a>`).join('')}
  </nav><div class="sidebar-end mono">ЗАЧЁТ<br>КОНЦЕПТ ДЛЯ КОНКУРСА</div></aside>
  <main id="main" tabindex="-1">${content[key]()}<footer class="mono">ЗАЧЁТ · КОНКУРСНЫЙ ПРОТОТИП · ВЫМЫШЛЕННЫЕ ДАННЫЕ</footer></main></div>`;
  app.setAttribute('aria-busy','false');
}
async function login(login,password) {
  const controls = [...app.querySelectorAll('button')];
  controls.forEach(b=>b.disabled=true);
  try { data = await api('login',{login,password}); sessionVersion++; day=0; messages=[]; busy=false; location.hash='home'; render(); }
  catch(e) { app.querySelector('.form-error').textContent = e.message || 'Не удалось войти.'; }
  finally { controls.forEach(b=>b.disabled=false); }
}
async function ask(question) {
  if (!question.trim() || busy) return;
  busy=true; messages.push({from:'user',text:question.trim()}); render();
  const version = sessionVersion;
  try { const result = await api('assistant',{question:question.trim()}); if(version===sessionVersion) messages.push({from:'bot',text:result.answer}); }
  catch(e) { if(version===sessionVersion) messages.push({from:'bot',text:e.message}); }
  finally { if(version===sessionVersion) { busy=false; if(page()==='assistant') { render(); document.querySelector('#question')?.focus(); } } }
}
app.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form=event.target, fields=Object.fromEntries(new FormData(form));
  if(form.id==='login-form') return login(fields.login,fields.password);
  if(form.id==='assistant-form') return ask(fields.question);
  if(form.id==='request-form') {
    const button=form.querySelector('button'); button.disabled=true;
    const version = sessionVersion;
    try { const updated=await api('requests',fields); if(version===sessionVersion) { data=updated; render(); flash('Заявка принята. Статус в истории.'); } }
    catch(e) { form.querySelector('.form-error').textContent=e.message; }
    finally { button.disabled=false; }
  }
});
app.addEventListener('click', async (event) => {
  const button=event.target.closest('button');
  if(!button) return;
  if(button.dataset.demo) return login(button.dataset.demo,'Campus-demo-2026');
  if(button.dataset.day !== undefined) { day=Number(button.dataset.day); render(); app.querySelector(`[data-day="${day}"]`)?.focus(); }
  if(button.dataset.question !== undefined) return ask(questions[button.dataset.question]);
  if(button.dataset.calendar) return downloadCalendar(button.dataset.calendar);
  try {
    if(button.dataset.read) { const version=sessionVersion; button.disabled=true; const updated=await api('notice',{id:button.dataset.read}); if(version===sessionVersion) { data=updated; render(); flash('Уведомление прочитано.'); } }
    if(button.hasAttribute('data-logout')) { button.disabled=true; await api('logout',{}); sessionVersion++; data=null; messages=[]; busy=false; location.hash=''; render(); }
  } catch(e) { button.disabled=false; flash(e.message); }
});
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  const main = document.querySelector('#main');
  main.tabIndex = -1;
  main.focus();
});
window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0,0);
  if(data) {
    document.querySelector('#main')?.focus({preventScroll:true});
    document.querySelector('.sidebar a[aria-current]')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
});
try { data = await api('dashboard'); render(); }
catch(e) { signIn(e.status===401?'':'Не удалось связаться с сервером. Обнови страницу или попробуй войти.'); }
