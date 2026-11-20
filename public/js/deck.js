// Презентация актуальных сценариев. Схемы не зависят от устаревающих снимков кабинета.
const SLIDES = [
  {kicker:'Кампус · концепт',title:'Один кабинет, три роли',text:['Студент, преподаватель и деканат работают с общими данными. Сдача работы, оценка и готовая справка появляются в нужном кабинете.','Люди, группы, расписание и новости вымышлены. Это демонстрационный прототип.'],visual:'Три участника учебного дня',kind:'cards',items:[['Студент','Пары, задания, библиотека и документы'],['Преподаватель','Посещаемость, журнал и проверка работ'],['Деканат','Заявки, справки и объявления']]},
  {kicker:'Студент · Сегодня',title:'Учебный день с первого экрана',text:['Ближайшая пара показывает время, аудиторию и преподавателя. Рядом — маршрут, ниже — расписание дня.','Библиотека с поиском, новости и преподаватели остаются на «Сегодня». Уведомления открываются колокольчиком возле аватара.'],visual:'Что доступно на «Сегодня»',kind:'cards',items:[['Ближайшая пара','Когда начинается и куда идти'],['Библиотека курса','Найти учебник и открыть книгу'],['Новости и преподаватели','Объявления и контакты по дисциплинам']]},
  {kicker:'Навигация',title:'От пары в расписании до двери',text:['Выберите день и занятие: маршрут ведёт по территории к корпусу, затем по этажу до аудитории.','3D-модель и план дополняют друг друга. Вечернее освещение модели включается отдельно от темы интерфейса.'],visual:'Маршрут к аудитории',kind:'flow',items:[['Выбрать занятие','День, время и аудитория из расписания'],['Найти корпус','Путь от входа на территорию'],['Дойти до двери','Этаж, лифт и коридор на плане']]},
  {kicker:'Библиотека',title:'Учебник по названию, автору или курсу',text:['Поиск, дисциплины и фильтр наличия работают с общей вращающейся полкой. Книги листаются и после фильтрации.','Кнопка «Открыть книгу» показывает подробности и место выдачи. Количество экземпляров в каталоге демонстрационное.'],visual:'От поиска до места выдачи',kind:'flow',items:[['Найти','Название, автор или дисциплина'],['Пролистать','Выбрать книгу на полке'],['Открыть книгу','Описание, читальный зал и наличие']]},
  {kicker:'Задания и баллы',title:'Работа проходит полный путь',text:['Студент видит сроки, открывает условие и отмечает сдачу со ссылкой на работу. Преподаватель проверяет её в своём кабинете.','Баллы и комментарий возвращаются студенту. В «Учёбе» можно проверить посещаемость, допуск и расстояние до цели.'],visual:'Один результат в двух кабинетах',kind:'flow',items:[['Сдать работу','Студент добавляет ссылку'],['Проверить','Преподаватель ставит баллы и комментарий'],['Получить результат','Оценка и уведомление у студента']]},
  {kicker:'Преподаватель',title:'Журнал и действия для группы',text:['С первого экрана доступны сообщение группе, группы и журнал, аудитории. На проверке собраны сданные работы.','Посещаемость и оценки связаны с кабинетом студента. Изменение занятия обновляет расписание и уведомляет группу.'],visual:'Инструменты преподавателя',kind:'cards',items:[['Журнал','Посещаемость, баллы и состояние группы'],['Проверка работ','Сдачи, комментарии и результат'],['Связь с группой','Сообщения и изменения занятия']]},
  {kicker:'Заявки и деканат',title:'Справка с понятным статусом',text:['Студент выбирает тип документа и отправляет заявку. Деканат обрабатывает её и оставляет комментарий.','Статус сохраняется в истории заявок. Готовый электронный документ можно проверить по QR без входа в кабинет.'],visual:'Путь заявки',kind:'flow',items:[['Отправлена','Тип документа и данные заявки'],['В обработке','Статус и комментарий деканата'],['Готова','Электронный документ с проверкой по QR']]},
  {kicker:'Помощник',title:'Ответ с опорой на данные кабинета',text:['Помощник подсказывает расписание, сроки заданий, консультации и порядок заказа справок.','Это справочный режим: он помогает найти нужный раздел, а отправка заявки и сдача работы остаются явными действиями пользователя.'],visual:'Пример справочного диалога',kind:'chat',items:[['Вы','Какие пары завтра?'],['Помощник','Расписание на выбранный день: время, дисциплины и аудитории.'],['Дальше','Открыть расписание или построить маршрут к паре.']]},
  {kicker:'Внешний вид',title:'Один интерфейс на большом и малом экране',text:['На телефоне навигация находится снизу, формы и карточки подстраиваются под ширину. Основные действия сохраняются.','Переключатель справа вверху меняет светлую и тёмную тему. Выбор сохраняется между переходами и синхронизируется во вкладках.'],visual:'Тема и навигация',kind:'cards',items:[['Светлая или тёмная','Сохранённая настройка интерфейса'],['Телефон','Нижнее меню и доступные кнопки'],['3D-освещение','День и вечер внутри модели — отдельный выбор']]},
  {kicker:'Попробуйте сами',title:'Пройдите сценарий за три минуты',text:['Войдите как Алина, сдайте работу со ссылкой. Затем войдите как Ирина Ветрова, поставьте баллы и вернитесь к студентке.','Демо-аккаунты доступны на экране входа. Пароль: Campus-demo-2026. Сервер проверяет роль, пароли хранятся как scrypt-хеши с солью.'],visual:'Демо-аккаунты',kind:'cards',items:[['alina','Кабинет студентки'],['vetrova','Кабинет преподавателя'],['dekanat','Заявки и справки']],finish:true},
];
let overlay=null,index=0,lastFocus=null,anims=[],inertBefore=new Map(),touchStart=null;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

