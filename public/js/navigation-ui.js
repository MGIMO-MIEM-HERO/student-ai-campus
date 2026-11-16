import {S} from './state.js';
import {esc,dayLong,mskNow,toMin} from './util.js';
import {currentRoute,mapDate,roomByKey} from './campus.js';
import {scheduleEntries,nextPhysicalLesson,findNavigationLesson,roomKey} from './schedule-navigation.js';

function lessonStatus(l,date) {
  const t=mskNow();
  if(l.cancelled)return 'Отменено';if(l.format==='Онлайн')return 'Онлайн';
  if(date<t.date||date===t.date&&toMin(l.end)<=t.minutes)return 'Завершено';
  if(date===t.date&&toMin(l.start)<=t.minutes)return 'Идёт сейчас';return 'Впереди';
}
export function navigationCaption() {
  const entry=findNavigationLesson(S.data,S.routeLesson),route=currentRoute();
  if(!S.room)return '';
  const segment=route?.segments.find((s)=>s.floor===S.floor);
  return `<div class="navigation-map-caption" aria-live="polite">${entry?`<strong>${esc(entry.lesson.title)} · ${esc(entry.lesson.start)}–${esc(entry.lesson.end)}</strong><span>${esc(dayLong(entry.date))} · ${esc(entry.lesson.teacher?.short||S.data.profile.name)} · ${esc(entry.lesson.place)}</span>`:''}${S.routeNotice?`<span>${esc(S.routeNotice)}</span>`:''}${segment?`<span>${segment.kind==='departure'?'От начальной точки к лифту':`К двери аудитории ${esc(route.target.room)}`} · ${segment.floor} этаж</span>`:''}<button class="link" data-route-summary>Начало и этапы маршрута ↑</button></div>`;
}
export function navigationPanel() {
  const entries=scheduleEntries(S.data),date=mapDate(),today=mskNow().date,next=nextPhysicalLesson(S.data);
  const days=[...new Set([date,...(S.data.schedule||[]).map((d)=>d.date)])].sort();
  const lessons=entries.filter((e)=>e.date===date),chosen=findNavigationLesson(S.data,S.routeLesson),target=roomByKey(S.room),route=currentRoute();
  const active=chosen?.lesson;
  return `<section class="navigation-panel" id="navigation" aria-labelledby="navigation-title">
    <div class="navigation-top"><div><p class="eyebrow">Ваше расписание и маршрут</p><h2 id="navigation-title">${target?`До аудитории ${esc(target.building)}-${esc(target.room)}`:'Куда на следующую пару?'}</h2></div>${next?`<button class="btn sm" data-route-next>К следующей паре</button>`:''}</div>
    <label class="navigation-date" for="map-date">День на карте<select id="map-date">${days.map((d)=>`<option value="${d}" ${d===date?'selected':''}>${esc(dayLong(d))}${d===today?' · сегодня':''}</option>`).join('')}</select></label>
    <div class="navigation-lessons" aria-label="Ваши пары на выбранный день">${lessons.length?lessons.map(({lesson:l,date})=>{
      const physical=!l.cancelled&&l.format!=='Онлайн'&&roomKey(l)&&roomByKey(roomKey(l));
      return `<button class="navigation-lesson ${S.routeLesson===l.id?'on':''}" data-nav-lesson="${esc(l.id)}" ${physical?'':'disabled'} aria-pressed="${S.routeLesson===l.id}"><span><b>${esc(l.start)}–${esc(l.end)}</b><small>${l.pair} пара · ${lessonStatus(l,date)}</small></span><span><strong>${esc(l.title)}</strong><small>${esc(l.teacher?.short||S.data.profile.name)} · ${l.format==='Онлайн'?'Онлайн':esc(l.place)}${l.change&&!l.cancelled?' · '+esc(l.change.label):''}</small></span></button>`;
    }).join(''):'<p class="small muted">На этот день пар нет. Можно выбрать кабинет в поиске ниже.</p>'}</div>
    ${active?`<div class="navigation-context" data-navigation-lesson="${esc(active.id)}"><b>${esc(active.title)}</b><span>${esc(dayLong(chosen.date))} · ${esc(active.start)}–${esc(active.end)} · ${active.pair} пара</span><span>${esc(active.teacher?.name||S.data.profile.name)} · ${esc(active.place)}</span>${active.change?`<span class="navigation-change">${esc(active.change.label)}: ${esc(active.change.was||'')} → ${esc(active.change.now||active.change.reason||'')}</span>`:''}</div>`:''}
    ${S.routeNotice?`<p class="navigation-notice" role="status">${esc(S.routeNotice)}</p>`:''}
    ${target&&!S.routeBlocked?`<div class="navigation-origin"><label for="route-origin">Откуда идти<select id="route-origin"><option value="entry" ${S.routeOrigin==='entry'?'selected':''}>Главный вход · корпус ${esc(target.building)}</option><option value="lift" ${S.routeOrigin==='lift'?'selected':''}>От лифта на ${target.floor} этаже</option><optgroup label="От другой аудитории">${S.data.campus.rooms.filter((r)=>r.building===target.building).map((r)=>`<option value="${esc(r.key)}" ${S.routeOrigin===r.key?'selected':''}>${esc(r.room)} · ${r.floor} этаж</option>`).join('')}</optgroup></select></label></div>`:''}
    ${route?route.arrived?'<p class="small">Начальная и конечная аудитории совпадают — переход не нужен.</p>':`<div class="navigation-stages" role="group" aria-label="Этапы маршрута">${route.segments.map((s,i)=>`<button data-route-floor="${s.floor}" aria-pressed="${S.floor===s.floor}"><b>${i+1}</b><span>${s.floor} этаж<small>${s.kind==='departure'?'К лифту':esc(s.end)}</small></span></button>`).join('')}</div>
    <ol class="navigation-steps"><li>Начните от точки «${esc(route.originName)}».</li>${route.segments.length>1?`<li>Пройдите по линии до лифта на ${route.startFloor} этаже. ${target.floor>route.startFloor?'Поднимитесь':'Спуститесь'} на ${target.floor} этаж.</li>`:''}<li>Следуйте по синей линии по коридорам до отмеченной двери аудитории ${esc(target.room)}.</li></ol><p class="cap">Круг — начало участка, метка — его конец. Маршрут по проектной схеме корпуса.</p>`:target&&!S.routeBlocked?'<p class="small">Для этой точки пока не удалось построить маршрут.</p>':'<p class="small muted">Выберите пару выше или аудиторию в поиске — маршрут появится на 3D-карте и плане.</p>'}
  </section>`;
}
