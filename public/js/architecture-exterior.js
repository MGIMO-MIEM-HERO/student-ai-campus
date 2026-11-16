import {WINGS,territoryRoute} from './campus-geometry.js';

const world=([x,z])=>[(x-410)/20,(z-190)/20];
const signedArea=(points)=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);

function nearestEdge(points,[x,z]) {
  let nearest;
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
    const px=a[0]+t*dx,pz=a[1]+t*dz,distance=Math.hypot(x-px,z-pz);
    if(!nearest||distance<nearest.distance)nearest={x:px,z:pz,dx,dz,distance};
  }
  return nearest;
}

function inside(points,x,z) {
  let hit=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}

function roofEquipment(kit,wing,outline,holes) {
  if(kit.mobile)return;
  const {box,m}=kit,xs=outline.map(p=>p[0]),zs=outline.map(p=>p[1]);
  const minX=Math.min(...xs),minZ=Math.min(...zs),width=Math.max(...xs)-minX,depth=Math.max(...zs)-minZ;
  const label=wing.label&&world(wing.label);
  let seed=(Math.imul(wing.pts[0][0]+1,73856093)^Math.imul(wing.pts[0][1]+1,19349663))>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const placed=[];
  for(let attempt=0;attempt<100&&placed.length<2;attempt++) {
    const x=minX+random()*width,z=minZ+random()*depth;
    // A .65 clearance contains the entire unit, including its base, on the roof.
    if(!inside(outline,x,z)||holes.some(h=>inside(h,x,z))||
      [outline,...holes].some(loop=>nearestEdge(loop,[x,z]).distance<.65)||
      (label&&Math.hypot(x-label[0],z-label[1])<1.15)||placed.some(p=>Math.hypot(x-p[0],z-p[1])<1.4))continue;
    placed.push([x,z]);
    box(x,wing.height+.08,z,.95,.12,.7,m.plinth);
    box(x,wing.height+.28,z,.78,.28,.54,m.metal);
    box(x,wing.height+.44,z,.84,.045,.6,m.plinth);
  }
}

function entranceCanopy(kit,route) {
  const {box,m}=kit,wing=WINGS.find(w=>w.id===route.wing);
  const [doorX,doorZ]=world(route.points[route.points.length-1]);
  const edge=nearestEdge(wing.pts.map(world),[doorX,doorZ]);
  const length=Math.hypot(edge.dx,edge.dz),nx=edge.dz/length,nz=-edge.dx/length;
  const rotation=-Math.atan2(edge.dz,edge.dx),height=Math.min(2.15,wing.height-.35);
  // Span from the actual facade to the route endpoint, even where the schema
  // leaves an entrance apron between the wall and the navigation door.
  const depth=Math.max(.95,(doorX-edge.x)*nx+(doorZ-edge.z)*nz+.25);
  box(edge.x+nx*(depth/2-.06),height,edge.z+nz*(depth/2-.06),2.1,.12,depth,m.trim,rotation);
  for(const sign of [-1,1])box(edge.x+nx*(depth-.2)+sign*edge.dx/length*.88,(height-.06)/2,
    edge.z+nz*(depth-.2)+sign*edge.dz/length*.88,.065,height-.06,.065,m.metal);
  box(edge.x+nx*.07,.88,edge.z+nz*.07,1.35,1.76,.14,m.glass,rotation);
}

function facade(kit,points,height,{floors=3,spacing=.76,windowWidth=.36,windowHeight=.48,base=.14}={}) {
  const {box,windowBay,m}=kit;
  // Outer loops run clockwise in the XZ plane, courtyard loops the other way.
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const angle=-Math.atan2(dz,dx),normal=[dz/length,-dx/length];
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    box(mid[0],base+.13,mid[1],length,.26,.095,m.plinth,angle);
    // Pale coping projects beyond the bevel and meets at the roof corners.
    box(mid[0],height+.065,mid[1],length+.12,.13,.23,m.trim,angle);
    box(mid[0],height-.18,mid[1],length,.055,.09,m.trim,angle);
    for(let floor=1;floor<floors;floor++)box(mid[0]+normal[0]*.045,base+floor*(height-base)/floors,mid[1]+normal[1]*.045,length,.035,.08,m.trim,angle);
    const count=Math.max(0,Math.floor((length-.3)/spacing));
    for(let n=0;n<count;n++)for(let f=0;f<floors;f++) {
      const t=(n+.5)/count,x=a[0]+dx*t+normal[0]*.055,z=a[1]+dz*t+normal[1]*.055;
      const y=base+(f+.55)*(height-base)/floors;
      windowBay(x,y,z,windowWidth,Math.min(windowHeight,(height-base)/floors*.65),Math.PI-Math.atan2(dz,dx),n+f*7);
    }
  }
}

