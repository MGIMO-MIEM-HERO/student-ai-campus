// Вступление после входа: корпус издалека «подлетает» с разворотом, на карте загорается путь, а в плашке
// появляется кабинет ближайшей пары. Показывается раз за вход; Esc, клик или «Пропустить» закрывают.
import {S} from './state.js';
import {esc, mskNow, relativeDay, cap} from './util.js';
import {nextPhysicalLesson} from './schedule-navigation.js';
import {territoryRoute} from './campus-geometry.js';

const KEY = 'campusIntro';
const EASE = 'cubic-bezier(.2,.8,.2,1)';
let overlay = null, dispose = null, anims = [], autoTimer = 0, restore = [];

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };
const flag = (name) => { try { return sessionStorage.getItem(name); } catch { return null; } };

/** Сбрасывает признак «вступление уже показано» — вызывается при входе и выходе. */
export function resetIntro() { try { sessionStorage.removeItem(KEY); } catch { /* sessionStorage недоступен */ } }

export function maybeShowIntro() {
  if (overlay || flag(KEY)) return;
  // Автоматические проверки не должны упираться в экран-заставку; для ручной проверки есть campusIntroForce.
  if (navigator.webdriver && flag(`${KEY}Force`) !== '1') return;
  if (!S.data || S.data.role === 'staff' || reduced() || !hasWebGL()) return;
  const entry = nextPhysicalLesson(S.data);
  if (!entry?.lesson.building || !territoryRoute(entry.lesson.building)) return;
  try { sessionStorage.setItem(KEY, '1'); } catch { /* не страшно */ }

  const l = entry.lesson, place = String(l.place || '');
  const when = `${cap(relativeDay(entry.date, mskNow().date))}, ${l.start}`;
  const evening = flag('campusSceneMode') === 'evening' || (() => { try { return localStorage.getItem('campusSceneMode') === 'evening'; } catch { return false; } })();
  const mine = S.data.role === 'teacher' ? 'Ваше ближайшее занятие' : 'Ваша ближайшая пара';

  overlay = document.createElement('div');
  overlay.className = `intro ${evening ? 'is-evening' : ''}`;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'intro-title');
  overlay.innerHTML = `<div class="intro-sky"></div>
    <div class="model-view intro-view" data-scene="territory" data-route-building="${esc(l.building)}" data-intro="1"><div class="scene-status" data-scene-status role="status"></div></div>
    <button class="intro-skip" type="button" data-intro-close>Пропустить</button>
    <div class="intro-copy">
      <div class="intro-mask"><p class="intro-kicker">${mine} · ${esc(when)}</p></div>
      <div class="intro-mask"><h2 class="intro-title" id="intro-title">${esc(l.title)}</h2></div>
      <div class="intro-mask"><p class="intro-where">${esc(place)}${l.floor ? `, ${l.floor} этаж` : ''}</p></div>
      <div class="intro-mask"><p class="intro-hint">Путь от входа на территорию отмечен на карте.</p></div>
      <div class="intro-mask intro-actions"><button class="btn" type="button" data-intro-close data-nav-lesson="${esc(l.id)}">Показать путь</button><button class="btn ghost" type="button" data-intro-close>Продолжить</button></div>
    </div>
    <span class="intro-progress" aria-hidden="true"></span>`;
  overlay.addEventListener('click', (e) => { if (e.target.closest('[data-intro-close]')) closeIntro(); });
  overlay.addEventListener('pointerdown', () => clearTimeout(autoTimer), {once: true});
  document.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  restore = [...document.body.children].filter((el) => el !== overlay && !el.inert);
  restore.forEach((el) => { el.inert = true; });

  // Радужное раскрытие из центра.
  anims.push(overlay.animate([{clipPath: 'circle(0% at 50% 56%)'}, {clipPath: 'circle(150% at 50% 56%)'}], {duration: 1000, easing: 'cubic-bezier(.76,0,.18,1)'}));

  const host = overlay.querySelector('[data-scene]');
  import('./scene3d.js').then(({mountScene}) => {
    if (!overlay) return;
    try { dispose = mountScene(host); } catch { closeIntro(true); return; }
    whenReady(host, startTimeline);
  }).catch(() => closeIntro(true));
}

function whenReady(host, run) {
  const t0 = performance.now();
  const poll = () => { if (!overlay) return; if (host.dataset.ready === 'true' || performance.now() - t0 > 4000) run(); else setTimeout(poll, 60); };
  poll();
}

function startTimeline() {
  if (!overlay) return;
  const rise = (el, delay, dur = 900) => anims.push(el.animate([{transform: 'translateY(115%)'}, {transform: 'translateY(0)'}], {duration: dur, delay, easing: EASE, fill: 'backwards'}));
  // Сначала корпус подлетает (≈ 4 с), затем подпись с кабинетом поднимается из масок.
  overlay.querySelectorAll('.intro-copy .intro-mask > *').forEach((el, i) => rise(el, 2200 + i * 110));
  setTimeout(() => overlay?.classList.add('is-live'), 2100);
  const bar = overlay.querySelector('.intro-progress');
  anims.push(bar.animate([{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], {duration: 9000, delay: 600, easing: 'linear', fill: 'both'}));
  autoTimer = setTimeout(() => closeIntro(), 9600);
  overlay.querySelector('.intro-actions .btn')?.focus({preventScroll: true});
}

function onKey(e) {
  if (!overlay) return;
  if (e.key === 'Escape') { e.preventDefault(); closeIntro(); return; }
  clearTimeout(autoTimer);
  if (e.key === 'Tab') {
    const f = [...overlay.querySelectorAll('button')]; if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
}

export function closeIntro(immediate = false) {
  if (!overlay) return;
  clearTimeout(autoTimer);
  const el = overlay; overlay = null;
  document.removeEventListener('keydown', onKey, true);
  restore.forEach((n) => { n.inert = false; }); restore = [];
  const done = () => { dispose?.(); dispose = null; anims.forEach((a) => a.cancel()); anims = []; el.remove(); };
  if (immediate || reduced()) { done(); return; }
  const out = el.animate([{clipPath: 'inset(0 0 0 0)'}, {clipPath: 'inset(0 0 100% 0)'}], {duration: 800, easing: 'cubic-bezier(.76,0,.18,1)', fill: 'forwards'});
  out.onfinish = done;
}
