import {esc} from './util.js';
import {routeSvg} from './wayfinding.js';

// One geometry source for both the accessible SVG plan and the WebGL cutaway.
// Architectural concept based on the user's outline: two courts, perimeter
// corridors and central circulation. This is not a measured evacuation plan.
export function interiorLayout(rooms) {
  const boxes=[];
  const sideCount=Math.ceil(rooms.length/4);
  const strips=[{x:86,y:12,w:428,h:58,side:'n'}, {x:86,y:310,w:428,h:76,side:'s'},
    {x:12,y:94,w:50,h:192,side:'w'}, {x:538,y:94,w:50,h:192,side:'e'}];
  strips.forEach((strip,j)=>{
    const list=rooms.slice(j*sideCount,(j+1)*sideCount),vertical=j>1;
    if(j===1) {
      const half=Math.ceil(list.length/2);
      for(const [part,x0] of [[list.slice(0,half),86],[list.slice(half),336]]) {
        const weights=part.map((r)=>Math.max(20,Math.min(70,r.seats||22))),total=weights.reduce((a,b)=>a+b,0);let offset=0;
        part.forEach((r,i)=>{const length=178*weights[i]/total;boxes.push({...strip,r,x:x0+offset,w:length});offset+=length;});
      }
      return;
    }
    const weights=list.map((r)=>Math.max(20,Math.min(70,r.seats||22))), total=weights.reduce((a,b)=>a+b,0);
    let offset=0;
    list.forEach((r,i)=>{
      const length=(vertical?strip.h:strip.w)*weights[i]/total;
      boxes.push({...strip,r,x:strip.x+(vertical?0:offset),y:strip.y+(vertical?offset:0),w:vertical?strip.w:length,h:vertical?length:strip.h});offset+=length;
    });
  });
  return {height:400, boxes,voids:[],
    plates:[{x:12,y:12,w:576,h:82},{x:12,y:286,w:576,h:100},{x:12,y:94,w:74,h:192},{x:514,y:94,w:74,h:192},{x:264,y:94,w:72,h:64},{x:264,y:220,w:72,h:66}],
    corridors:[{x:62,y:70,w:476,h:24},{x:62,y:286,w:476,h:24},{x:62,y:94,w:24,h:192},{x:514,y:94,w:24,h:192},{x:264,y:220,w:72,h:66},{x:264,y:310,w:72,h:76}],
    courts:[{x:92,y:100,w:166,h:180},{x:342,y:100,w:166,h:180}]};
}

// Коридоры названы как улицы столиц — по мотивам навигации реального главного здания МГИМО,
// где коридоры носят имена улиц городов мира. Названия здесь придуманы для прототипа.
export const STREETS=[
  {name:'Парижская улица', dat:'Парижской улице', x:62,y:70,w:476,h:24, label:[300,85]},
  {name:'Римская улица', dat:'Римской улице', x:62,y:286,w:476,h:24, label:[190,301]},
  {name:'Пекинская улица', dat:'Пекинской улице', x:62,y:94,w:24,h:192, label:[74,190], vertical:true},
  {name:'Каирская улица', dat:'Каирской улице', x:514,y:94,w:24,h:192, label:[526,190], vertical:true},
];
const onStreet=([x,y])=>STREETS.find((s)=>x>=s.x-2&&x<=s.x+s.w+2&&y>=s.y-2&&y<=s.y+s.h+2);
/** Улицы, по которым проходит участок маршрута, в порядке движения. */
export function streetsOnRoute(points=[]) {
  const out=[];
  // Углы лежат на двух улицах сразу, поэтому классифицируем и середины отрезков: иначе пропадает пройденный боковой коридор.
  const samples=points.flatMap((p,i)=>i?[[(points[i-1][0]+p[0])/2,(points[i-1][1]+p[1])/2],p]:[p]);
  for(const p of samples){const s=onStreet(p);if(s&&out.at(-1)!==s.dat)out.push(s.dat);}
  return out;
}

export function interiorSvg(layout,pair,{mine,selected,mini,route},state) {
  const rect=(p,cls)=>`<rect class="${cls}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>`;
  return `<svg class="${mini?'plan-mini':'plan'} interior-plan" viewBox="0 0 600 400" ${mini?'aria-hidden="true"': 'role="group" aria-label="Проектный план этажа с двумя дворами"'}>
    ${layout.plates.map((p)=>rect(p,'shell')).join('')}${layout.courts.map((p)=>`${rect(p,'garden')}<text class="tiny" x="${p.x+p.w/2}" y="${p.y+p.h/2}">Внутренний двор</text>`).join('')}
    ${layout.corridors.map((p)=>rect(p,'corridor')).join('')}
    ${layout.boxes.map((b)=>{
      const st=state(b.r.key,pair),cls=mine.has(b.r.key)?'mine':st.cls,sel=selected===b.r.key;
      const vertical=b.side==='w'||b.side==='e';
      const cx=b.x+b.w/2,cy=b.y+b.h/2;
      const door=vertical?`M${b.side==='w'?b.x+b.w:b.x} ${b.y+6}v14`:`M${b.x+6} ${b.side==='n'?b.y+b.h:b.y}h14`;
      const tables=[];
      if(!mini)for(let row=0;row<2;row++)for(let col=0;col<2;col++)tables.push(`<rect x="${b.x+b.w*(.16+col*.38)}" y="${b.y+b.h*(.18+row*.38)}" width="${b.w*.25}" height="${b.h*.12}" rx="1"/>`);
      return `<g class="rm ${cls} ${sel?'sel':''}" ${mini?'':`data-room3="${esc(b.r.key)}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="Аудитория ${esc(b.r.room)}, ${esc(b.r.kind)}, ${b.r.seats} мест. ${esc(st.text)}"`}>${rect(b,'room')}<g class="fur">${tables.join('')}</g><path class="gap" d="${door}"/>${mini?'':`<text class="no" x="${cx}" y="${cy+3}">${esc(b.r.room)}</text>`}</g>`;
    }).join('')}
    <g class="core"><rect x="264" y="94" width="72" height="64"/><text class="tiny" x="300" y="130">Лекционный зал</text><rect x="264" y="220" width="72" height="66"/>${Array.from({length:8},(_,i)=>`<path d="M270 ${228+i*6}h22"/>`).join('')}<rect class="lift" x="304" y="236" width="22" height="28"/><text class="tiny" x="315" y="276">лифт</text></g>
    <text class="tiny strong" x="300" y="302">Холл · лестница</text>${mini?'':STREETS.map((s)=>s.vertical?`<text class="tiny street" transform="translate(${s.label[0]} ${s.label[1]}) rotate(-90)">${s.name}</text>`:`<text class="tiny street" x="${s.label[0]}" y="${s.label[1]}">${s.name}</text>`).join('')}
    <text class="tiny strong" x="300" y="371">Главный вход</text>${mini?'':routeSvg(route)}
  </svg>`;
}
