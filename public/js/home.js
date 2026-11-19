// Витрины главной страницы студента: маршрут к ближайшей паре на карте, быстрые действия, билет и баллы.
// Модуль не зависит от student.js (иначе круговой импорт): всё нужное передаётся аргументами.
import {WINGS, territoryRoute, BUILDING_WING} from './campus-geometry.js';
import {icon} from './icons.js';
import {esc} from './util.js';

const pathOf = (wing) => [wing.pts, ...(wing.holes || [])].map((pts) => `M${pts.map((p) => p.join(',')).join('L')}Z`).join('');

/** Карта территории с подсвеченным корпусом и маршрутом от входа до двери корпуса. */
export function routeMapCard(next) {
  if (!next) {
    return `<section class="hm-card hm-route"><p class="hm-eyebrow">Маршрут</p><h2 class="hm-title">Ближайших пар в аудиториях нет</h2>
      <p class="hm-text">Онлайн-занятия не требуют дороги. Карту корпусов можно открыть в любой момент.</p>
      <a class="btn ghost sm" href="#rooms">${icon('building')}Корпуса и аудитории</a></section>`;
  }
  const route = territoryRoute(next.building);
  const wing = route?.wing;
  const pts = route?.points || [];
  const line = pts.map((p) => p.join(',')).join(' ');
  const end = pts.at(-1), start = pts[0];
  const mapName = wing && wing !== next.building ? ` (на схеме — ${wing})` : '';
  return `<section class="hm-card hm-route" aria-label="Маршрут к ближайшей паре">
    <div class="hm-route-head"><div><p class="hm-eyebrow">Маршрут к ближайшей паре</p><h2 class="hm-title">${esc(next.where)}</h2>
      <p class="hm-text">${esc(next.when)} · ${esc(next.title)}</p></div></div>
    <svg class="hm-map" viewBox="-40 -25 920 515" role="img" aria-label="Схема территории: путь от входа к корпусу ${esc(next.building)}${esc(mapName)}">
      <rect class="hm-lawn" x="-30" y="-15" width="900" height="465" rx="26"/>
      ${WINGS.map((w) => `<path class="hm-wing ${w.id === wing ? 'on' : ''}" fill-rule="evenodd" d="${pathOf(w)}"/>${w.id ? `<text class="hm-wing-id ${w.id === wing ? 'on' : ''}" x="${w.label[0]}" y="${w.label[1]}">${w.id}</text>` : ''}`).join('')}
      ${line ? `<polyline class="hm-route-halo" points="${line}"/><polyline class="hm-route-line" points="${line}"/>
        <circle class="hm-start" cx="${start[0]}" cy="${start[1]}" r="11"/><text class="hm-gate" x="${start[0] + 20}" y="${start[1] + 5}">Вход</text>
        <circle class="hm-end-ring" cx="${end[0]}" cy="${end[1]}" r="20"/><circle class="hm-end" cx="${end[0]}" cy="${end[1]}" r="9"/>` : ''}
    </svg>
    <div class="hm-route-foot"><ol class="hm-steps"><li>Вход на территорию</li><li>Корпус ${esc(next.building)}</li><li>${next.floor > 1 ? `Лифт на ${next.floor} этаж` : 'Первый этаж'} и коридор до двери</li></ol>
      <div class="chips"><button class="btn sm" data-nav-lesson="${esc(next.id)}">Показать путь</button><a class="btn ghost sm" href="#rooms">Все корпуса</a></div></div></section>`;
}

/** Плитки быстрых действий: то, что раньше пряталось в меню. */
export function quickActions({books, freeText, unread, ready}) {
  const t = (cls, ico, title, sub, attrs, tag = 'a') => `<${tag} class="hm-qa ${cls}" ${attrs}><span class="hm-qa-ico">${icon(ico)}</span><span class="hm-qa-copy"><strong>${title}</strong><span>${sub}</span></span></${tag}>`;
  return `<section class="hm-qas" aria-label="Быстрые действия">
    ${t('lib', 'book', 'Библиотека', `${books} учебников по вашим курсам`, 'href="#library"')}
    ${t('rooms', 'building', 'Свободные аудитории', freeText || 'Где подготовиться к паре', 'href="#rooms"')}
    ${t('card', 'user2', 'Студенческий билет', 'QR-код и проверка подлинности', 'href="#profile"')}
    ${t('doc', 'requests', 'Справка', ready ? `Готово документов: ${ready}` : 'Заказать за минуту', 'data-request-kind="Справка об обучении" type="button"', 'button')}
    ${t('news', 'news', 'Новости', 'События и статьи университета', 'href="#news"')}
    ${t('ai', 'chat', 'Помощник', unread ? `Непрочитанных уведомлений: ${unread}` : 'Ответы про учёбу и сессию', 'href="#assistant"')}</section>`;
}

/** Билет-превью: тёмная карта слегка наклонена и ведёт в профиль. */
export function idTeaser(p) {
  if (!p) return '';
  const ini = esc((p.name || '').split(' ').map((w) => w[0]).slice(0, 2).join(''));
  return `<a class="hm-card hm-id" href="#profile" aria-label="Открыть студенческий билет">
    <span class="hm-id-card" aria-hidden="true"><span class="hm-id-top"><img src="/mark.png" alt="" width="22" height="22">Кампус</span>
      <span class="hm-id-mid"><span class="hm-id-ph">${ini}</span><span><b>${esc(p.name)}</b><small>${esc(p.group_name || '')}</small></span></span><span class="hm-id-chip"></span></span>
    <span class="hm-id-copy"><p class="hm-eyebrow">Студенческий билет</p><h2 class="hm-title">Всегда под рукой</h2>
      <p class="hm-text">Электронный билет с QR-кодом: переворачивается, по коду проверяется статус обучения.</p><span class="link">Открыть билет ${icon('arrow')}</span></span></a>`;
}

/** Баллы по дисциплинам: компактные шкалы с порогами. */
export function gradeMini(grades) {
  if (!grades?.length) return '';
  const rows = [...grades].sort((a, b) => a.points - b.points).slice(0, 5);
  return `<section class="hm-card hm-grades" aria-label="Баллы по дисциплинам"><div class="hm-card-head"><div><p class="hm-eyebrow">Учёба</p><h2 class="hm-title">Баллы по дисциплинам</h2></div><a class="link" href="#study">Все шкалы ${icon('arrow')}</a></div>
    <ul class="gb-rows">${rows.map((g) => `<li class="gb-row ${g.points < 60 ? 'low' : ''}"><span class="gb-name" title="${esc(g.title)}">${esc(g.title)}</span>
      <span class="gb-track" role="img" aria-label="${esc(g.title)}: ${g.points} из 100"><i class="gb-mark" data-vars="--x:60%"></i><i class="gb-mark" data-vars="--x:90%"></i><span class="gb-bar" data-vars="--v:${Math.min(100, g.points)}%"></span></span>
      <span class="gb-val">${g.points}</span></li>`).join('')}</ul>
    <p class="hm-cap">Пунктиры — пороги допуска (60) и «отлично» (90). Сначала показаны дисциплины с наименьшими баллами.</p></section>`;
}