// All coordinates here are world units; pavement is at y=-.105.
function territoryDetails(kit) {
  const {streetPart:part,bench,box,m}=kit;
  const metal=0x647377,wood=0xad916e;
  // Five uninterrupted spans leave a 3-unit opening centred on GATE (2.25,13.3).
  const spans=[[-23.1,-13.25,23.1,-13.25],[-23.1,-13.25,-23.1,13.25],
    [23.1,-13.25,23.1,13.25],[-23.1,13.25,.75,13.25],[3.75,13.25,23.1,13.25]];
  for(const [ax,az,bx,bz] of spans) {
    const length=Math.hypot(bx-ax,bz-az),count=Math.ceil(length/3);
    for(let i=0;i<=count;i++)part('box',ax+(bx-ax)*i/count,.12,az+(bz-az)*i/count,.055,.45,.055,metal);
    part('box',(ax+bx)/2,.22,(az+bz)/2,length,.045,.045,metal,-Math.atan2(bz-az,bx-ax));
  }
  if(kit.mobile)return;
  // Avenue edges and side aprons: keep the x=2.25 / z=8.9 route axes free.
  for(const [x,z,r] of [[.55,7.7,Math.PI/2],[3.95,7.7,-Math.PI/2],
    [.55,10.5,Math.PI/2],[3.95,10.5,-Math.PI/2],[.45,5.4,0],
    [-10.7,6.5,Math.PI/2],[15.25,7.1,-Math.PI/2]])bench(x,z,-.105,r);
  // Three inverted-U stands per rack, beside the B and N entrance aprons.
  for(const [x,z] of [[-8.25,6.4],[12.75,7.1]])for(let i=0;i<3;i++) {
    const xx=x+i*.22;
    for(const dz of [-.22,.22])part('box',xx,.12,z+dz,.035,.45,.035,metal);
    part('box',xx,.345,z,.035,.035,.475,metal);
  }
  // South-west parking bay, between the cross-path (z=8.9) and ring road (11.6).
  box(-11.8,-.102,10.55,10.4,.025,1.35,m.paving);
  const paint=[0x809295,0x9a8a7b,0x647585,0xa9aca2];
  for(let i=0;i<8;i++) {
    const x=-16+i*1.2,z=10.55;
    part('rounded',x,.075,z,.4,.22,.78,paint[i%4]);
    part('rounded',x,.225,z-.035,.34,.19,.4,0x52656e);
    for(const dx of [-.205,.205])for(const dz of [-.24,.24])
      part('box',x+dx,-.015,z+dz,.065,.16,.14,0x394345);
    part('box',x,-.084,11.12,.025,.016,.2,0xe8e2d6);
  }
  // Seeded small offsets stay on the path shoulders, away from navigation lines.
  let seed=7319;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const people=[[1.55,6.2],[2.95,6.8],[1.55,8],[2.95,9.7],[1.55,11.3],
    [2.95,12.4],[-3,9.15],[-5.2,8.65],[-7.2,9.15],[-8.9,7.8],
    [-10.05,6.1],[6.5,8.65],[8.4,9.15],[10.5,8.65],[12.4,9.15],
    [13.45,7.65],[14.55,6.95],[1.55,5.35],[-18,11.85],[18,11.35]];
  const clothing=[0x697e89,0x968579,0x788872,0x8d7476];
  for(const [px,pz] of people) {
    const x=px+(random()-.5)*.12,z=pz+(random()-.5)*.12,h=.27+random()*.05;
    part('cylinder',x,-.105+h/2,z,.065,h,.065,clothing[Math.floor(random()*4)]);
    part('sphere',x,-.105+h+.065,z,.065,.065,.065,0xc8b39c);
  }
  for(const x of [-.6,5.1]) {
    part('cylinder',x,.98,5.4,.022,2.17,.022,metal);
    part('box',x+.19,1.77,5.4,.36,.4,.018,0x9caaae);
    part('box',x,-.06,5.4,.22,.09,.22,wood);
  }
}

