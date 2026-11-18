// «Стопка дедлайнов» на странице «Задания»: ближайшие сроки — большими карточками, которые при прокрутке
// прилипают к верху и складываются стопкой; накрытая карточка чуть уменьшается и уходит вглубь.
import {esc} from './util.js';

/** items: [{id, course, title, kind, when, days, overdue}] — уже отсортированы по сроку. */
export function deadlineStack(items) {
  if (!items.length) return '';
  const tone = (it) => it.overdue ? 'late' : it.days <= 1 ? 'soon' : 'later';
  const badge = (it) => it.overdue ? 'Просрочено' : it.days === 0 ? 'Сегодня' : it.days === 1 ? 'Завтра' : `Через ${it.days} дн.`;
  return `<section class="dl-stack" data-dlstack aria-label="Ближайшие сроки">
    <div class="dl-head"><h2>Ближайшие сроки</h2><span>${items.length} ${items.length === 1 ? 'задание' : items.length < 5 ? 'задания' : 'заданий'} · прокрутите, карточки сложатся стопкой</span></div>
    ${items.map((it, i) => `<article class="dl-card ${tone(it)}" data-dl-card data-vars="--i:${i}">
      <div class="dl-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="dl-main"><span class="dl-course">${esc(it.course)} · ${esc(it.kind)}</span><strong>${esc(it.title)}</strong><span class="dl-when">Срок: ${esc(it.when)}</span></div>
      <div class="dl-side"><span class="dl-badge">${badge(it)}</span><button class="btn ghost sm" data-task="${esc(it.id)}">Открыть</button></div>
    </article>`).join('')}</section>`;
}

/** Масштаб накрытых карточек считается по прокрутке; без движения — обычная стопка без эффекта. */
export function mountDeadlineStack(root) {
  const host = root.querySelector('[data-dlstack]');
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const cards = [...host.querySelectorAll('[data-dl-card]')];
  let raf = 0;
  const update = () => {
    raf = 0;
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) { card.style.setProperty('--dl-s', '1'); card.style.setProperty('--dl-dim', '0'); return; }
      const a = card.getBoundingClientRect(), b = next.getBoundingClientRect();
      // 0 — следующая карточка ещё далеко, 1 — полностью накрыла текущую.
      const k = Math.min(1, Math.max(0, 1 - (b.top - a.top) / Math.max(1, a.height)));
      const depth = cards.length - 1 - i;
      card.style.setProperty('--dl-s', String(1 - k * Math.min(.12, .04 * depth + .02)));
      card.style.setProperty('--dl-dim', String(k * .5));
    });
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', onScroll, {passive: true}); addEventListener('resize', onScroll);
  update();
  return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
}
