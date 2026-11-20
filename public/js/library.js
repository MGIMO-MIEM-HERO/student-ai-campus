import {S} from './state.js';
import {icon} from './icons.js';
const sections = ['Все', 'Математика', 'Экономика', 'Информатика'];
const rows = [
 ['fichtenholz','Курс дифференциального и интегрального исчисления','Г. М. Фихтенгольц',1,'Математический анализ','Интегралы и производные помогают последовательно разбирать задачи анализа.'],
 ['demidovich','Сборник задач и упражнений по математическому анализу','Б. П. Демидович',1,'Математический анализ','Задачи для самостоятельной практики по темам математического анализа.'],
 ['zorich','Математический анализ','В. А. Зорич',1,'Математический анализ','Теоретический материал для внимательной работы с понятиями анализа.'],
 ['ilyin','Линейная алгебра','В. А. Ильин, Э. Г. Позняк',1,'Линейная алгебра','Матрицы и линейные пространства связывают вычисления с геометрическими представлениями.'],
 ['gmurman','Теория вероятностей и математическая статистика','В. Е. Гмурман',1,'Теория вероятностей','Материал для изучения случайных событий и статистических методов.'],
 ['taha','Введение в исследование операций','Х. А. Таха',1,'Методы оптимизации','Математические модели помогают формулировать задачи выбора решений.'],
 ['mankiw','Принципы экономикс','Н. Г. Мэнкью',2,'Экономическая теория','Базовые экономические понятия для обсуждения рынков и решений участников.'],
 ['mcconnell','Экономикс','К. Р. Макконнелл, С. Л. Брю',2,'Экономическая теория','Учебный материал для знакомства с микроэкономикой и макроэкономикой.'],
 ['varian','Микроэкономика. Промежуточный уровень','Х. Р. Вэриан',2,'Микроэкономика','Модели потребителя и фирмы помогают исследовать экономическое поведение.'],
 ['magnus','Эконометрика. Начальный курс','Я. Р. Магнус, П. К. Катышев, А. А. Пересецкий',2,'Эконометрика','Введение в методы анализа экономических данных и регрессионные модели.'],
 ['cormen','Алгоритмы: построение и анализ','Т. Кормен и др.',3,'Алгоритмы и структуры данных','Алгоритмические задачи рассматриваются через построение решений и анализ их сложности.'],
 ['garcia','Системы баз данных. Полный курс','Г. Гарсиа-Молина, Дж. Ульман, Дж. Уидом',3,'Базы данных','Материал для изучения моделей данных и организации работы с базами.']
];
const colors = ['#1d2430','#9a3a2c','#3e6189','#6f8f7c','#7f9fc3','#b8893c','#3c3f45','#6f8f7c','#4f6b73','#9a3a2c','#1d2430','#3e6189'];
const books = rows.map(([id,title,author,section,course,annotation],i)=>({id,title,author,section,course,annotation,index:i,color:colors[i],shelf:`Читальный зал · А-112 · стеллаж ${['','М','Э','И'][section]}-${i%3+1}`,available:i%4+2,copies:`${i%4+2} из 6`}));
export const BOOKS_COUNT = books.length;
let appliedHash = '', unmountedAt = 0;
let target = 12, selectedBookId = null, generation = 0, dispose;
const mod = (n,m=12)=>(n%m+m)%m;
const escape = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const motifs = [
 '<path d="M30 150V30M30 150H190M40 142Q80 140 105 95T180 40L180 150Z"/><text x="55" y="85" font-size="62">∫</text>',
 Array.from({length:36},(_,i)=>`<circle cx="${35+i%6*29}" cy="${30+Math.floor(i/6)*26}" r="3"/>`).join(''),
 '<path d="M20 100H200M110 20V180M25 155Q100 150 110 100T195 40M70 70H150V130H70Z"/><text x="160" y="65">ε</text><text x="120" y="170">δ</text>',
 '<path d="M65 30H45V160H65M155 30H175V160H155M85 125V55L78 65M85 55L92 65M85 125H145L135 118M145 125L135 132"/><text x="70" y="92">1  0</text>',
 '<path d="M20 160H200M25 155Q60 155 80 85Q110 -20 140 85Q160 155 195 155M55 155V125H80V95H105V65H130V95H155V125H180V155"/>',
 '<path d="M25 160V25M25 160H200M45 145L65 65L125 40L175 100L125 145ZM40 110L170 35"/>',
 '<path d="M25 160V25M25 160H200M40 140L180 40M40 40L180 140"/><circle cx="110" cy="90" r="10"/>',
 '<path d="M25 160V25M25 160H200M40 150Q100 110 180 35M40 35Q100 110 180 150M110 45V155"/>',
 '<path d="M25 160V25M25 160H200M45 35Q50 130 180 140M70 25Q80 100 190 110M35 60L165 155"/>',
 '<path d="M25 160V25M25 160H200M35 145L190 40"/>'+Array.from({length:15},(_,i)=>`<circle cx="${40+i*10}" cy="${145-i*7+(i%3-1)*18}" r="3"/>`).join(''),
 '<path d="M110 30L55 90L30 155M55 90L85 155M110 30L165 90L140 155M165 90L195 155"/>'+[[110,30],[55,90],[165,90],[30,155],[85,155],[140,155],[195,155]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="10"/>`).join(''),
 '<path d="M20 40H100V145H20ZM130 70H210V175H130ZM20 65H100M20 95H100M130 95H210M130 125H210M100 110H115V85H130"/>'
];
function art(b,i,mask='') {return `<svg viewBox="0 0 240 343" preserveAspectRatio="xMidYMid slice" aria-hidden="true" ${mask?`class="lib-ink"`:''}><defs><linearGradient id="lib-g-${mask||'s'+i}"><stop stop-color="#fff" stop-opacity=".12"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>${mask?`<filter id="lib-noise"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="120"/></filter><mask id="lib-blot"><g filter="url(#lib-noise)">${[[30,46],[180,57],[100,149],[210,240],[50,274],[140,320],[120,69]].map(([x,y])=>`<circle data-lib-ink cx="${x}" cy="${y}" r="0" fill="white"/>`).join('')}</g></mask>`:''}</defs><g ${mask?'mask="url(#lib-blot)"':''}><path fill="${b.color}" d="M0 0H240V343H0Z"/><path fill="url(#lib-g-${mask||'s'+i})" d="M0 0H240V343H0Z"/><g transform="translate(32 178) scale(.8)" fill="none" stroke="#efe9dc" stroke-width="1.5">${motifs[i]}</g><path stroke="#efe9dc" stroke-width="1" d="M12 12H228V331H12Z" fill="none"/></g></svg>`;}
function cover(b,i) {return `${art(b,i)}<div class="lib-cover-type ${b.title.length>36?'lib-long':''}"><span>Библиотека кампуса · ${sections[b.section]}</span><strong>${escape(b.title)}</strong><small>${escape(b.author)}</small><b>${['','МАТ','ЭКОН','ИНФ'][b.section]}</b></div>`;}
export function viewLibrary(){
  let requested='';try{requested=decodeURIComponent((location.hash.split('/')[1]||'').split('?')[0]);}catch{}
  if(books.some(b=>b.id===requested)&&!matchingBooks().some(b=>b.id===requested))Object.assign(S,{libraryQuery:'',librarySection:0,libraryAvailable:false});
  const list=matchingBooks();
  return `<div class="lib-page" data-library data-library-search data-library-catalog>
    <header class="lib-header"><p class="eyebrow">Учёба</p><h1>Библиотека курса</h1><p>Учебники по вашим дисциплинам: где взять и сколько экземпляров. Каталог демонстрационный.</p></header>
    <div class="lib-catalog-search">${libraryControls(list)}<div id="book-results" ${list.length?'hidden':''}>${searchResults(list)}</div></div>
    ${libraryBrowser(list)}</div>`;
}
function libraryBrowser(list){if(!list.length)return '<div data-library-mount></div>';return `<div data-library-mount><div data-library-browse><section class="lib-stage" data-lib-stage tabindex="0" aria-label="Полка учебников"><div class="lib-track">${Array.from({length:list.length*3},(_,v)=>{const b=list[v%list.length],i=b.index;return `<div class="lib-book" data-lib-book="${v}"><button class="lib-spine" data-lib-pick="${v}" aria-label="${escape(b.title+' — '+b.author)}"><span class="lib-spine-motif">${['∫','⋮','ε','⊥','∩','◇','×','×','⌒','⋰','⋈','▤'][i]}</span><strong>${escape(b.title)}</strong><small>${escape(b.author.split(',')[0])}</small><b>${['','МАТ','ЭКОН','ИНФ'][b.section]}</b></button><button class="lib-cover" data-lib-pick="${v}" aria-label="Открыть: ${escape(b.title)}">${cover(b,i)}<span class="lib-open-ring">↗</span></button><div class="lib-pages"></div></div>`;}).join('')}</div><div class="lib-cursor" data-lib-cursor aria-hidden="true"><span>ОТКРЫТЬ</span></div></section>
    <footer class="lib-caption"><button data-lib-step="-1" ${list.length===1?'disabled':''} aria-label="Предыдущая книга">←</button><div class="lib-caption-content" aria-live="polite" data-lib-caption></div><button data-lib-step="1" ${list.length===1?'disabled':''} aria-label="Следующая книга">→</button></footer><div class="lib-actions"><button type="button" class="btn" data-lib-open>Открыть книгу</button></div><p class="lib-hint">Листайте стрелками или потяните полку · Enter — открыть книгу</p></div>
    <div class="lib-sheet" data-lib-sheet role="dialog" aria-modal="true" aria-label="Карточка учебника" hidden></div></div>`;}
/** Учебник библиотеки к дисциплине пары (по точному названию курса) — для карточки ближайшей пары. */
export function bookForCourse(title){const i=books.findIndex((b)=>b.course===title);if(i<0)return null;const b=books[i];return {i,id:b.id,title:b.title,author:b.author,shelf:b.shelf,copies:b.copies};}
const normalize = (value) => value.toLocaleLowerCase('ru').replaceAll('ё','е');
function matchingBooks(){
  const words=normalize(S.libraryQuery).trim().split(/\s+/).filter(Boolean);
  return books.filter(b=>(!S.librarySection||b.section===S.librarySection)&&(!S.libraryAvailable||b.available>0)&&words.every(word=>normalize(`${b.title} ${b.author} ${b.course}`).includes(word)));
}
function searchResults(list){
  return list.length?'':`<div class="empty">${icon('search')}<strong>Ничего не найдено</strong><span>Попробуйте другое название, автора или дисциплину либо сбросьте фильтры.</span></div>`;
}
function libraryControls(list){
  return `<div class="hm-lib-search"><label for="book-query">Найти книгу</label><div class="hm-lib-query">${icon('search')}<input id="book-query" type="search" placeholder="Название, автор или дисциплина" value="${escape(S.libraryQuery)}" autocomplete="off" aria-controls="book-results"></div>
    <div class="hm-lib-filters"><div class="chips" role="group" aria-label="Категория книг">${sections.map((s,i)=>`<button class="chip" data-book-section="${i}" aria-pressed="${S.librarySection===i}" aria-controls="book-results">${s}</button>`).join('')}</div><label class="hm-lib-available"><input type="checkbox" data-book-available ${S.libraryAvailable?'checked':''} aria-controls="book-results">Только в наличии</label><button class="link" data-book-reset>Сбросить</button></div></div>
    <p class="small muted" data-book-count role="status" aria-atomic="true">Найдено книг: ${list.length} из ${books.length}</p>`;
}
export function libraryShelf(){
  const list=matchingBooks();
  return `<section class="hm-card hm-lib lib-embedded" data-library data-library-search data-library-catalog aria-label="Библиотека курса"><div class="hm-card-head"><div><p class="hm-eyebrow">Библиотека курса</p><h2 class="hm-title">Учебники по вашим дисциплинам</h2></div><a class="link" href="#library">Открыть полку</a></div>
    ${libraryControls(list)}<div id="book-results" ${list.length?'hidden':''}>${searchResults(list)}</div>${libraryBrowser(list)}</section>`;
}
function mountLibrarySearch(root,remount){
  const host=root.querySelector('[data-library-search]');if(!host)return ()=>{};
  const controller=new AbortController(),options={signal:controller.signal};
  const update=()=>{
    const list=matchingBooks(),results=host.querySelector('#book-results');
    if(location.hash.startsWith('#library/'))history.replaceState(null,'','#library');
    results.innerHTML=searchResults(list);results.hidden=!!list.length;remount(list);
    host.querySelector('[data-book-count]').textContent=`Найдено книг: ${list.length} из ${books.length}`;
    host.querySelectorAll('[data-book-section]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.bookSection===S.librarySection)));
    results.querySelectorAll('[data-vars]').forEach(el=>el.dataset.vars.split(';').forEach(pair=>{const i=pair.indexOf(':');el.style.setProperty(pair.slice(0,i),pair.slice(i+1));}));
  };
  host.addEventListener('input',e=>{if(e.target.id==='book-query'){S.libraryQuery=e.target.value;update();}},options);
  host.addEventListener('change',e=>{if(e.target.matches('[data-book-available]')){S.libraryAvailable=e.target.checked;update();}},options);
  host.addEventListener('click',e=>{const el=e.target.closest('[data-book-section],[data-book-reset]');if(!el)return;if(el.hasAttribute('data-book-reset')){S.libraryQuery='';S.librarySection=0;S.libraryAvailable=false;host.querySelector('#book-query').value='';host.querySelector('[data-book-available]').checked=false;}else S.librarySection=+el.dataset.bookSection;update();},options);
  return ()=>controller.abort();
}
// Клик по книге на главной запоминает её, и библиотека открывается сразу на нужном корешке.
document.addEventListener('click',(e)=>{const a=e.target.closest?.('[data-lib-go]');if(a)target=12+Number(a.dataset.libGo);});
export function syncLibrary(root){
  const current=++generation;dispose?.();dispose=null;if(current!==generation)return;
  let cleanShelf=root.querySelector('[data-library]')?mountLibrary(root):()=>{};
  const cleanSearch=mountLibrarySearch(root,list=>{cleanShelf();const slot=root.querySelector('[data-library-mount]');if(slot)slot.outerHTML=libraryBrowser(list);cleanShelf=mountLibrary(root);});
  dispose=()=>{cleanSearch();cleanShelf();};
}
export function mountLibrary(root){
 const host=root.querySelector('[data-library]'),books=matchingBooks(),count=books.length;if(!host||!count)return ()=>{};
 const mod=(n,m=count)=>(n%m+m)%m;target=count+Math.max(0,books.findIndex(b=>b.id===selectedBookId));
 // Ссылка вида #library/<id> открывает полку на нужной книге (в том числе в новой вкладке); после этого адрес сокращается.
 {const hash=location.hash,again=performance.now()-unmountedAt<150&&hash===appliedHash;if(!again){appliedHash=hash;let want='';try{want=decodeURIComponent((hash.split('/')[1]||'').split('?')[0]);}catch{want='';}const wi=books.findIndex((b)=>b.id===want);if(wi>=0)target=count+wi;}}
 const stage=host.querySelector('[data-lib-stage]'), sheet=host.querySelector('[data-lib-sheet]'), caption=host.querySelector('[data-lib-caption]'), cursor=host.querySelector('[data-lib-cursor]');
 const nodes=[...host.querySelectorAll('[data-lib-book]')],cycle=nodes.length,half=cycle/2,reduced=matchMedia('(prefers-reduced-motion: reduce)'), controller=new AbortController(), animations=new Set();
 let s=target,raf=0,last=0,visible=true,dead=false,H=320,ws=51,gap=9.6,d=224,hover=-1,over=false,tx=0,ty=0,tiltX=0,tiltY=0,lifts=nodes.map(()=>0),active=-1,drag=null,suppress=false,timer,closing=false,returnFocus=null;
 nodes.forEach((el,v)=>el.style.setProperty('--lib-cloth',books[v%count].color));
 const on=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:controller.signal});
 const animate=(el,frames,options)=>{const a=el.animate(frames,{...options,duration:reduced.matches?1:options.duration});animations.add(a);a.finished.then(()=>animations.delete(a),()=>animations.delete(a));return a;};
 const wake=()=>{if(!dead&&visible&&!document.hidden&&!raf){last=performance.now();raf=requestAnimationFrame(frame);}};
 const jump=(i)=>{target+=mod(i-mod(Math.round(target))+count/2)-count/2;wake();};
 function updateCaption(i,dir=1){const b=books[i];selectedBookId=b.id;const values=[b.title,`${b.author} · ${b.course}`,b.shelf];if(!caption.children.length)caption.innerHTML=values.map((v,j)=>`<div class="lib-caption-mask lib-caption-${j}"><span>${escape(v)}</span></div>`).join('');else [...caption.children].forEach((mask,j)=>{const old=mask.lastElementChild,next=document.createElement('span');next.textContent=values[j];mask.append(next);if(reduced.matches){old.remove();return;}animate(old,[{transform:'translateY(0)'},{transform:`translateY(${-dir*105}%)`}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'}).finished.then(()=>old.remove(),()=>old.remove());animate(next,[{transform:`translateY(${dir*105}%)`},{transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'});});}
 function frame(now){raf=0;const dt=Math.min((now-last)/1000,.05);last=now;s=reduced.matches?target:s+(target-s)*(1-Math.exp(-(drag?18:5.2)*dt));if(Math.abs(target-s)<1e-4)s=target;if(Math.abs(target-count)>cycle){const shift=Math.floor((target-count)/count)*count;target-=shift;s-=shift;}
 const index=mod(Math.round(s));if(index!==active){const dir=active<0?1:Math.sign(target-s)||1;active=index;updateCaption(index,dir);}
 tiltX+=(tx-tiltX)*(reduced.matches?1:1-Math.exp(-7*dt));tiltY+=(ty-tiltY)*(reduced.matches?1:1-Math.exp(-7*dt));let moving=Math.abs(target-s)>.0001||Math.abs(tx-tiltX)+Math.abs(ty-tiltY)>.02;
 nodes.forEach((el,v)=>{const r=mod(v-s+half,cycle)-half,o0=Math.max(0,1-Math.abs(r)),o=o0*o0*(3-2*o0),B=Math.abs(r)<1?(r+Math.sin(Math.PI*r)/Math.PI)/2:Math.sign(r)*.5,x=r*(ws+gap)+(d-ws+1.6*gap)*B,show=(count>1||Math.abs(r)<.5)&&Math.abs(x)<stage.clientWidth/2+d;el.hidden=!show;if(!show)return;const lift=hover===v&&Math.abs(r)>.5?1:0;lifts[v]+=(lift-lifts[v])*(reduced.matches?1:1-Math.exp(-12*dt));moving ||=Math.abs(lift-lifts[v])>.001;el.style.transform=`translate3d(${x}px,${-o*.025*H-lifts[v]*.045*H}px,${o*.2*H}px) rotateZ(${-4.5*o}deg) rotateX(${tiltX*o}deg) rotateY(${-90*o+tiltY*o}deg)`;el.style.zIndex=Math.round(100-Math.abs(r)*4);el.style.setProperty('--spine-shade',o*.55);el.style.setProperty('--cover-shade',(1-o)*.5);el.classList.toggle('lib-current',Math.abs(r)<.5);el.classList.toggle('lib-settled',Math.abs(r)<.02&&!drag);el.querySelectorAll('button').forEach(button=>button.tabIndex=Math.abs(r)<.5?0:-1);});if(moving||over)wake();}
 function resize(){H=Math.min(340,Math.max(245,stage.clientWidth*.55));ws=H*.16;gap=H*.03;d=H*.7;host.style.setProperty('--lib-h',`${H}px`);host.style.setProperty('--lib-ws',`${ws}px`);host.style.setProperty('--lib-d',`${d}px`);wake();}

 function coverRect(){const el=nodes.find((_,v)=>Math.abs(mod(v-s+half,cycle)-half)<.5);return el?.querySelector('.lib-cover').getBoundingClientRect()||stage.getBoundingClientRect();}
 const clip=r=>`inset(${Math.max(0,r.top)}px ${Math.max(0,innerWidth-r.right)}px ${Math.max(0,innerHeight-r.bottom)}px ${Math.max(0,r.left)}px)`;
 function open(instant=false){if(!sheet.hidden)return;const i=mod(Math.round(target)),b=books[i],r=coverRect();returnFocus=document.activeElement;sheet.innerHTML=`<div class="lib-sheet-copy">${[sections[b.section],b.title,b.author,`Курс: ${b.course} · Стеллаж: ${b.shelf} · В наличии: ${b.copies}`,b.annotation,'Каталог демонстрационный, наличие вымышленное.'].map((v,j)=>`<div class="lib-line lib-line-${j}"><div data-lib-line>${escape(v)}</div></div>`).join('')}<div class="lib-line"><div data-lib-line><button data-lib-reserve>Забронировать на 3 дня</button><button data-lib-dismiss>Закрыть</button></div></div></div><div class="lib-sheet-art">${art(b,b.index,'detail')}<div class="lib-detail-title"><strong>${escape(b.title)}</strong><span>${escape(b.author)}</span></div></div>`;sheet.hidden=false;[...document.body.children].forEach(el=>{if(el!==sheet)el.inert=true;});sheet.querySelector('.lib-detail-title').classList.toggle('lib-dark',b.index===8);host.classList.add('lib-dialog-open');sheet.querySelector('[data-lib-dismiss]').focus({preventScroll:true});if(!instant){animate(sheet,[{clipPath:clip(r),transform:'rotate(-4.5deg)'},{clipPath:'inset(0px)',transform:'rotate(0deg)'}],{duration:1050,easing:'cubic-bezier(.76,0,.18,1)'});sheet.querySelectorAll('[data-lib-line]').forEach((el,j)=>animate(el,[{transform:'translateY(110%)'},{transform:'translateY(0)'}],{duration:900,delay:reduced.matches?0:620+j*75,fill:'backwards',easing:'cubic-bezier(.2,.8,.2,1)'}));}if(!instant)animate(sheet.querySelector('.lib-detail-title'),[{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0)'}],{duration:1250,delay:reduced.matches?0:520,fill:'backwards',easing:'cubic-bezier(0,0,.2,1)'});sheet.querySelectorAll('[data-lib-ink]').forEach((circle,j)=>{circle.setAttribute('r','720');if(!instant&&!reduced.matches)animate(circle,[{r:'0px'},{r:'720px'}],{duration:1250,delay:520+[0,120,220,300,360,420,180][j],fill:'backwards',easing:'cubic-bezier(0,0,.2,1)'});});}
 function close(){if(sheet.hidden||closing)return;closing=true;animations.forEach(a=>a.cancel());animations.clear();const a=animate(sheet,[{clipPath:'inset(0px)',transform:'rotate(0deg)'},{clipPath:clip(coverRect()),transform:'rotate(-4.5deg)'}],{duration:850,easing:'cubic-bezier(.76,0,.18,1)'});a.finished.then(()=>{if(dead)return;sheet.hidden=true;sheet.innerHTML='';[...document.body.children].forEach(el=>el.inert=false);closing=false;host.classList.remove('lib-dialog-open');if(returnFocus?.isConnected&&returnFocus!==document.body&&!returnFocus.closest('[hidden]'))returnFocus.focus({preventScroll:true});else (host.querySelector('.hm-book-result')||host.querySelector('[data-lib-step="1"]')).focus();},()=>{});}
 const onClick=e=>{const el=e.target.closest('[data-lib-open],[data-lib-step],[data-lib-pick],[data-lib-dismiss],[data-lib-reserve]');if(!el)return;if(el.hasAttribute('data-lib-open')){target=Math.round(s);s=target;open();wake();return;}if(el.hasAttribute('data-lib-dismiss'))return close();if(el.hasAttribute('data-lib-reserve')){const date=new Date();date.setDate(date.getDate()+3);const until=date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});el.textContent=`Отложено до ${until}`;el.disabled=true;const note=document.createElement('p');note.className='lib-reserved';note.setAttribute('role','status');note.textContent=`Книга отложена до ${until}. Заберите её в читальном зале.`;el.parentElement.after(note);return;}if(el.hasAttribute('data-lib-step')){target=Math.round(target)+ +el.dataset.libStep;wake();}if(el.hasAttribute('data-lib-pick')){if(suppress){suppress=false;return;}const v=+el.dataset.libPick;if(el.classList.contains('lib-cover')||Math.abs(mod(v-s+half,cycle)-half)<.5){target=v;s=v;open();wake();}else jump(mod(v));}};on(host,'click',onClick);on(sheet,'click',onClick);document.body.append(sheet);
 on(stage,'pointerdown',e=>{if(e.button!==0||count===1)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,t:target,moved:false};});
 on(window,'pointermove',e=>{if(drag&&e.pointerId===drag.id){const dx=e.clientX-drag.x;if(!drag.moved&&Math.abs(dx)>5&&Math.abs(dx)>Math.abs(e.clientY-drag.y)){drag.moved=true;stage.setPointerCapture(e.pointerId);}if(drag.moved){target=drag.t-dx/(ws+gap);wake();}}});
 const end=e=>{if(!drag||e.pointerId!==drag.id)return;suppress=drag.moved;if(suppress)setTimeout(()=>{suppress=false;},0);if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);drag=null;target=Math.round(target);wake();};on(window,'pointerup',end);on(window,'pointercancel',end);
 on(stage,'pointermove',e=>{over=true;cursor.classList.add('lib-cursor-live');const rect=stage.getBoundingClientRect(),book=e.target.closest('[data-lib-book]');hover=book?+book.dataset.libBook:-1;const coverEl=e.target.closest('.lib-cover');const isCover=coverEl&&mod(hover)===mod(Math.round(target));cursor.classList.toggle('lib-cursor-open',!!isCover);cursor.style.transform=`translate(${e.clientX-rect.left}px,${e.clientY-rect.top}px)`;if(isCover){const r=coverEl.getBoundingClientRect();tx=Math.max(-6,Math.min(6,(.5-(e.clientY-r.top)/r.height)*12));ty=Math.max(-9,Math.min(9,((e.clientX-r.left)/r.width-.5)*18));}else{tx=.7;ty=-1;}wake();});
 on(stage,'pointerleave',()=>{over=false;cursor.classList.remove('lib-cursor-live');hover=-1;tx=ty=0;wake();});
 on(stage,'wheel',e=>{if(count===1)return;if(!e.shiftKey&&Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;e.preventDefault();target+=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)/(ws+gap)*.5;clearTimeout(timer);timer=setTimeout(()=>{target=Math.round(target);wake();},160);wake();},{passive:false});
 on(document,'keydown',e=>{if(!sheet.hidden){if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const buttons=[...sheet.querySelectorAll('button')],first=buttons[0],lastButton=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();lastButton.focus();}else if(!e.shiftKey&&document.activeElement===lastButton){e.preventDefault();first.focus();}}return;}if(!visible||!e.target.closest('[data-library-browse]')||host.querySelector('[data-library-browse]')?.hidden||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(count>1&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();target=Math.round(target)+(e.key==='ArrowLeft'?-1:1);wake();}if(e.key==='Enter'&&!e.target.closest('button,a')){e.preventDefault();open();}});
 on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});on(reduced,'change',wake);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{cancelAnimationFrame(raf);raf=0;}},{threshold:.05});observer.observe(host.querySelector('[data-library-browse]'));const ro=new ResizeObserver(resize);ro.observe(stage);resize();if(location.hash.endsWith('?open=1')){s=target;open(true);history.replaceState(null,'',location.hash.split('?')[0]);}wake();
 return ()=>{unmountedAt=performance.now();dead=true;cancelAnimationFrame(raf);clearTimeout(timer);controller.abort();observer.disconnect();ro.disconnect();animations.forEach(a=>a.cancel());animations.clear();target=Math.round(target);if(!sheet.hidden)[...document.body.children].forEach(el=>el.inert=false);host.classList.remove('lib-dialog-open');sheet.remove();};
}
