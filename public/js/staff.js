import {S} from './state.js';
import {icon} from './icons.js';
import {esc, dayShort, stamp, count} from './util.js';
import {head, section, empty, statusTag} from './student.js';

export const NAV = [['queue', 'Заявки', 'requests'], ['announce', 'Объявления', 'megaphone'], ['profile', 'Профиль', 'user']];
export const ROUTES = ['queue', 'announce', 'profile'];
const isActive = (r) => !['Выдана', 'Отклонена'].includes(r.status);
export const activeCount = () => S.data.requests.filter(isActive).length;

function history(events) {
  if (!events?.length) return '';
  return `<details class="hist"><summary>История изменений · ${events.length}</summary><ol>${events.map((e) => `<li><strong>${esc(e.status)}</strong><p>${esc(stamp(e.at))} · ${esc(e.author)}</p>${e.comment ? `<p>${esc(e.comment)}</p>` : ''}</li>`).join('')}</ol></details>`;
}
export function viewQueue() {
  const all = S.data.requests, active = all.filter(isActive);
  const list = S.queueFilter === 'active' ? active : all;
  const n = (s) => all.filter((r) => r.status === s).length;
  return `<div class="page">${head('Кабинет деканата', 'Заявки студентов', 'Смена статуса и комментарий сразу отображаются у студента в истории заявки.')}
    <div class="tiles"><div class="tile"><span class="v">${n('Принята')}</span><span class="l">новых</span></div><div class="tile"><span class="v">${n('В работе')}</span><span class="l">в работе</span></div><div class="tile"><span class="v">${n('Готова')}</span><span class="l">ждут выдачи</span></div></div>
    <div class="chips"><button class="chip" data-qfilter="active" aria-pressed="${S.queueFilter === 'active'}">Активные · ${active.length}</button><button class="chip" data-qfilter="all" aria-pressed="${S.queueFilter === 'all'}">Все · ${all.length}</button></div>
    <section class="card">${list.length ? `<ul class="queue">${list.map((r) => `<li>
      <div class="row"><div><h3>${esc(r.kind)}</h3><span class="hint">№ ${esc(r.id.slice(0, 6).toUpperCase())} · ${dayShort(r.created)} · ${esc(r.student)}, ${esc(r.group_name)}</span></div>${statusTag(r.status)}</div>
      ${r.note ? `<p class="small-note">Комментарий студента: ${esc(r.note)}</p>` : ''}
      <form class="status-form" data-request="${esc(r.id)}"><label for="st-${esc(r.id)}">Новый статус</label>
        <select id="st-${esc(r.id)}" name="status">${S.data.statuses.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <label for="cm-${esc(r.id)}">Комментарий студенту <span class="muted">(необязательно)</span></label>
        <input id="cm-${esc(r.id)}" name="comment" maxlength="600" placeholder="Например: документ можно получить в ауд. 112 с 10:00 до 17:00">
        <p class="form-error" role="alert"></p><button class="btn">Сохранить</button></form>${history(r.events)}</li>`).join('')}</ul>` : empty('check', 'Активных заявок нет', 'Новые заявки появятся здесь сразу после отправки студентом.')}</section></div>`;
}
export function viewAnnounce() {
  return `<div class="page">${head('Кабинет деканата', 'Объявления', 'Публикуйте новости и напоминания для всех студентов или для одной группы.')}
    <div class="grid-2 even"><section class="card">${section('Новое объявление')}<form id="announce-form">
      <label for="a-tag">Тип</label><select id="a-tag" name="tag">${S.data.tags.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
      <label for="a-audience">Кому</label><select id="a-audience" name="audience"><option value="all">Всем студентам</option>${S.data.groups.map((g) => `<option value="${esc(g)}">Группе ${esc(g)}</option>`).join('')}</select>
      <label for="a-title">Заголовок</label><input id="a-title" name="title" required minlength="3" maxlength="120">
      <label for="a-body">Текст</label><textarea id="a-body" name="body" required minlength="3" maxlength="1000" rows="4"></textarea>
      <p class="form-error" role="alert"></p><button class="btn">Опубликовать</button></form></section>
    <section class="card">${section('Опубликовано')}${S.data.announcements.length ? `<div class="list">${S.data.announcements.map((a) => `<article class="item"><span class="ico info">${icon('megaphone')}</span><span><span class="row"><span class="tag info">${esc(a.tag)}</span><span class="hint">${esc(stamp(a.created))} · ${a.audience === 'all' ? 'всем студентам' : `группа ${esc(a.audience)}`}</span></span><strong>${esc(a.title)}</strong><span class="sub">${esc(a.body)}</span></span><span></span></article>`).join('')}</div>` : empty('megaphone', 'Объявлений пока нет', 'Опубликованное появится у студентов в разделе «Уведомления».')}</section></div></div>`;
}
export function viewStaffProfile() {
  const p = S.data.profile;
  return `<div class="page">${head('Профиль', 'Учётная запись сотрудника')}<section class="card profile"><div class="row"><span class="avatar lg" aria-hidden="true">${esc(p.name[0])}</span><div><h2>${esc(p.name)}</h2><span class="hint">Логин: ${esc(p.login)}</span></div></div>
    <dl><div><dt>Подразделение</dt><dd>${esc(p.faculty)}</dd></div><div><dt>Должность</dt><dd>${esc(p.program)}</dd></div><div><dt>Доступ</dt><dd>Заявки всех студентов, публикация объявлений</dd></div></dl>
    <p class="hint">Учётная запись демонстрационная.</p></section>
    <button class="btn ghost" data-logout>${icon('logout')}Выйти из кабинета</button></div>`;
}
