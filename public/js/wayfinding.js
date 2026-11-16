// Pure routing on corridor centre lines. Room doors use the same 13px offset
// as the SVG plan and the WebGL door openings. No straight lines through courts.
const key=([x,y])=>`${x.toFixed(3)},${y.toFixed(3)}`;
const equal=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.001;
export function circulation(layout) {
  if(layout.height===400)return {
    entry:[300,382],lift:[315,272],
    edges:[[[74,82],[300,82]],[[300,82],[526,82]],[[526,82],[526,298]],[[526,298],[300,298]],[[300,298],[74,298]],[[74,298],[74,82]],[[300,382],[300,298]],[[315,272],[315,298]]],
  };
  // Вход — главная дверь посередине южного фасада (под козырьком 3D-модели), через вестибюль к коридору.
  return {entry:[300,216],lift:[315,50],edges:[[[14,112],[584,112]],[[315,50],[315,112]],[[300,216],[300,112]]]};
}
export function roomDoor(box,layout) {
  const b=box,ring=layout.height===400;
  if(b.side==='n')return {door:[b.x+13,b.y+b.h],inside:[b.x+13,b.y+b.h-8],anchor:[b.x+13,ring?82:112]};
  if(b.side==='s')return {door:[b.x+13,b.y],inside:[b.x+13,b.y+8],anchor:[b.x+13,ring?298:112]};
  if(b.side==='w')return {door:[b.x+b.w,b.y+13],inside:[b.x+b.w-8,b.y+13],anchor:[74,b.y+13]};
  return {door:[b.x,b.y+13],inside:[b.x+8,b.y+13],anchor:[526,b.y+13]};
}
function onSegment(p,a,b) {
  return Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<.001 && p[0]>=Math.min(a[0],b[0])-.001&&p[0]<=Math.max(a[0],b[0])+.001&&p[1]>=Math.min(a[1],b[1])-.001&&p[1]<=Math.max(a[1],b[1])+.001;
}
export function corridorPath(layout,start,end) {
  const edges=circulation(layout).edges,points=[start,end,...edges.flat()],nodes=new Map(),graph=new Map();
  for(const p of points){nodes.set(key(p),p);graph.set(key(p),new Map());}
  for(const [a,b] of edges) {
    const split=[...nodes.values()].filter((p)=>onSegment(p,a,b)).sort((p,q)=>Math.hypot(p[0]-a[0],p[1]-a[1])-Math.hypot(q[0]-a[0],q[1]-a[1]));
    for(let i=1;i<split.length;i++) {
      const u=key(split[i-1]),v=key(split[i]),distance=Math.hypot(split[i][0]-split[i-1][0],split[i][1]-split[i-1][1]);
      graph.get(u).set(v,distance);graph.get(v).set(u,distance);
    }
  }
  const distances=new Map([[key(start),0]]),previous=new Map(),unvisited=new Set(nodes.keys());
  while(unvisited.size) {
    const current=[...unvisited].reduce((a,b)=>(distances.get(a)??Infinity)<(distances.get(b)??Infinity)?a:b);
    if(!Number.isFinite(distances.get(current)))return null;
    if(current===key(end))break;
    unvisited.delete(current);
    for(const [next,cost] of graph.get(current))if((distances.get(next)??Infinity)>distances.get(current)+cost){distances.set(next,distances.get(current)+cost);previous.set(next,current);}
  }
  const path=[];let current=key(end);
  while(current){path.unshift(nodes.get(current));if(current===key(start))return path;current=previous.get(current);}
  return null;
}
function leg(layout,from,to) {
  const start=Array.isArray(from)?{anchor:from}:roomDoor(from,layout),end=Array.isArray(to)?{anchor:to}:roomDoor(to,layout);
  const middle=corridorPath(layout,start.anchor,end.anchor);if(!middle)return null;
  return [...(start.inside?[start.inside,start.door]:[]),...middle,...(end.inside?[end.door,end.inside]:[])].filter((p,i,list)=>!i||!equal(p,list[i-1]));
}
export function buildRoute({target,origin='entry',rooms,layoutFor}) {
  if(!target)return null;
  const source=rooms.find((r)=>r.key===origin&&r.building===target.building);
  if(source?.key===target.key)return {target,segments:[],arrived:true,originName:`Аудитория ${source.room}`};
  const startFloor=source?.floor||(origin==='lift'?target.floor:1),destination=layoutFor(target.floor);
  const goal=destination.boxes.find((b)=>b.r.key===target.key);if(!goal)return null;
  const firstLayout=layoutFor(startFloor),start=source?firstLayout.boxes.find((b)=>b.r.key===source.key):circulation(firstLayout)[origin==='lift'?'lift':'entry'];
  if(!start)return null;
  const segments=[];
  if(startFloor!==target.floor) {
    const points=leg(firstLayout,start,circulation(firstLayout).lift);if(!points)return null;
    segments.push({floor:startFloor,points,end:'Лифт',kind:'departure'});
  }
  const points=leg(destination,startFloor===target.floor?start:circulation(destination).lift,goal);if(!points)return null;
  segments.push({floor:target.floor,points,end:`Аудитория ${target.room}`,kind:'arrival'});
  return {target,segments,startFloor,originName:source?`Аудитория ${source.room}`:origin==='lift'?`Лифт · ${target.floor} этаж`:'Главный вход'};
}
export function routeSvg(segment) {
  if(!segment?.points?.length)return '';
  const p=segment.points,a=p[0],b=p.at(-1);
  return `<g class="wayfinding-path" aria-hidden="true"><polyline class="route-halo" points="${p.map((v)=>v.join(',')).join(' ')}"/><polyline class="route-line" points="${p.map((v)=>v.join(',')).join(' ')}"/><circle class="route-start" cx="${a[0]}" cy="${a[1]}" r="6"/><circle class="route-end" cx="${b[0]}" cy="${b[1]}" r="7"/></g>`;
}
