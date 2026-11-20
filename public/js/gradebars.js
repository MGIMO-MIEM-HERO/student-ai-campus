// Шкалы баллов с вкладками («Учёба»): полосы вырастают по очереди, на шкале — пороги 60/75/90.
// При смене вкладки данные меняются сразу; первое появление анимируется по оси X.
import {S} from './state.js';
import {esc} from './util.js';

const TABS = [
  {id: 'points', label: 'Баллы', marks: [[60, 'допуск'], [75, 'хорошо'], [90, 'отлично']], unit: ''},
  {id: 'att', label: 'Посещаемость', marks: [[75, 'норма']], unit: '%'},
  {id: 'gap', label: 'До цели', marks: [], unit: ''},
];
let current = 'points';

/** Следующая цель по шкале и сколько до неё не хватает. */
function goal(g) {
  if (g.points < 60) return {to: 60, name: 'допуска'};
  if (g.assessment === 'Зачёт') return g.points >= 85 ? null : {to: 85, name: 'зачёта автоматом'};
  if (g.points < 75) return {to: 75, name: '«хорошо»'};
  if (g.points < 90) return {to: 90, name: '«отлично»'};
  return null;
}

function rows(tab) {
  const att = S.data.attendance || {};
  return S.data.grades.map((g) => {
    const short = g.title;
    if (tab === 'points') return {title: short, full: g.title, value: g.points, text: `${g.points}`, low: g.points < 60};
    if (tab === 'att') {
      const a = att[g.course]?.att;
      return {title: short, full: g.title, value: a ?? 0, text: a === null || a === undefined ? 'нет данных' : `${a}%`, low: a !== null && a !== undefined && a < 75};
    }
    const target = goal(g);
    return target
      ? {title: short, full: g.title, value: g.points, from: g.points, to: target.to, text: `+${target.to - g.points} до ${target.name}`, low: g.points < 60}
      : {title: short, full: g.title, value: g.points, text: 'цель достигнута', done: true};
  });
}

function bodyHtml(tab) {
  const t = TABS.find((x) => x.id === tab);
  return `<div class="gb-scale" aria-hidden="true">${[0, 25, 50, 75, 100].map((v) => `<span data-vars="--x:${v}%">${v}</span>`).join('')}</div>
    <ul class="gb-rows">${rows(tab).map((r, i) => `<li class="gb-row ${r.low ? 'low' : ''} ${r.done ? 'done' : ''}">
      <span class="gb-name" title="${esc(r.full)}">${esc(r.title)}</span>
      <span class="gb-track" role="img" aria-label="${esc(r.full)}: ${esc(r.text)}">
        ${t.marks.map(([v, name]) => `<i class="gb-mark" data-vars="--x:${v}%"><b>${name}</b></i>`).join('')}
        <span class="gb-bar" data-i="${i}" data-vars="--v:${Math.max(0, Math.min(100, r.value))}%"></span>
        ${r.to ? `<span class="gb-gap" data-i="${i}" data-vars="--from:${r.from}%;--to:${r.to}%"></span>` : ''}
      </span>
      <span class="gb-val">${esc(r.text)}</span></li>`).join('')}</ul>`;
}

export function gradeBarsSection() {
  if (!S.data?.grades?.length) return '';
  return `<section class="sec gradebars" data-gradebars>
    <div class="sec-head"><h2>Шкалы по дисциплинам</h2>
      <div class="gb-tabs" role="tablist" aria-label="Что показать">${TABS.map((t) => `<button role="tab" id="grade-tab-${t.id}" aria-controls="grade-panel" data-gb-tab="${t.id}" aria-selected="${t.id === current}" tabindex="${t.id === current ? 0 : -1}">${t.label}</button>`).join('')}<span class="gb-ind" aria-hidden="true"></span></div></div>
    <div class="card gb-body" role="tabpanel" id="grade-panel" aria-labelledby="grade-tab-${current}" data-gb-body>${bodyHtml(current)}</div>
    <p class="cap">Пороги: 60 — допуск, 75 — «хорошо», 90 — «отлично»; для зачёта автоматом нужно 85. Посещаемость ниже 75% отмечена. Данные демонстрационные.</p></section>`;
}

const setVars = (root) => root.querySelectorAll('[data-vars]').forEach((el) => el.dataset.vars.split(';').forEach((pair) => {
  const [k, v] = pair.split(':'); if (k && v !== undefined) el.style.setProperty(k.trim(), v.trim());
}));

/** Подключает вкладки и проигрывает появление полос; возвращает функцию очистки. */
export function mountGradeBars(root) {
  const host = root.querySelector('[data-gradebars]');
  if (!host) return () => {};
  const body = host.querySelector('[data-gb-body]'), ind = host.querySelector('.gb-ind');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let anims = [], observer;
  const moveInd = () => {
    const tab = host.querySelector(`[data-gb-tab="${current}"]`);
    if (!tab || !ind) return;
    ind.style.width = `${tab.offsetWidth}px`; ind.style.transform = `translateX(${tab.offsetLeft}px)`;
  };
  const play = () => {
    anims.forEach((a) => a.cancel()); anims = [];
    if (reduced.matches) return;
    body.querySelectorAll('.gb-bar,.gb-gap').forEach((el) => {
      const i = Number(el.dataset.i) || 0, gap = el.classList.contains('gb-gap');
      anims.push(el.animate([{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}],
        {duration: gap ? 650 : 900, delay: i * 70 + (gap ? 700 : 0), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards'}));
    });
    body.querySelectorAll('.gb-val').forEach((el, i) => {
      anims.push(el.animate([{transform: 'translateY(110%)'}, {transform: 'translateY(0)'}],
        {duration: 600, delay: 250 + i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards'}));
    });
  };
  const onClick = (e) => {
    const tab = e.target.closest('[data-gb-tab]');
    if (!tab || tab.dataset.gbTab === current) return;
    current = tab.dataset.gbTab;
    host.querySelectorAll('[data-gb-tab]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.gbTab === current)); b.tabIndex = b.dataset.gbTab === current ? 0 : -1; });
    body.innerHTML = bodyHtml(current);
    body.setAttribute('aria-labelledby', `grade-tab-${current}`);
    setVars(body); moveInd();
  };
  const onKey = (e) => {
    const focused = e.target.closest('[data-gb-tab]');
    if (!focused || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const ids = TABS.map((t) => t.id), next = ids[(ids.indexOf(focused.dataset.gbTab) + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    host.querySelector(`[data-gb-tab="${next}"]`)?.focus(); host.querySelector(`[data-gb-tab="${next}"]`)?.click();
  };
  host.addEventListener('click', onClick); host.addEventListener('keydown', onKey);
  setVars(host); requestAnimationFrame(moveInd);
  // Полосы вырастают, когда блок впервые показался на экране.
  observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) { play(); observer.disconnect(); } }, {threshold: .25});
  observer.observe(body);
  const ro = new ResizeObserver(moveInd); ro.observe(host);
  return () => { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); observer.disconnect(); ro.disconnect(); anims.forEach((a) => a.cancel()); };
}
