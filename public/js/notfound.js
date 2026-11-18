// Страница 404 «Аудитория не найдена»: мини-план этажа, по коридору бежит пунктир к двери с номером 404,
// за которой — пустота. Ссылки ведут на главную и к «Корпусам».
import {esc} from './util.js';

export function viewNotFound(hash = '') {
  const doors = [110, 190, 270, 350, 430];
  return `<div class="page nf-page"><section class="nf">
    <svg class="nf-plan" viewBox="0 0 560 260" role="img" aria-label="План этажа: аудитории 401–405, двери 404 нет">
      <rect class="nf-shell" x="10" y="10" width="540" height="240" rx="6"/>
      ${doors.map((x, i) => `<rect class="nf-room ${i === 3 ? 'nf-gone' : ''}" x="${x - 36}" y="22" width="72" height="88" rx="3"/><text class="nf-num" x="${x}" y="72">${i === 3 ? '404' : 401 + (i > 3 ? i : i)}</text>`).join('')}
      <rect class="nf-corridor" x="22" y="118" width="516" height="34" rx="3"/>
      <rect class="nf-room" x="74" y="160" width="140" height="78" rx="3"/><rect class="nf-room" x="346" y="160" width="140" height="78" rx="3"/>
      <text class="nf-num" x="144" y="205">лифт</text><text class="nf-num" x="416" y="205">лестница</text>
      <path class="nf-route" d="M144 160V135H350V112"/>
      <circle class="nf-start" cx="144" cy="160" r="6"/>
      <text class="nf-q" x="350" y="98">?</text>
    </svg>
    <div class="nf-copy">
      <p class="eyebrow">Ошибка 404</p>
      <h1>Такой аудитории нет</h1>
      <p class="lede">Мы прошли по коридору до двери ${hash ? `«${esc(hash)}»` : '404'}, но за ней пусто. Возможно, ссылка устарела или в адресе опечатка.</p>
      <div class="chips"><a class="btn" href="#">На главную</a><a class="btn ghost" href="#rooms">К корпусам и аудиториям</a></div>
    </div></section></div>`;
}