export function buildTerritory(kit,picks) {
  const {box,prism,text,plant,lamp,hedge,bench,m}=kit;
  box(0,-.46,0,47,.5,27,m.concrete);
  box(0,-.18,0,46.9,.1,26.9,m.lawn);
  // Дорожки: кольцо по периметру, аллея от главного входа и площадка перед ним.
  for(const sign of [-1,1]){box(0,-.125,sign*11.6,44.6,.03,1.05,m.paving);box(sign*21.7,-.125,0,1.05,.03,24.2,m.paving);}
  box(2.25,-.12,8.6,2.6,.03,6.2,m.paving);
  box(2.25,-.118,5.6,7.5,.03,2.4,m.paving);
  for(const sign of [-1,1])box(sign*9,-.12,8.9,15.5,.03,.75,m.paving);
  // A dark bevel and a thin light edge make the base read as a physical model.
  for(const sign of [-1,1]){box(0,-.31,sign*13.45,46.9,.035,.03,m.trim);box(sign*23.45,-.31,0,.03,.035,26.9,m.trim);}
  for(const [x,z,w,d] of [[397,100,11,88],[416,145,40,9],[742,134,10,44],[132,282,42,9],[450,253,31,9]]) {
    const [wx,wz]=world([x,z]);box(wx,.63,wz,w/20,1.4,d/20,m.stone);
  }
  for(const wing of WINGS) {
    const outline=wing.pts.map(world),holes=(wing.holes||[]).map((loop)=>loop.map(world));
    const cap=m.roof.clone();cap.color.set(0x80878a);
    const mesh=prism(outline,holes,wing.height,0,cap,m.stone);
    mesh.userData.wing=wing;if(wing.id)picks.push(mesh);
    facade(kit,outline,wing.height,{floors:Math.max(2,Math.round(wing.height/.78))});
    for(const hole of holes)facade(kit,signedArea(hole)>0?[...hole].reverse():hole,wing.height,{floors:Math.max(2,Math.round(wing.height/.78))});
    roofEquipment(kit,wing,outline,holes);
    if(wing.id){const [x,z]=world(wing.label);text(wing.id,x,wing.height+.18,z,1.3);}
  }
  for(const [px,pz] of [[176,222],[493,217]]) {
    const [x,z]=world([px,pz]);box(x,-.045,z,2,.1,1.9,m.lawn);plant(x-.45,z,0,.9,true);bench(x+.7,z+.5);
  }
  for(let i=0;i<5;i++){const [x,z]=world([430+i*35,350]);plant(x,z,-.1,1,true);}
  // Аллеи: деревья вдоль дорожек, размер слегка меняется, как у настоящих посадок.
  const size=(i)=>.78+((i*37)%9)/22;
  let k=0;
  for(let x=-21.2;x<=21.2;x+=1.75){for(const z of [-12.55,12.55]){
    if(Math.hypot(x-2.25,z-13)<1.5)continue; // Clearance around the avenue's gate lamp.
    plant(x,z,-.12,size(k++),true);
  }}
  for(let z=-10.6;z<=10.6;z+=1.75){for(const x of [-22.75,22.75])plant(x,z,-.12,size(k++),true);}
  for(const x of [-.6,5.1])for(let z=6.6;z<=10.6;z+=1.4)plant(x,z,-.12,size(k++)*.85,true);
  // Lamps sit on the paths, inside the perimeter tree rows and between avenue trees.
  for(let x=-19.25;x<=19.25;x+=3.5)for(const z of [-11.6,11.6])lamp(x,z,-.11);
  for(let z=-8.75;z<=8.75;z+=3.5)for(const x of [-21.7,21.7])lamp(x,z,-.11);
  for(const z of [6,9.5,13])lamp(2.25,z,-.11);
  // Leave the central approach and cross-path junction open for the route.
  for(const x of [-1.8,6.3])hedge(x,5.6,.45,2.2,-.12);
  for(const x of [-.1,4.6])hedge(x,6.95,1.5,.4,-.12);
  for(const x of [-13,-7,9,15])hedge(x,9.65,3.2,.45,-.12);
  const [ex,ez]=world([455,278]);
  for(let i=0;i<5;i++)box(ex,.08-i*.035,ez+.5+i*.19,2.7,.2-i*.035,.22,m.trim);
  for(const id of ['А','Б','С'])entranceCanopy(kit,territoryRoute(id));
  text('ВХОД',ex,.01,ez+2.4,1.65);
  territoryDetails(kit);
}

