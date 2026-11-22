// Демо-сервер для статической версии на GitHub Pages (там нет Python-сервера).
// Кабинеты всех демо-аккаунтов посчитаны настоящим сервером во время сборки (tools/build_pages.py),
// а изменения посетителя хранятся только в его браузере (localStorage) и поверх этих снимков
// повторяют правила server.py: заявки и смена их статуса деканатом, прочтение уведомлений,
// отметка «сдано», объявления, проверка билета и документа по QR, ответы помощника.
// Пароль в сборке не хранится: сверяется PBKDF2-хеш через WebCrypto.

const STORE = 'campusDemo';
const SESSION_TTL = 8 * 3600 * 1000;
let meta = null;

const clone = (v) => JSON.parse(JSON.stringify(v));
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const fail = (status, error) => { throw Object.assign(new Error(error), {status}); };
const bad = () => fail(400, 'Проверьте введённые данные.');
const mskNow = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16);

async function load() {
  if (!meta) {
    const response = await fetch('demo/data.json', {cache: 'no-cache'});
    if (!response.ok) fail(503, 'Не удалось загрузить демо-данные. Обновите страницу.');
    meta = await response.json();
  }
  return meta;
}

function world() {
  let w = null;
  try { w = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { w = null; }
  // Новая сборка — новые снимки: старые локальные изменения к ним не относятся.
  if (!w || w.built !== meta.built) w = {built: meta.built, session: null, reads: {}, homework: {}, requests: [], updates: {}, announcements: []};
  return w;
}
const save = (w) => { try { localStorage.setItem(STORE, JSON.stringify(w)); } catch { /* приватный режим: изменения живут до перезагрузки */ } };

function currentLogin(w) {
  if (!w.session || w.session.expires < Date.now() || !meta.accounts[w.session.login]) return null;
  return w.session.login;
}

async function pbkdf2(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: meta.iterations}, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- заявки ---------- */
function allRequests(w) {
  const staff = Object.values(meta.accounts).find((a) => a.role === 'staff');
  const base = clone(staff?.data.requests || []);
  const added = w.requests.map((r) => ({...clone(r), student: meta.accounts[r.login].name, group_name: meta.accounts[r.login].group}));
  return [...added.reverse(), ...base].map((r) => {
    const u = w.updates[r.id];
    if (u) { r.status = u.status; r.events = [...r.events, ...u.events]; if ('document' in u) r.document = u.document; }
    return r;
  });
}
const pick = (r) => ({id: r.id, kind: r.kind, note: r.note, status: r.status, created: r.created, events: r.events, document: r.document});

/* ---------- сборка кабинета ---------- */
function dashboard(w, login) {
  const acc = meta.accounts[login], d = clone(acc.data);
  const ann = w.announcements;
  if (d.role === 'student') {
    const reads = new Set(w.reads[login] || []);
    d.requests = allRequests(w).filter((r) => r.login === login).map(pick);
    const mine = ann.filter((a) => a.audience === 'all' || a.audience === acc.group)
      .map((a) => ({id: `a${a.id}`, tag: a.tag, title: a.title, body: a.body, date: a.created.slice(0, 10), read: false}));
    d.notices = [...mine.reverse(), ...d.notices].map((n) => ({...n, read: n.read || reads.has(n.id)}));
    d.notices.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const marks = w.homework[login] || {};
    d.homework = d.homework.map((h) => {
      const m = marks[h.id];
      if (!m || h.status === 'graded') return h;
      if (m.done) return {...h, status: 'done', done_at: m.at, note: m.note};
      const late = `${h.due_date}T${h.due_time}` < mskNow();
      return {...h, status: late ? 'overdue' : 'todo', done_at: null, note: ''};
    });
  } else if (d.role === 'staff') {
    d.requests = allRequests(w).sort((a, b) => {
      const ca = meta.closed.includes(a.status), cb = meta.closed.includes(b.status);
      return ca !== cb ? (ca ? 1 : -1) : a.created < b.created ? -1 : a.created > b.created ? 1 : 0;
    });
    d.announcements = [...clone(ann).reverse(), ...d.announcements];
  } else if (d.role === 'teacher') {
    d.announcements = [...clone(ann).filter((a) => a.author === acc.name).reverse(), ...d.announcements].slice(0, 20);
  }
  d.updated = mskNow();
  return d;
}

function verify(w, code) {
  if (typeof code !== 'string' || code.length < 8 || code.length > 24) return {valid: false};
  const doc = allRequests(w).find((r) => r.document?.code === code);
  if (doc) {
    const [first, second] = doc.student.split(' ');
    return {type: 'document', valid: true, kind: doc.kind, number: doc.id.slice(0, 6).toUpperCase(), issued: doc.document.issued,
      holder: second ? `${first} ${second[0]}.` : first, group: doc.group_name};
  }
  const found = meta.verify[code];
  return found && found.type === 'card' ? found : {valid: false};
}

/* ---------- помощник: те же правила, что assistant_faq.py и server.assistant_answer ---------- */
const norm = (t) => t.toLowerCase().replaceAll('ё', 'е');
const docTopic = (t) => ['справк', 'заявк', 'военкомат', 'выписк', 'обращени', 'деканат'].some((x) => norm(t).includes(x));
const has = (q, words) => words.some((x) => q.includes(x));
const dm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

function documentAnswer(question, data, history) {
  const q = norm(question);
  const prefixes = ['а сколько', 'сколько ждать', 'сколько готовится', 'а где', 'где забрать', 'а как', 'а для', 'а статус'];
  let previous = '';
  for (const message of [...history].reverse()) {
    const c = norm(message);
    if (docTopic(c)) { previous = c; break; }
    if (!prefixes.some((p) => c.startsWith(p))) break;
  }
  const followUp = prefixes.some((p) => q.startsWith(p)) && docTopic(previous);
  if (!docTopic(q) && !followUp) return null;
  const context = followUp ? `${previous} ${q}` : q;
  const kind = context.includes('выписк') ? 'Выписка об успеваемости' : context.includes('обращени') ? 'Обращение в деканат' : 'Справка об обучении';
  const doc = meta.documents.find((x) => x.kind === kind);
  const pickup = 'Оригинал готового документа можно получить в деканате по студенческому билету. Электронная версия с QR-проверкой — в истории заявки, в разделе «Заявки».';
  if (followUp && has(q, ['сколько', 'ждать', 'срок'])) return `«${kind}»: срок по каталогу кабинета — ${doc.sla}. Статус и комментарии деканата — в истории заявки.`;
  if (followUp && has(q, ['где', 'забрать']) && kind !== 'Обращение в деканат') return pickup;
  if (has(q, ['статус', 'готова ли', 'готов ли', 'где моя', 'мои заявк'])) {
    const rows = (data.requests || []).filter((r) => q.includes('мои заявк') || r.kind === kind);
    if (!rows.length) return `В вашей истории нет заявки «${kind}». Подать её можно в разделе «Заявки».`;
    return 'Ваши заявки:\n' + rows.map((r) => `• ${r.kind} № ${r.id.slice(0, 6).toUpperCase()}: ${r.status}.` + (r.document ? ' Электронный документ доступен в истории заявки.' : '')).join('\n');
  }
  if (context.includes('военкомат')) {
    return 'В каталоге кабинета для этой цели указана «Справка об обучении». Откройте «Заявки» → «Справка об обучении» → «Оформить», '
      + 'в комментарии укажите «Для военкомата» и отправьте заявку. Срок в прототипе — 1–2 рабочих дня. Электронная версия с QR-проверкой появится '
      + 'в истории заявки, оригинал можно получить в деканате по студенческому билету. Если нужен специальный бланк, уточните его через «Обращение в деканат».';
  }
  if (has(q, ['сколько', 'срок', 'долго', 'когда', 'ждать'])) return `«${kind}»: срок по каталогу кабинета — ${doc.sla}. Текущий статус и комментарии — в разделе «Заявки», в истории заявки.`;
  if (has(q, ['где забрать', 'где получить', 'оригинал']) && kind !== 'Обращение в деканат') return pickup;
  if (kind === 'Обращение в деканат') return 'Откройте «Заявки» → «Обращение в деканат» → «Оформить», опишите вопрос и отправьте. Ответ и статус будут в истории заявки. Срок по каталогу — до 5 рабочих дней.';
  return `Откройте «Заявки» → «${kind}» → «Оформить», при необходимости укажите цель в комментарии и отправьте заявку. Срок по каталогу — ${doc.sla}. Статус, комментарии и готовый электронный документ — в истории заявки.`;
}

function answer(question, data, history = []) {
  const document = documentAnswer(question, data, history);
  if (document) return document;
  const q = norm(question), today = data.today;
  const days = Object.fromEntries(data.schedule.map((d) => [d.date, d]));
  const describe = (day) => !day || !day.lessons.length ? 'Занятий нет.' : day.lessons.map((l) => {
    const mark = l.cancelled ? ' (отменено)' : '';
    const note = l.change && !l.cancelled ? ` · ${l.change.label.toLowerCase()}: ${l.change.now}` : '';
    return `• ${l.pair} пара, ${l.start}–${l.end}: ${l.title}, ${l.type.toLowerCase()}, ${l.place}${mark}${note}.`;
  }).join('\n');
  if (has(q, ['задани', 'домашк', 'дз', 'сдать', 'задал'])) {
    const active = (data.homework || []).filter((h) => h.status === 'todo' || h.status === 'overdue');
    if (!active.length) return 'Активных заданий нет. Проверенные работы с баллами — в разделе «Задания».';
    return 'Задания:\n' + active.slice(0, 6).map((h) => `• ${h.course_title}: ${h.title} — ${h.status === 'overdue' ? 'просрочено' : 'срок'} ${dm(h.due_date)}, ${h.due_time}`).join('\n');
  }
  if (q.includes('консультац')) {
    const mine = [];
    for (const t of data.teachers || []) for (const d of data.consults?.[t.key] || []) for (const s of d.slots) if (s.state === 'mine') mine.push(`• ${t.short}: ${dm(d.date)}, ${s.time}, ${d.place}`);
    if (mine.length) return 'Ваши записи:\n' + mine.join('\n');
    return 'Записаться можно из карточки преподавателя: «Сегодня» или «Учёба» → «Консультация». Часы приёма:\n' + (data.teachers || []).map((t) => `• ${t.short}: ${t.hours}`).join('\n');
  }
  if (has(q, ['сесси', 'экзамен', 'оцен', 'балл', 'зачёт', 'зачет'])) {
    return 'Контроль по дисциплинам:\n' + data.grades.map((g) => `• ${g.title}: ${g.assessment.toLowerCase()} ${dm(g.date)} в ${g.start}, ${g.place}; баллов ${g.points} из 100.`).join('\n');
  }
  if (has(q, ['дедлайн', 'срок', 'сдать'])) return answer('Какие задания?', data);
  if (has(q, ['измен', 'перенос', 'новост', 'отмен'])) {
    return data.notices.filter((n) => n.tag === 'Расписание' || n.tag === 'Дедлайн').map((n) => `• ${n.title}. ${n.body}`).join('\n') || 'Изменений нет.';
  }
  for (const [word, offset, label] of [['послезавтра', 2, 'Послезавтра'], ['завтра', 1, 'Завтра'], ['вчера', -1, 'Вчера']]) {
    if (q.includes(word)) {
      const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset);
      const iso = d.toISOString().slice(0, 10);
      return `${label}:\n` + (days[iso] ? describe(days[iso]) : 'На эту дату нет данных в расписании кабинета.');
    }
  }
  const weekdays = ['понедельник', 'вторник', 'сред', 'четверг', 'пятниц', 'суббот', 'воскресень'];
  for (const [i, name] of weekdays.entries()) {
    if (q.includes(name)) {
      const found = data.schedule.find((d) => d.date >= today && (new Date(`${d.date}T12:00:00Z`).getUTCDay() + 6) % 7 === i);
      return found ? `${found.date}:\n${describe(found)}` : 'На этот день нет данных в расписании кабинета.';
    }
  }
  if (has(q, ['пар', 'занят', 'распис', 'сегодня'])) return 'Сегодня:\n' + describe(days[today]);
  return 'Могу подсказать расписание на сегодня и завтра, задания и сроки, изменения, даты контроля, консультации и порядок заказа справки.';
}