function slideHtml(s){
  return `<div class="deck-copy"><p class="deck-kicker">${s.kicker}</p><h2 id="deck-title">${s.title}</h2>${s.text.map(t=>`<p>${t}</p>`).join('')}${s.finish?'<button class="deck-btn deck-demo" data-deck-demo>К демо-аккаунтам →</button>':''}</div>
    <figure class="deck-preview"><figcaption>Сценарий работы</figcaption><h3>${s.visual}</h3><ol class="deck-cards deck-${s.kind}">${s.items.map(([title,text],i)=>`<li><span class="deck-step" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div><strong>${title}</strong><p>${text}</p></div></li>`).join('')}</ol></figure>`;
}

function show(i,dir=1){
  index=((i%SLIDES.length)+SLIDES.length)%SLIDES.length;
  const stage=overlay.querySelector('[data-deck-stage]');
  anims.forEach(a=>a.cancel());anims=[];
  // A focused control in the outgoing slide must not leave focus behind the modal.
  const hadSlideFocus=stage.contains(document.activeElement);
  stage.innerHTML=slideHtml(SLIDES[index]);stage.scrollTop=0;
  overlay.querySelector('[data-deck-select]').value=String(index);
  overlay.querySelector('[data-deck-count]').textContent=`${index+1} / ${SLIDES.length}`;
  overlay.querySelector('[data-deck-live]').textContent=`Слайд ${index+1} из ${SLIDES.length}: ${SLIDES[index].title}`;
  if(hadSlideFocus)overlay.querySelector('[data-deck-next]').focus();
  if(!reduced()&&stage.animate)anims.push(stage.animate([{opacity:.35,transform:`translateX(${dir*12}px)`},{opacity:1,transform:'translateX(0)'}],{duration:240,easing:'ease-out'}));
}

function onKey(e){
  if(!overlay)return;
  if(e.key==='/'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.key==='Escape'){e.preventDefault();closeDeck();return;}
  if(e.key==='Tab'){
    const f=[...overlay.querySelectorAll('button,select')],first=f[0],last=f.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    return;
  }
  // Leave native select navigation and button activation intact.
  if(e.target.closest?.('select')||e.altKey||e.ctrlKey||e.metaKey)return;
  if(['ArrowRight','PageDown'].includes(e.key)||(e.key===' '&&!e.target.closest?.('button'))){e.preventDefault();show(index+1,1);}
  else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();show(index-1,-1);}
  else if(e.key==='Home'){e.preventDefault();show(0,-1);}
  else if(e.key==='End'){e.preventDefault();show(SLIDES.length-1,1);}
}

export function openDeck(start=0){
  if(overlay)return;
  lastFocus=document.activeElement;
  overlay=document.createElement('div');overlay.className='deck';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','deck-title');
  overlay.innerHTML=`<div class="deck-top"><span class="deck-brand">Кампус · презентация</span><button class="deck-btn" data-deck-close aria-label="Выйти из презентации (Esc)">Выйти · Esc</button></div>
    <div class="deck-stage" data-deck-stage></div>
    <div class="deck-bottom"><button class="deck-btn" data-deck-prev aria-label="Предыдущий слайд">←</button><div class="deck-position"><span class="deck-count" data-deck-count></span><select class="deck-select" data-deck-select aria-label="Выбрать слайд">${SLIDES.map((s,i)=>`<option value="${i}">${i+1}. ${s.kicker}</option>`).join('')}</select></div><button class="deck-btn" data-deck-next aria-label="Следующий слайд">→</button></div>
    <p class="deck-live" data-deck-live aria-live="polite"></p>`;
  overlay.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-deck-close'))closeDeck();
    else if(b.hasAttribute('data-deck-demo')){closeDeck();location.hash='about';}
    else if(b.hasAttribute('data-deck-next'))show(index+1,1);
    else if(b.hasAttribute('data-deck-prev'))show(index-1,-1);
  });
  overlay.addEventListener('change',e=>{if(e.target.matches('[data-deck-select]')){const next=Number(e.target.value);if(Number.isInteger(next)&&next>=0&&next<SLIDES.length)show(next,next>=index?1:-1);}});
  overlay.addEventListener('touchstart',e=>{touchStart=e.target.closest('button,select')?null:{x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  overlay.addEventListener('touchcancel',()=>{touchStart=null;},{passive:true});
  overlay.addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.2)show(index+(dx<0?1:-1),dx<0?1:-1);},{passive:true});
  inertBefore=new Map([...document.body.children].map(el=>[el,el.inert]));
  inertBefore.forEach((_,el)=>{el.inert=true;});document.body.append(overlay);
  document.documentElement.classList.add('deck-open');document.addEventListener('keydown',onKey,true);
  show(Number.isInteger(start)?start:0);overlay.querySelector('[data-deck-next]').focus();
}

export function closeDeck(){
  if(!overlay)return;
  anims.forEach(a=>a.cancel());anims=[];touchStart=null;
  document.removeEventListener('keydown',onKey,true);
  inertBefore.forEach((inert,el)=>{el.inert=inert;});inertBefore.clear();
  overlay.remove();overlay=null;document.documentElement.classList.remove('deck-open');lastFocus?.focus?.();
}

document.addEventListener('click',e=>{if(e.target.closest('[data-deck-open]')){e.preventDefault();openDeck();}});
