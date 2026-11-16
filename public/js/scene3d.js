import * as T from './vendor/three.module.js';
import {S} from './state.js';
import {floorLayout, roomState,routeForFloor} from './campus.js';

import {createArchitectureKit, studioEnvironment} from './architecture-kit.js';
import {buildTerritory, buildBuilding} from './architecture-exterior.js';
import {mountControls} from './scene-controls.js';


export function mountScene(host) {
  const territory = host.dataset.scene === 'territory';
  const renderer = new T.WebGLRenderer({antialias:true, alpha:true, powerPreference:'low-power'});
  const mobile=matchMedia('(max-width: 700px)').matches || (navigator.deviceMemory || 8)<=4;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  renderer.setPixelRatio(1);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new T.Scene();
  const model = new T.Group();
  scene.add(model);
  const camera = new T.OrthographicCamera(-25,25,17,-17,.1,200);
  const hemi = new T.HemisphereLight(0xe9f1f5,0x8d897b,1.5);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff4e5,2.65);
  sun.position.set(-20,35,-10); sun.castShadow=true;
  sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
  Object.assign(sun.shadow.camera,{left:territory?-27:-21,right:territory?27:21,top:territory?27:23,bottom:territory?-27:-23,near:1,far:100});
  sun.shadow.bias=-.0003; sun.shadow.normalBias=.035;
  scene.add(sun);
  const fill = new T.DirectionalLight(0xc6dce8,.8);
  fill.position.set(15,15,22); scene.add(fill);
  const kit=createArchitectureKit(model);
  const {box,text,plant,bench,windowBay,material,m}=kit;
  const {stone:ivory,concrete,trim,wood,metal,blue}=m;
  const cube=new T.BoxGeometry(1,1,1),picks=[];
  const floorGroup=new T.Group(),buildingGroup=new T.Group();
  if(!territory){model.add(floorGroup,buildingGroup);kit.setGroup(floorGroup);}
  let buildingHeight=0;
  if(territory) {
    buildTerritory(kit,picks);
  } else {
    const b=host.dataset.building, floor=Number(host.dataset.floorNumber), pair=Number(host.dataset.pairNumber);
    const mine=new Set((host.dataset.mine||'').split(','));
    const layout=floorLayout(b,floor), height=layout.height||224, width=600;
    const X=(x)=>(x-width/2)/20,Z=(z)=>(z-height/2)/20;
    const plates=layout.plates||[{x:8,y:8,w:584,h:208}];
    const corridors=layout.corridors||[{x:8,y:94,w:584,h:36}];
    const tiles=[];
    for(const p of plates)box(X(p.x+p.w/2),-.18,Z(p.y+p.h/2),p.w/20,.34,p.h/20,concrete);
    for(const p of corridors)box(X(p.x+p.w/2),.015,Z(p.y+p.h/2),p.w/20,.04,p.h/20,material('terrazzo',0xd8d6cc));
    const tileColors={free:0xd6dfce,busy:0xe5ddd0,staff:0xe6c1ab,off:0xe0dfd9,mine:0xb2cbd6,unknown:0xe4e7e3};
    for(const r of layout.boxes) {
      const state=mine.has(r.r.key)?'mine':roomState(r.r.key,pair).cls;
      const selected=r.r.key===host.dataset.selectedRoom;
      tiles.push({room:r.r.key,x:X(r.x+r.w/2),z:Z(r.y+r.h/2),w:(r.w-2)/20,d:(r.h-2)/20,color:selected?0x7caeb6:tileColors[state]});
      const x=X(r.x),z=Z(r.y),w=r.w/20,d=r.h/20;
      const vertical=r.side==='w'||r.side==='e';
      const wallH=1.12;
      // Corridor wall has an actual door opening, rather than a line over a wall.
      if(!vertical) {
        const outer=r.side==='n'?z:z+d, inner=r.side==='n'?z+d:z;
        box(x+w/2,wallH/2,outer,w,wallH,.09);
        box(x,wallH/2,z+d/2,.09,wallH,d);
        box(x+w,wallH/2,z+d/2,.09,wallH,d);
        box(x+.16,wallH/2,inner,.32,wallH,.08);
        box(x+(w+.95)/2,wallH/2,inner,Math.max(.01,w-.95),wallH,.08);
        box(x+.63,.48,inner+(r.side==='n'?-.18:.18),.55,.96,.045,wood,.6);
        for(let wx=.5;wx<w-.2;wx+=.9)windowBay(x+wx,.7,outer+(r.side==='n'?-.065:.065),.58,.48,r.side==='n'?Math.PI:0);
        box(x+.83,.51,inner+(r.side==='n'?-.2:.2),.11,.025,.08,metal,.6,1);
        box(x+w/2,.1,outer,w,.1,.12,trim);
      } else {
        const outer=r.side==='w'?x:x+w, inner=r.side==='w'?x+w:x;
        box(outer,wallH/2,z+d/2,.09,wallH,d);
        box(x+w/2,wallH/2,z,w,wallH,.09);box(x+w/2,wallH/2,z+d,w,wallH,.09);
        box(inner,wallH/2,z+.16,.08,wallH,.32);
        box(inner,wallH/2,z+(d+.95)/2,.08,wallH,Math.max(.01,d-.95));
        box(inner+(r.side==='w'?-.18:.18),.48,z+.63,.045,.96,.55,wood,.6);
        for(let wz=.5;wz<d-.2;wz+=.9)windowBay(outer+(r.side==='w'?-.065:.065),.7,z+wz,.58,.48,r.side==='w'?-Math.PI/2:Math.PI/2);
        box(inner+(r.side==='w'?-.2:.2),.51,z+.83,.08,.025,.11,metal,.6,1);
        box(outer,.1,z+d/2,.12,.1,d,trim);
      }
      const kind=r.r.kind.toLowerCase();
      if(kind.includes('спорт')) {
        box(x+w/2,.09,z+d/2,w*.75,.02,d*.75,material('court',0xa6b8ab));
        box(x+w/2,.105,z+d/2,.03,.015,d*.75,trim);
      } else {
        const rotation={n:0,s:Math.PI,w:Math.PI/2,e:-Math.PI/2}[r.side];
        const rw=vertical?d:w,rd=vertical?w:d;
        const cols=Math.max(1,Math.floor((rw-.45)/.82)),rows=Math.max(1,Math.min(4,Math.floor((rd-.6)/.86)));
        const part=(u,v,yy,ww,hh,dd,mat,detail=0)=>box(x+w/2+u*Math.cos(rotation)+v*Math.sin(rotation),yy,z+d/2-u*Math.sin(rotation)+v*Math.cos(rotation),ww,hh,dd,mat,rotation,detail);
        for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
          const u=-rw/2+.45+col*(rw-.65)/cols,v=-rd/2+.5+row*(rd-.8)/rows;
          part(u,v,.43,.57,.055,.34,wood);
          for(const s of [-1,1]){part(u+s*.22,v,.21,.035,.42,.28,metal);part(u+s*.22,v,.07,.085,.035,.32,metal,1);}
          part(u,v+.29,.27,.33,.065,.3,blue);part(u,v+.43,.45,.33,.28,.04,blue);
          for(const s of [-1,1]){part(u+s*.13,v+.2,.13,.025,.26,.025,metal,1);part(u+s*.13,v+.4,.2,.025,.4,.025,metal,1);}
          if(kind.includes('компьютер')){
            part(u,v,.65,.32,.22,.045,metal);part(u,v+.027,.65,.28,.17,.009,m.glassLight);
            part(u,v,.52,.04,.12,.04,metal,1);part(u,v+.1,.47,.29,.016,.1,trim,1);
          }
        }
        part(0,-rd/2+.08,.7,Math.min(rw*.6,1.8),.5,.05,material('board-dark',0x354f48));
        part(0,-rd/2+.13,.435,Math.min(rw*.6,1.8),.025,.09,metal,1);
      }
      text(r.r.room,x+w/2,1.32,z+d/2,Math.min(1.5,Math.max(.9,w*.65)));
    }
    if(tiles.length) {
      const tileMesh=new T.InstancedMesh(cube,material('room-floors',0xffffff),tiles.length),transform=new T.Object3D();
      tiles.forEach((tile,i)=>{transform.position.set(tile.x,.035,tile.z);transform.scale.set(tile.w,.08,tile.d);transform.updateMatrix();tileMesh.setMatrixAt(i,transform.matrix);tileMesh.setColorAt(i,new T.Color(tile.color));});
      tileMesh.userData.rooms=tiles.map((t)=>t.room);tileMesh.receiveShadow=true;floorGroup.add(tileMesh);picks.push(tileMesh);
    }
    const route=routeForFloor(b,floor);
    if(route?.points.length>1) {
      const points=route.points.map(([x,z])=>new T.Vector3(X(x),.18,Z(z))),path=new T.CurvePath();
      for(let i=1;i<points.length;i++)path.add(new T.LineCurve3(points[i-1],points[i]));
      for(const [radius,color,order] of [[.12,0xffffff,20],[.065,0x166b91,21]]) {
        const line=new T.Mesh(new T.TubeGeometry(path,Math.max(32,points.length*6),radius,6,false),new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false}));
        line.renderOrder=order;floorGroup.add(line);
      }
      for(const [index,p] of [[0,points[0]],[1,points.at(-1)]]) {
        const ring=new T.Mesh(new T.RingGeometry(.15,.26,20),new T.MeshBasicMaterial({color:index?0x166b91:0x279197,depthTest:false,depthWrite:false,side:T.DoubleSide,toneMapped:false}));
        ring.rotation.x=-Math.PI/2;ring.position.copy(p);ring.renderOrder=22;floorGroup.add(ring);
      }
      const pin=new T.Mesh(new T.ConeGeometry(.17,.45,8),new T.MeshBasicMaterial({color:0x166b91,toneMapped:false}));
      pin.rotation.z=Math.PI;pin.position.copy(points.at(-1)).add(new T.Vector3(0,.45,0));floorGroup.add(pin);
      host.dataset.routePoints=JSON.stringify(route.points);host.dataset.routeLevel=String(floor);
    }
    // Central stair and lift core; repeated treads remain individually visible.
    const cx=X(280),cz=Z(height>224?242:24);
    for(let i=0;i<10;i++)box(cx,.05+i*.055,cz+i*.15,.95,.1+i*.11,.16,trim);
    box(cx-.55,.7,cz+.7,.04,.8,1.6,metal);box(cx+.55,.7,cz+.7,.04,.8,1.6,metal);
    box(cx+1.75,.6,cz+.4,.95,1.2,1.2,concrete);box(cx+1.75,.58,cz+1.02,.7,1.05,.025,metal);
    text('ЛИФТ',cx+1.75,1.55,cz+.4,1);
    for(const p of corridors.filter((p)=>p.w>100)) {
      for(let i=0;i<2;i++){const bx=X(p.x+60+i*(p.w-120)),bz=Z(p.y+1);bench(bx,bz);plant(bx+1,bz);}
      for(let j=20;j<p.w;j+=20)box(X(p.x+j),.045,Z(p.y+p.h/2),.012,.012,p.h/20,material('grout',0xc2c1b7));
    }
    for(const p of layout.courts||[]) {
      box(X(p.x+p.w/2),-.35,Z(p.y+p.h/2),p.w/20,.08,p.h/20,material('lawn',0x9aab89));
      plant(X(p.x+p.w/2),Z(p.y+p.h/2),-.25,1.15,true);
      for(const sign of [-1,1]) {
        box(X(p.x+p.w/2),.12,Z(sign<0?p.y:p.y+p.h),p.w/20,.24,.085,trim);
        box(X(sign<0?p.x:p.x+p.w),.12,Z(p.y+p.h/2),.085,.24,p.h/20,trim);
      }
    }
  }

  if(!territory) {
    kit.setGroup(buildingGroup);
    const building=S.data.campus.buildings.find((b)=>b.id===host.dataset.building);
    buildingHeight=buildBuilding(kit,floorLayout(host.dataset.building,Number(host.dataset.floorNumber)),building.floors).height;
  }
  kit.flush();
  const environment=studioEnvironment();scene.environment=environment;scene.environmentIntensity=.38;
  const ground=new T.Mesh(new T.PlaneGeometry(180,160),new T.ShadowMaterial({opacity:.22}));
  ground.rotation.x=-Math.PI/2;ground.position.y=territory?-.77:-.4;ground.receiveShadow=true;scene.add(ground);
  const stop=mountControls({host,renderer,scene,camera,model,territory,floorGroup,buildingGroup,picks,buildingHeight,ground,mobile,reduced});
  return ()=>{
    stop();environment.dispose();
    const geometries=new Set(),materials=new Set(),textures=new Set();
    scene.traverse((o)=>{if(o.geometry)geometries.add(o.geometry);for(const mat of [o.material||[]].flat()){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}o.dispose?.();});
    textures.forEach((v)=>v.dispose());materials.forEach((v)=>v.dispose());geometries.forEach((v)=>v.dispose());sun.shadow.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  };
}