export function buildBuilding(kit,layout,floors=6) {
  const {box,prism,windowBay,plant,lamp,hedge,bench,text,m}=kit;
  const H=layout.height||224,X=(x)=>(x-300)/20,Z=(z)=>(z-H/2)/20;
  const height=floors*1.18+.3;
  const outline=[[12,12],[588,12],[588,H-12],[12,H-12]].map(([x,z])=>[X(x),Z(z)]);
  const hole=H===400?[[86,94],[264,94],[264,158],[336,158],[336,94],[514,94],[514,286],[336,286],[336,220],[264,220],[264,286],[86,286]].map(([x,z])=>[X(x),Z(z)]).reverse():null;
  box(0,-.38,0,33,.4,H/20+3.4,m.concrete);
  box(0,-.14,0,32.9,.1,H/20+3.3,m.lawn);
  // Мощёная отмостка вокруг здания и площадь перед входом; по краям газона — деревья.
  box(0,-.085,0,30.6,.03,H/20-.2,m.paving);
  box(0,-.08,H/40+.9,8.5,.03,2.2,m.paving);
  const D=H/20+3.3,size=(i)=>.72+((i*29)%7)/20;
  let k=0;
  for(let x=-15.2;x<=15.2;x+=1.9){if(Math.abs(x)>4.6)plant(x,D/2-.75,-.1,size(k++),true);plant(x,-D/2+.75,-.1,size(k++),true);}
  for(let z=-D/2+2.4;z<=D/2-2.4;z+=1.9)for(const x of [-15.7,15.7])plant(x,z,-.1,size(k++),true);
  prism(outline,hole?[hole]:[],height,.01,m.roof,m.stone);
  facade(kit,outline,height,{floors,spacing:.82,windowWidth:.48,windowHeight:.71,base:.28});
  if(hole)facade(kit,hole,height,{floors,spacing:.88,windowWidth:.46,windowHeight:.68,base:.28});
  // Recessed roof equipment with grilles, hatch, ducts and concrete upstands.
  for(const [x,z] of [[-9,Z(42)],[6,Z(42)],[-8,Z(H-48)],[9,Z(H-48)]]) {
    box(x,height+.11,z,1.5,.18,.85,m.plinth);
    box(x,height+.33,z,1.25,.3,.64,m.metal);
    for(let i=0;i<5;i++)box(x-.46+i*.23,height+.49,z,.035,.025,.53,m.reveal,0,1);
    box(x+1.1,height+.1,z,.9,.16,.26,m.metal);
  }
  box(0,height+.06,Z(42),1.6,.08,1.15,m.trim);
  box(0,height+.13,Z(42),1.35,.07,.9,m.glassLight);
  // Main entrance: glazing, paired doors, canopy, slender columns, broad steps.
  const front=Z(H-12);
  box(0,1.25,front+.09,3.8,2.5,.18,m.reveal);
  for(let i=0;i<4;i++)windowBay(-1.41+i*.94,1.28,front+.18,.82,2.17,0,i);
  box(0,2.64,front+.9,4.65,.18,2.25,m.trim);
  box(0,2.76,front+.9,4.7,.065,2.3,m.plinth);
  for(const sign of [-1,1])box(sign*2.04,1.26,front+1.65,.095,2.52,.095,m.metal);
  for(let i=0;i<5;i++)box(0,.16-i*.055,front+1.75+i*.18,4.6,.32-i*.055,.25,m.trim);
  for(const x of [-3.6,3.6])lamp(x,H/40+1.8,-.065);
  for(const sign of [-1,1])hedge(sign*2.65,front+2.05,.4,1.25,-.065);
  for(const sign of [-1,1]){
    box(sign*3.2,.12,front+1.1,.85,.45,.85,m.trim);plant(sign*3.2,front+1.1,.35,.65);
    box(sign*5.3,1.2,front+.7,.035,2.6,.035,m.metal);
    box(sign*5.05,1.88,front+.7,.46,.72,.025,m.blue);
  }
  for(const p of layout.courts||[]) {
    const cx=X(p.x+p.w/2),cz=Z(p.y+p.h/2);
    box(cx,-.04,cz,p.w/20-.8,.12,p.h/20-.8,m.lawn);
    box(cx,-.01,cz,.6,.045,p.h/20-.5,m.paving);
    for(const sign of [-1,1]){plant(cx+sign*2,cz+sign*2,-.02,1.1,true);bench(cx+sign*1.1,cz);}
  }
  text('МГИМО',0,height+.2,Z(H-44),2.7);
  // Visual subdivision for the larger model, not more polygons at a distance.
  for(const sign of [-1,1])for(let i=0;i<8;i++) {
    box(sign*14.45,.15+i*.018,front+2.7-i*.4,.025,.045,.25,m.trim,0,1);
  }
  return {height};
}
