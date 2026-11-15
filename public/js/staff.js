import {S} from './state.js';
import {icon} from './icons.js';
import {esc, dayShort, stamp} from './util.js';
import {head, secHead, empty, statusTag} from './student.js';
import {headObj} from './objects.js';
import {building3d, legend3d, pairChips, buildingSeg, activePair, roomByKey, roomState, freeRooms, roomsDayNote, roomsIsToday} from './campus.js';

export const NAV = [['queue', 'Заявки', 'requests'], ['rooms', 'Аудитории', 'building'], ['announce', 'Объявления', 'megaphone'], ['profile', 'Профиль', 'user']];
export const ROUTES = ['queue', 'rooms', 'announce', 'profile'];
const isActive = (r) => !['Выдана', 'Отклонена'].includes(r.status);
export const activeCount = () => S.data.requests.filter(isActive).length;

const history = (events) => (events?.length ? `<details class="hist"><summary>История изменений · ${events.length}</summary><ol>${events.map((e) => `<li><strong>${esc(e.status)}</strong><p>${esc(stamp(e.at))} · ${esc(e.author)}</p>${e.comment ? `<p>${esc(e.comment)}</p>` : ''}</li>`).join('')}</ol></details>` : '');
export function viewQueue() {
  const all = S.data.requests, active = all.filter(isActive), list = S.queueFilter === 'active' ? active : all;
  const n = (s) => all.filter((r) => r.status === s).length;
  return `<div class="page">${head('Кабинет деканата', 'Заявки студентов', 'Смена статуса и комментарий сразу видны студенту. При статусе «Готова» формируется электронный документ с QR-проверкой.', headObj('folder'))}
    <section class="stats" aria-label="Заявки"><div class="stat"><span class="num">${n('Принята')}</span><span class="l">новых</span></div><div class="stat"><span class="num">${n('В работе')}</span><span class="l">в работе</span></div><div class="stat"><span class="num">${n('Готова')}</span><span class="l">ждут выдачи</span></div><div class="stat"><span class="num">${all.length}</span><span class="l">всего заявок</span></div></section>
    <div class="chips"><button class="chip" data-qfilter="active" aria-pressed="${S.queueFilter === 'active'}">Активные · ${active.length}</button><button class="chip" data-qfilter="all" aria-pressed="${S.queueFilter === 'all'}">Все · ${all.length}</button></div>
    ${list.length ? `<div class="queue">${list.map((r) => `<article class="card"><div class="stack">
      <div class="row"><div><h3>${esc(r.kind)}</h3><span class="cap">№ ${esc(r.id.slice(0, 6).toUpperCase())} · ${dayShort(r.created)} · ${esc(r.student)}, ${esc(r.group_name)}</span></div>${statusTag(r.status)}</div>
      ${r.note ? `<p class="small muted">Комментарий студента: ${esc(r.note)}</p>` : ''}${r.document ? `<p class="small"><span class="tag mint">Электронный документ выпущен</span> код ${esc(r.document.code)}</p>` : ''}
      <form class="status-form" data-request="${esc(r.id)}"><label for="st-${esc(r.id)}">Новый статус</label>
        <select id="st-${esc(r.id)}" name="status">${S.data.statuses.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <label for="cm-${esc(r.id)}">Комментарий студенту <span class="muted">(необязательно)</span></label>
        <input id="cm-${esc(r.id)}" name="comment" maxlength="600" placeholder="Например: оригинал можно получить в ауд. 112 с 10:00 до 17:00">
        <p class="form-error" role="alert"></p><div><button class="btn sm">Сохранить</button></div></form>${history(r.events)}</div></article>`).join('')}</div>` : empty('check', 'Активных заявок нет', 'Новые заявки появятся здесь сразу после отправки студентом.')}</div>`;
}
export function viewStaffRooms() {
  const pair = activePair(), r = roomByKey(S.room), st = r ? roomState(S.room, pair) : null;
  const free = freeRooms(pair, S.bld), total = S.data.campus.rooms.filter((x) => x.building === S.bld && x.seats).length;
  const b = S.data.campus.buildings.find((x) => x.id === S.bld);
  const form = r && r.seats ? `<section class="card"><div class="stack"><div class="row"><div><p class="eyebrow">Корпус ${esc(r.building)} · ${r.floor} этаж</p><p class="title">Аудитория ${esc(r.room)}</p></div><span class="tag ${st.cls === 'free' ? 'mint' : st.cls === 'staff' ? 'papaya' : ''}">${st.cls === 'free' ? 'Свободна' : 'Занята'} · ${pair} пара</span></div>
      <p class="small">${esc(r.kind)}, ${r.seats} мест. ${st.cls === 'free' ? '' : esc(st.text) + '.'}</p>
      <form id="room-form" data-building="${esc(r.building)}" data-room="${esc(r.room)}"><label for="rm-state">Отметка</label>
        <select id="rm-state" name="state"><option value="busy">Занята</option><option value="free">Свободна (снять занятость)</option><option value="auto">По расписанию (убрать отметку)</option></select>
        <label for="rm-scope">Период</label><select id="rm-scope" name="scope"><option value="pair">Только ${pair} пара</option><option value="day">Весь день</option></select>
        <label for="rm-note">Причина <span class="muted">(видна студентам)</span></label><input id="rm-note" name="note" maxlength="120" placeholder="Например: ремонт, конференция, олимпиада">
        <p class="form-error" role="alert"></p><div><button class="btn sm">Сохранить отметку</button></div></form></div></section>`
    : `<section class="card"><div class="stack"><p class="title">Выберите аудиторию</p><p class="small muted">Нажмите на плитку на схеме, чтобы отметить аудиторию занятой или свободной. Студенты увидят изменение сразу.</p></div></section>`;
  return `<div class="page">${head('Кабинет деканата', 'Занятость аудиторий', 'Отметьте аудиторию занятой на пару или на весь день: ремонт, мероприятие, перенос. Отметка действует на показанный день.', headObj('lock'))}
    <div class="stack">${roomsDayNote()}${buildingSeg()}${pairChips(pair)}</div>
    <div class="cols"><section class="card"><div class="row"><div><p class="eyebrow">${esc(b.name)}</p><p class="title">${pair} пара: свободно ${free.length} из ${total}</p></div></div>
      <div class="b3d-wrap">${building3d(S.bld, pair, {selected: S.room})}</div><div class="rot"><button class="icon-btn flip" data-rot="-15" aria-label="Повернуть влево">${icon('arrow')}</button><span class="cap">Потяните схему, чтобы повернуть</span><button class="icon-btn" data-rot="15" aria-label="Повернуть вправо">${icon('arrow')}</button></div>${legend3d(true)}</section>
      <div class="stack lg">${form}
        <section class="card"><div class="stack"><p class="title">Отметки на сегодня</p>${S.data.marks.length ? `<ul class="marks">${S.data.marks.map((m) => `<li><span><b>${esc(m.building)}-${esc(m.room)}</b> · ${m.pair ? `${m.pair} пара` : 'весь день'} · ${m.state === 'busy' ? 'занята' : 'свободна'}${m.note ? ` · ${esc(m.note)}` : ''}<br><span class="cap">${esc(m.author)}, ${esc(stamp(m.at))}</span></span><button class="link" data-unmark="${esc(m.building)}|${esc(m.room)}|${m.pair}">Снять</button></li>`).join('')}</ul>` : '<p class="muted">Отметок нет. Занятость считается по расписанию.</p>'}</div></section></div></div></div>`;
}
export function viewAnnounce() {
  return `<div class="page">${head('Кабинет деканата', 'Объявления', 'Публикуйте новости и напоминания для всех студентов или для одной группы.')}
    <div class="cols even"><section class="card"><div class="stack"><p class="title">Новое объявление</p><form id="announce-form">
      <label for="a-tag">Тип</label><select id="a-tag" name="tag">${S.data.tags.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
      <label for="a-audience">Кому</label><select id="a-audience" name="audience"><option value="all">Всем студентам</option>${S.data.groups.map((g) => `<option value="${esc(g)}">Группе ${esc(g)}</option>`).join('')}</select>
      <label for="a-title">Заголовок</label><input id="a-title" name="title" required minlength="3" maxlength="120">
      <label for="a-body">Текст</label><textarea id="a-body" name="body" required minlength="3" maxlength="1000"></textarea>
      <p class="form-error" role="alert"></p><div><button class="btn">Опубликовать</button></div></form></div></section>
    <section class="sec">${secHead('Опубликовано')}${S.data.announcements.length ? `<div class="card"><div class="list">${S.data.announcements.map((a) => `<article class="item"><span class="ico periwinkle">${icon('megaphone')}</span><span><span class="chips"><span class="tag periwinkle">${esc(a.tag)}</span><span class="cap">${esc(stamp(a.created))} · ${a.audience === 'all' ? 'всем студентам' : `группа ${esc(a.audience)}`}</span></span><strong>${esc(a.title)}</strong><span class="sub">${esc(a.body)}</span></span><span></span></article>`).join('')}</div></div>` : empty('megaphone', 'Объявлений пока нет', 'Опубликованное появится у студентов в «Уведомлениях».')}</section></div></div>`;
}
export function viewStaffProfile() {
  const p = S.data.profile;
  return `<div class="page">${head('Профиль', 'Учётная запись')}<section class="card profile"><div class="stack"><p class="title">${esc(p.name)}</p>
    <dl><div><dt>Подразделение</dt><dd>${esc(p.faculty)}</dd></div><div><dt>Должность</dt><dd>${esc(p.program)}</dd></div><div><dt>Доступ</dt><dd>Заявки студентов, занятость аудиторий, объявления</dd></div><div><dt>Логин</dt><dd>${esc(p.login)}</dd></div></dl>
    <p class="cap">Учётная запись демонстрационная.</p><div><button class="btn ghost" data-logout>${icon('logout')}Выйти из кабинета</button></div></div></section></div>`;
}