/* ---------- обработчик запросов ---------- */
const READ_ONLY = 'В демо-версии на GitHub Pages это действие не сохраняется: оно работает в полной версии с сервером (python3 server.py). Заявки, их статусы, уведомления, отметки «Сдано» и объявления в демо доступны.';

export async function demoApi(path, body) {
  await load();
  const w = world();
  const login = currentLogin(w);
  const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;

  if (path === 'login') {
    const name = typeof body?.login === 'string' ? body.login.trim().toLowerCase().slice(0, 64) : '';
    const acc = meta.accounts[name];
    if (typeof body?.password !== 'string' || body.password.length > 128) bad();
    if (!acc || await pbkdf2(body.password, acc.salt) !== acc.hash) fail(401, 'Проверьте логин и пароль.');
    w.session = {login: name, expires: Date.now() + SESSION_TTL}; save(w);
    return dashboard(w, name);
  }
  if (path.startsWith('verify/')) return verify(w, decodeURIComponent(path.slice(7)));
  if (path === 'session') return login ? dashboard(w, login) : {anonymous: true};
  if (!login) fail(401, 'Войдите в кабинет.');
  const acc = meta.accounts[login];
  if (path === 'dashboard') return dashboard(w, login);
  if (path === 'logout') { w.session = null; save(w); return {}; }

  if (path.startsWith('staff/')) {
    if (acc.role !== 'staff') fail(403, 'Раздел доступен только сотрудникам деканата.');
    if (path.startsWith('staff/requests/')) {
      const id = path.slice('staff/requests/'.length), status = body?.status, comment = body?.comment ?? '';
      if (!meta.statuses.includes(status) || typeof comment !== 'string' || comment.length > 600) bad();
      const item = allRequests(w).find((r) => r.id === id);
      if (!item) fail(404, 'Заявка не найдена.');
      if (status === item.status && !comment.trim()) fail(400, 'Измените статус или добавьте комментарий.');
      const u = w.updates[id] || (w.updates[id] = {events: []});
      u.status = status;
      u.events.push({status, comment: comment.trim(), author: acc.name, at: mskNow()});
      if ((status === 'Готова' || status === 'Выдана') && item.kind !== meta.kinds[2] && !item.document) u.document = {code: 'd' + hex(9).slice(0, 12), issued: meta.accounts[login].data.today};
      else if (status === 'Отклонена') u.document = null;
      save(w); return dashboard(w, login);
    }
    if (path === 'staff/announcements') {
      const {tag, title, body: text_, audience} = body || {};
      if (!meta.tags.includes(tag) || !(audience === 'all' || acc.data.groups.includes(audience)) || !text(title, 3, 120) || !text(text_, 3, 1000)) bad();
      w.announcements.push({id: 100000 + w.announcements.length, tag, title: title.trim(), body: text_.trim(), audience, author: acc.name, created: mskNow()});
      save(w); return dashboard(w, login);
    }
    fail(501, READ_ONLY);
  }
  if (path.startsWith('teacher/')) {
    if (acc.role !== 'teacher') fail(403, 'Раздел доступен только преподавателям.');
    if (path === 'teacher/announce') {
      const {group, title, body: text_} = body || {};
      if (!acc.data.offerings.some((o) => o.group === group) || !text(title, 3, 120) || !text(text_, 3, 1000)) bad();
      w.announcements.push({id: 100000 + w.announcements.length, tag: meta.teacher_tags[0], title: title.trim(), body: text_.trim(), audience: group, author: acc.name, created: mskNow()});
      save(w); return dashboard(w, login);
    }
    fail(501, READ_ONLY);
  }
  if (acc.role !== 'student') fail(403, 'Этот раздел доступен только студентам.');
  const data = dashboard(w, login);
  if (path === 'requests') {
    const kind = body?.kind, note = body?.note ?? '';
    if (!meta.kinds.includes(kind) || typeof note !== 'string' || note.length > 1000) bad();
    if (kind === 'Обращение в деканат' && !note.trim()) fail(400, 'Опишите вопрос в тексте обращения.');
    const created = acc.data.today;
    w.requests.push({id: hex(8), login, kind, note: note.trim(), status: 'Принята', created, document: null,
      events: [{status: 'Принята', comment: '', author: 'Студент', at: mskNow()}]});
    save(w); return dashboard(w, login);
  }
  if (path === 'notice') {
    const known = data.notices.map((n) => n.id), id = body?.id;
    const targets = id === 'all' ? known : typeof id === 'string' && known.includes(id) ? [id] : bad();
    w.reads[login] = [...new Set([...(w.reads[login] || []), ...targets])];
    save(w); return dashboard(w, login);
  }
  if (path === 'homework') {
    const {id, done, note = ''} = body || {};
    const task = data.homework.find((h) => h.id === id);
    if (!task || typeof done !== 'boolean' || task.status === 'graded' || typeof note !== 'string' || note.length > 500) bad();
    (w.homework[login] ||= {})[id] = done ? {done: true, at: mskNow(), note: note.trim()} : {done: false};
    save(w); return dashboard(w, login);
  }
  if (path === 'assistant') {
    const question = body?.question, history = body?.history ?? [];
    if (!text(question, 1, 500) || !Array.isArray(history) || history.length > 6 || history.some((h) => !text(h, 1, 500))) bad();
    return {answer: answer(question.trim(), data, history)};
  }
  if (path === 'consult') fail(501, READ_ONLY);
  fail(404, 'Страница не найдена.');
}

/** Сбрасывает все локальные изменения демо-версии. */
export function resetDemo() { try { localStorage.removeItem(STORE); } catch { /* нет доступа к хранилищу */ } }
