import {WINGS} from './campus-geometry.js';
// Load WebGL only where it is used. Keep the ordinary plan usable without it.
let generation = 0;
let cleanups = [];
let observer;
export function syncScenes(root) {
  const current = ++generation;
  observer?.disconnect();
  cleanups.forEach((dispose) => dispose());
  cleanups = [];
  const hosts = [...root.querySelectorAll('[data-scene]')];
  if (!hosts.length) return;
  let modulePromise;
  const mount = (host) => {
    modulePromise ||= import('./scene3d.js');
    modulePromise.then(({mountScene}) => {
      if (current !== generation || !host.isConnected) return;
      try { cleanups.push(mountScene(host)); }
      catch (error) {
        host.classList.add('scene-unavailable');
        host.querySelector('[data-scene-status]').textContent = '3D недоступно. Используйте схему и список помещений.';
        console.warn('Campus 3D unavailable:', error.message);
      }
    }).catch(() => {
      if (current === generation && host.isConnected)host.querySelector('[data-scene-status]').textContent = 'Не удалось загрузить 3D. Доступна схема ниже.';
    });
  };
  observer = new IntersectionObserver((entries) => {
    for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);mount(entry.target);}
  },{rootMargin:'180px'});
  hosts.forEach((host)=>observer.observe(host));
}

const footprint = () => `<svg class="territory-fallback" viewBox="-40 -25 920 465" role="img" aria-label="Схема территории МГИМО по предоставленному изображению">${WINGS.map((wing)=>`<path fill-rule="evenodd" d="${[wing.pts,...(wing.holes||[])].map((points)=>`M${points.map((p)=>p.join(',')).join('L')}Z`).join('')}"/>${wing.id?`<text x="${wing.label[0]}" y="${wing.label[1]}">${wing.id}</text>`:''}`).join('')}</svg>`;
export const territoryScene = (compact = false, route = null) => `<section class="territory ${compact ? 'territory-compact' : ''}">
  <div class="territory-heading"><div><p class="eyebrow">Москва · Вернадского, 76</p><h2>Кампус<br>на Вернадского</h2></div>${compact ? '' : '<p>Дворы, корпуса и переходы<br>на одной объёмной схеме.</p>'}</div>
  <div class="model-view territory-view" data-scene="territory" ${route ? `data-route-building="${route.building}"` : ''}>
    ${footprint()}
    <div class="model-modes"><button type="button" data-scene-mode aria-pressed="false">Вечер</button></div>
    <div class="model-stamp"><span>МГИМО</span><small>Территория</small></div>
    <div class="scene-status" data-scene-status role="status">Собираем макет…</div>
    <button class="model-tour" data-model-action="tour" aria-pressed="false">Облёт</button>
    <div class="model-controls" role="group" aria-label="Вид макета"><button data-model-action="left" aria-label="Повернуть влево">↶</button><button data-model-action="reset" aria-label="Вернуть исходный вид">↺</button><button data-model-action="zoom-in" aria-label="Приблизить">+</button><button data-model-action="zoom-out" aria-label="Отдалить">−</button><button data-model-action="top" aria-label="Вид сверху">Вид сверху</button></div>
  </div>
  <div class="territory-bottom"><div class="wing-list" role="group" aria-label="Корпус на макете">${['А','Б','В','Г','Н'].map((id) => `<button data-wing="${id}" aria-pressed="false">${id}</button>`).join('')}</div><p class="model-description" aria-live="polite">${route ? `Путь от входа на территорию к корпусу ${route.label}${route.room ? ` · аудитория ${route.room}` : ''}` : 'Выберите корпус · потяните макет, чтобы повернуть'}</p><span class="model-source">Контуры по предоставленной схеме.<br>Высоты условные; кабинеты не нанесены.</span></div>
</section>`;
