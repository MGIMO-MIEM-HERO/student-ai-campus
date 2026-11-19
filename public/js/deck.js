// Режим презентации для жюри: полноэкранные слайды «Как устроен Кампус», листаются стрелками, Esc — выход.
// Смена слайда: строки текста поднимаются из своих масок, снимок раскрывается шторкой (clip-path). Без затуханий.
const SLIDES = [
  {kicker: 'Концепт · MGIMO×AI Challenge', title: 'Кампус — один кабинет для всей учёбы', text: ['Студент, преподаватель и деканат работают в одной системе: действие одного сразу видно другому.', 'Все люди и данные вымышлены, логотип университета не используется.'], img: 'student-today', cap: '«Сегодня» у студента'},
  {kicker: 'Студент', title: 'Куда идти, что сдать, что изменилось', text: ['Ближайшая пара с аудиторией и преподавателем, задания на неделю, замены «было → стало».', 'Задания сгруппированы по сроку, сдача — отметкой или ссылкой на работу.'], img: 'student-tasks', cap: '«Задания» со сроками'},
  {kicker: 'Навигация', title: '3D-кампус и путь до двери аудитории', text: ['От входа на территорию — по дорожкам к корпусу, внутри — к лифту и по коридору до двери.', 'Есть вечерний режим и «рентген» корпуса.'], img: 'student-xray', cap: 'Путь внутри корпуса'},
  {kicker: 'Учёба', title: 'Библиотека курса и шкалы баллов', text: ['Учебники по дисциплинам на 3D-полке: где взять и сколько экземпляров в демонстрационном каталоге.', 'Шкалы показывают допуск, «хорошо» и «отлично» и сколько осталось до цели.'], img: 'student-library', cap: '«Библиотека курса»'},
  {kicker: 'Преподаватель', title: 'Журнал и проверка за минуту', text: ['Посещаемость занятия с телефона, баллы и комментарии к работам, зона риска группы.', 'Перенос пары меняет расписание и уведомляет группу.'], img: 'teacher-journal', cap: 'Журнал группы'},
  {kicker: 'Безопасность', title: 'Каждый видит только своё', text: ['Пароли хранятся хэшами (scrypt), сессия — в защищённой cookie, ключей в браузере нет.', 'Строгая политика безопасности контента: никаких внешних скриптов, шрифтов и видео.'], img: 'teacher-review', cap: 'Лист проверки работы'},
  {kicker: 'Телефон', title: 'Работает с 360px', text: ['Нижняя панель, крупные кнопки, планы этажей листаются вбок.', 'Попробуйте сами: демо-аккаунты на экране входа, пароль Campus-demo-2026.'], img: 'mobile', cap: 'Кабинеты на телефоне'},
];
let overlay = null, index = 0, lastFocus = null, anims = [];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function slideHtml(s, i) {
  return `<div class="deck-copy">
      <div class="deck-mask"><p class="deck-kicker">${s.kicker}</p></div>
      <div class="deck-mask"><h2 id="deck-title">${s.title}</h2></div>
      ${s.text.map((t) => `<div class="deck-mask"><p>${t}</p></div>`).join('')}
    </div>
    <figure class="deck-shot"><img src="/assets/deck/${s.img}.webp" alt="${s.cap}" width="1200" height="796" decoding="async"><figcaption>${s.cap}</figcaption></figure>
    <div class="deck-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}<span>/ ${String(SLIDES.length).padStart(2, '0')}</span></div>`;
}

function show(i, dir = 1) {
  index = (i + SLIDES.length) % SLIDES.length;
  const stage = overlay.querySelector('[data-deck-stage]');
  anims.forEach((a) => a.cancel()); anims = [];
  stage.innerHTML = slideHtml(SLIDES[index], index);
  stage.scrollTop = 0;
  overlay.querySelectorAll('[data-deck-dot]').forEach((d, k) => d.setAttribute('aria-current', String(k === index)));
  overlay.querySelector('[data-deck-live]').textContent = `Слайд ${index + 1} из ${SLIDES.length}: ${SLIDES[index].title}`;
  if (reduced()) return;
  stage.querySelectorAll('.deck-mask > *').forEach((el, k) => anims.push(el.animate(
    [{transform: `translateY(${dir > 0 ? 110 : -110}%)`}, {transform: 'translateY(0)'}],
    {duration: 800, delay: 80 + k * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards'})));
  const shot = stage.querySelector('.deck-shot');
  anims.push(shot.animate(
    [{clipPath: dir > 0 ? 'inset(0 0 0 100% round 18px)' : 'inset(0 100% 0 0 round 18px)', transform: 'scale(.96)'}, {clipPath: 'inset(0 0 0 0 round 18px)', transform: 'scale(1)'}],
    {duration: 900, delay: 120, easing: 'cubic-bezier(.76,0,.18,1)', fill: 'backwards'}));
}

function onKey(e) {
  if (!overlay) return;
  // Глобальные сочетания кабинета (поиск «/», Ctrl/Cmd+K) не должны открываться поверх презентации.
  if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (e.key === 'Escape') { e.preventDefault(); closeDeck(); }
  else if (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.target.closest?.('button'))) { e.preventDefault(); show(index + 1, 1); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); show(index - 1, -1); }
  else if (e.key === 'Tab') {
    const f = [...overlay.querySelectorAll('button')]; const first = f[0], last = f.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

let touchX = null;
export function openDeck(start = 0) {
  if (overlay) return;
  lastFocus = document.activeElement;
  overlay = document.createElement('div');
  overlay.className = 'deck'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'deck-title');
  overlay.innerHTML = `<div class="deck-top"><span class="deck-brand">Кампус · режим презентации</span><button class="deck-btn" data-deck-close aria-label="Выйти из презентации (Esc)">Выйти · Esc</button></div>
    <div class="deck-stage" data-deck-stage></div>
    <div class="deck-bottom"><button class="deck-btn" data-deck-prev aria-label="Предыдущий слайд">←</button>
      <div class="deck-dots">${SLIDES.map((s, k) => `<button data-deck-dot="${k}" aria-label="Слайд ${k + 1}: ${s.title}"></button>`).join('')}</div>
      <button class="deck-btn" data-deck-next aria-label="Следующий слайд">→</button></div>
    <p class="deck-live" data-deck-live aria-live="polite"></p>`;
  overlay.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-deck-close')) closeDeck();
    else if (b.hasAttribute('data-deck-next')) show(index + 1, 1);
    else if (b.hasAttribute('data-deck-prev')) show(index - 1, -1);
    else if (b.dataset.deckDot !== undefined) { const k = Number(b.dataset.deckDot); show(k, k >= index ? 1 : -1); }
  });
  overlay.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, {passive: true});
  overlay.addEventListener('touchend', (e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); });
  document.body.append(overlay);
  [...document.body.children].forEach((el) => { if (el !== overlay) el.inert = true; });
  document.documentElement.classList.add('deck-open');
  document.addEventListener('keydown', onKey, true);
  show(start, 1);
  overlay.querySelector('[data-deck-next]').focus();
}

export function closeDeck() {
  if (!overlay) return;
  anims.forEach((a) => a.cancel()); anims = [];
  document.removeEventListener('keydown', onKey, true);
  [...document.body.children].forEach((el) => { el.inert = false; });
  overlay.remove(); overlay = null;
  document.documentElement.classList.remove('deck-open');
  lastFocus?.focus?.();
}

// Кнопки «Режим презентации» где угодно на сайте.
document.addEventListener('click', (e) => { if (e.target.closest('[data-deck-open]')) { e.preventDefault(); openDeck(0); } });
