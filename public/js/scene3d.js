import * as T from './vendor/three.module.js';
import {S} from './state.js';
import {floorLayout, roomState,routeForFloor,currentRoute} from './campus.js';

import {createArchitectureKit, studioEnvironment} from './architecture-kit.js';
import {territoryRoute} from './campus-geometry.js';
import {buildTerritory, buildBuilding} from './architecture-exterior.js';
import {mountControls} from './scene-controls.js';


let sceneMode='day';
try { if(localStorage.getItem('campusSceneMode')==='evening')sceneMode='evening'; } catch {}
const modeListeners=new Set();

export function mountScene(host) {
  const territory = host.dataset.scene === 'territory';
  const renderer = new T.WebGLRenderer({antialias:true, alpha:true, powerPreference:'low-power'});
  const mobile=matchMedia('(max-width: 700px)').matches || (navigator.deviceMemory || 8)<=4;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  renderer.setPixelRatio(1);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new T.Scene();
  const model = new T.Group();
  scene.add(model);
  const camera = new T.OrthographicCamera(-25,25,17,-17,.1,200);
  const hemi = new T.HemisphereLight(0xdde9f3,0x7f8c6c,1.25);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe7c7,3.1);
  sun.position.set(-26,27,-16); sun.castShadow=true;
  sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
  Object.assign(sun.shadow.camera,{left:territory?-27:-21,right:territory?27:21,top:territory?27:23,bottom:territory?-27:-23,near:1,far:100});
  sun.shadow.bias=-.0003; sun.shadow.normalBias=.035; sun.shadow.radius=3;
  scene.add(sun);
  const fill = new T.DirectionalLight(0xa9c6e0,.6);
  fill.position.set(15,15,22); scene.add(fill);
  const kit=createArchitectureKit(model);
  const {box,text,plant,bench,windowBay,material,m}=kit;
  const {stone:ivory,concrete,trim,wood,metal,blue}=m;
  const cube=new T.BoxGeometry(1,1,1),picks=[];
  const floorGroup=new T.Group(),buildingGroup=new T.Group();
  if(!territory){model.add(floorGroup,buildingGroup);kit.setGroup(floorGroup);}
  const walkers=[];
  const isVisible=(object)=>{
    for(let o=object;o;o=o.parent)if(!o.visible)return false;
    return true;
  };
  function addWalker(path,group,radius) {
    if(!path.curves.length||path.getLength()<=.001)return;
    const marker=new T.Group();
    const material=(color,opacity=1)=>new T.MeshBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false,toneMapped:false,side:T.DoubleSide});
    const sphere=new T.Mesh(new T.SphereGeometry(radius,16,12),material(0xe4ffff));
    sphere.position.y=radius*1.6;marker.add(sphere);
    // Overlapping translucent rings soften the halo without textures or shaders.
    for(let i=0;i<4;i++) {
      const halo=new T.Mesh(new T.RingGeometry(radius*.65,radius*(1.6+i*.35),32),material(0x65e4ff,.12-i*.025));
      halo.rotation.x=-Math.PI/2;halo.position.y=.025;marker.add(halo);
    }
    marker.traverse((o)=>{o.raycast=()=>{};o.castShadow=false;o.renderOrder=40;});
    group.add(marker);
    marker.position.copy(path.getPoint(reduced.matches?1:0));
    walkers.push({path,marker,elapsed:0});
  }
  const hasAnimation=()=>walkers.some(({marker})=>isVisible(marker));
  const animate=(dt)=>{
    for(const walker of walkers) {
      if(!isVisible(walker.marker))continue;
      walker.elapsed=(walker.elapsed+dt)%6.8;
      // CurvePath.getPoint uses segment lengths, keeping speed constant at corners.
      walker.marker.position.copy(walker.path.getPoint(reduced.matches?1:Math.min(walker.elapsed/6,1)));
    }
  };
  let buildingHeight=0,xray=null;
  const ghosts=new Map();
  // Рентген корпуса: фасад полупрозрачный, внутри — путь от входа к лифту, подъём и коридор до двери аудитории.
  function buildXray(route,floorsCount) {
    const keep=new Set(Object.entries(m).filter(([k])=>/lawn|soil|paving|leaf|bark|hedge|grass|concrete/i.test(k)).map(([,v])=>v));
    const ghost=(mat)=>{
      if(keep.has(mat))return mat;
      if(!ghosts.has(mat)){const g=mat.clone();g.transparent=true;g.opacity=.12;g.depthWrite=false;ghosts.set(mat,g);}
      return ghosts.get(mat);
    };
    buildingGroup.traverse((o)=>{if(!o.isMesh||o.userData.labels)return;const before=o.material;o.material=Array.isArray(before)?before.map(ghost):ghost(before);if([before].flat().some((mat)=>!keep.has(mat)))o.castShadow=false;});
    const level=(f)=>.3+(f-1)*1.18;
    const slab=(f,color,opacity)=>{
      const layout=floorLayout(route.target.building,f),H=layout.height||224;
      const mat=new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false});
      for(const p of layout.plates||[{x:8,y:8,w:584,h:208}]){const s=new T.Mesh(cube,mat);s.scale.set(p.w/20,.06,p.h/20);s.position.set((p.x+p.w/2-300)/20,level(f),(p.y+p.h/2-H/2)/20);buildingGroup.add(s);}
      return H;
    };
    const start=route.segments[0].floor,end=route.target.floor;
    // Контуры всех этажей дают отсчёт уровней; нужный этаж залит.
    const edgeMat=new T.LineBasicMaterial({color:0x7f979d,transparent:true,opacity:.55,depthWrite:false});
    for(let f=1;f<=floorsCount;f++){
      const layout=floorLayout(route.target.building,f),H=layout.height||224;
      for(const p of layout.plates||[{x:8,y:8,w:584,h:208}]){const e=new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(p.w/20,p.h/20).rotateX(-Math.PI/2)),edgeMat);e.position.set((p.x+p.w/2-300)/20,level(f),(p.y+p.h/2-H/2)/20);buildingGroup.add(e);}
    }
    if(start!==end)slab(start,0x279197,.18);
    const H=slab(end,0x5f93a6,.32);
    const points=[];
    for(const s of route.segments)for(const [x,z] of s.points)points.push(new T.Vector3((x-300)/20,level(s.floor)+.12,(z-H/2)/20));
    const clean=points.filter((p,i)=>!i||p.distanceTo(points[i-1])>.001),path=new T.CurvePath();
    for(let i=1;i<clean.length;i++)path.add(new T.LineCurve3(clean[i-1],clean[i]));
    for(const [radius,color,order] of [[.16,0xffffff,30],[.09,0x166b91,31]]) {
      const line=new T.Mesh(new T.TubeGeometry(path,Math.max(48,clean.length*8),radius,6,false),new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false}));
      line.renderOrder=order;buildingGroup.add(line);
    }
    for(const [p,color] of [[clean[0],0x279197],[clean.at(-1),0x166b91]]) {
      const ring=new T.Mesh(new T.RingGeometry(.2,.36,24),new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false,side:T.DoubleSide,toneMapped:false}));
      ring.rotation.x=-Math.PI/2;ring.position.copy(p);ring.renderOrder=32;buildingGroup.add(ring);
    }
    if(start!==end) {
      // Шахта лифта: полупрозрачный столб между этажами отправления и прибытия.
      const lift=route.segments[0].points.at(-1),shaft=new T.Mesh(cube,new T.MeshBasicMaterial({color:0x279197,transparent:true,opacity:.22,depthWrite:false,toneMapped:false}));
      const y0=level(Math.min(start,end)),y1=level(Math.max(start,end))+1;shaft.scale.set(.9,y1-y0,.9);shaft.position.set((lift[0]-300)/20,(y0+y1)/2,(lift[1]-H/2)/20);buildingGroup.add(shaft);
    }
    addWalker(path,buildingGroup,.16);
    const target=clean.at(-1),pin=new T.Mesh(new T.ConeGeometry(.22,.6,12),new T.MeshBasicMaterial({color:0x166b91,toneMapped:false,depthTest:false}));
    pin.rotation.z=Math.PI;pin.position.copy(target).add(new T.Vector3(0,.55,0));pin.renderOrder=33;buildingGroup.add(pin);
    host.dataset.xray=`${start}-${end}`;
  }
  if(territory) {
    buildTerritory(kit,picks);
    const route=territoryRoute(host.dataset.routeBuilding);
    if(route) {
      const W=([x,z])=>new T.Vector3((x-410)/20,-.02,(z-190)/20);
      const points=route.points.map(W),path=new T.CurvePath();
      for(let i=1;i<points.length;i++)path.add(new T.LineCurve3(points[i-1],points[i]));
      // Широкая светлая подложка и насыщенная линия поверх: читается сверху и под углом.
      for(const [radius,color,order] of [[.24,0xffffff,20],[.13,0x1f6f98,21]]) {
        const line=new T.Mesh(new T.TubeGeometry(path,points.length*24,radius,8,false),new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false}));
        line.renderOrder=order;model.add(line);
      }
      addWalker(path,model,.2);
      // Стрелки-шевроны вдоль пути показывают направление.
      const chevron=new T.Shape([[0,.22],[.2,-.08],[.09,-.08],[0,.06],[-.09,-.08],[-.2,-.08]].map(([x,y])=>new T.Vector2(x,y)));
      const chevGeo=new T.ShapeGeometry(chevron),chevMat=new T.MeshBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false,toneMapped:false,side:T.DoubleSide});
      const total=path.getLength();
      for(let d=1.1;d<total-.6;d+=1.3) {
        const p=path.getPointAt(d/total),t=path.getTangentAt(d/total),c=new T.Mesh(chevGeo,chevMat);
        c.rotation.set(-Math.PI/2,0,Math.atan2(-t.x,-t.z));c.position.set(p.x,.02,p.z);c.renderOrder=23;model.add(c);
      }
      const start=points[0],end=points.at(-1);
      for(const [p,color,inner,outer] of [[start,0x2a8f8f,.25,.45],[end,0x1f6f98,.32,.58]]) {
        const ring=new T.Mesh(new T.RingGeometry(inner,outer,32),new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false,side:T.DoubleSide,toneMapped:false}));
        ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.03,p.z);ring.renderOrder=24;model.add(ring);
      }
      const pin=new T.Mesh(new T.ConeGeometry(.32,.9,16),new T.MeshStandardMaterial({color:0x1f6f98,roughness:.35,metalness:.1,emissive:0x0d3d55,emissiveIntensity:.35}));
      pin.rotation.z=Math.PI;pin.position.set(end.x,1.15,end.z);pin.castShadow=true;model.add(pin);
      const head=new T.Mesh(new T.SphereGeometry(.34,24,16),pin.material);head.position.set(end.x,1.72,end.z);head.castShadow=true;model.add(head);
      text('ВХОД НА ТЕРРИТОРИЮ',start.x,.05,start.z+.9,3.2);
      for(const mesh of picks)if(mesh.userData.wing?.id===route.wing){mesh.material[0].color.set(0x5f93a6);}
      host.dataset.routeWing=route.wing;
    }
  } else {
    const b=host.dataset.building, floor=Number(host.dataset.floorNumber), pair=Number(host.dataset.pairNumber);
    const mine=new Set((host.dataset.mine||'').split(','));
    const layout=floorLayout(b,floor), height=layout.height||224, width=600;
    const X=(x)=>(x-width/2)/20,Z=(z)=>(z-height/2)/20;
    const plates=layout.plates||[{x:8,y:8,w:584,h:208}];
    const corridors=layout.corridors||[{x:8,y:94,w:584,h:36}];
    const tiles=[];
    for(const p of plates)box(X(p.x+p.w/2),-.18,Z(p.y+p.h/2),p.w/20,.34,p.h/20,concrete);
    for(const p of corridors)box(X(p.x+p.w/2),.015,Z(p.y+p.h/2),p.w/20,.04,p.h/20,material('terrazzo',0xded9d0,.94));
    const tileColors={free:0xd6dfce,busy:0xe5ddd0,staff:0xe6c1ab,off:0xe0dfd9,mine:0xb2cbd6,unknown:0xe4e7e3};
    for(const r of layout.boxes) {
      const state=mine.has(r.r.key)?'mine':roomState(r.r.key,pair).cls;
      const selected=r.r.key===host.dataset.selectedRoom;
      tiles.push({room:r.r.key,x:X(r.x+r.w/2),z:Z(r.y+r.h/2),w:(r.w-2)/20,d:(r.h-2)/20,color:selected?0x7caeb6:tileColors[state]});
      const x=X(r.x),z=Z(r.y),w=r.w/20,d=r.h/20;
      const vertical=r.side==='w'||r.side==='e';
      const wallH=1.12,partition=material('floor-partitions',0xf0ede5,.9);
      const wall=(xx,zz,ww,dd)=>box(xx,wallH/2,zz,ww,wallH,dd,partition,0,4);
      // SVG door spans 6..20 plan units; routing passes through its centre at 13.
      if(!vertical) {
        const outer=r.side==='n'?z:z+d, inner=r.side==='n'?z+d:z;
        wall(x+w/2,outer,w,.09);
        wall(x,z+d/2,.09,d);wall(x+w,z+d/2,.09,d);
        wall(x+.15,inner,.3,.08);
        wall(x+(w+1)/2,inner,w-1,.08);
        for(let wx=.5;wx<w-.2;wx+=.9)windowBay(x+wx,.7,outer+(r.side==='n'?-.065:.065),.58,.48,r.side==='n'?Math.PI:0);
        box(x+w/2,.1,outer,w,.1,.12,trim);
      } else {
        const outer=r.side==='w'?x:x+w, inner=r.side==='w'?x+w:x;
        wall(outer,z+d/2,.09,d);
        wall(x+w/2,z,w,.09);wall(x+w/2,z+d,w,.09);
        wall(inner,z+.15,.08,.3);
        wall(inner,z+(d+1)/2,.08,d-1);
        for(let wz=.5;wz<d-.2;wz+=.9)windowBay(outer+(r.side==='w'?-.065:.065),.7,z+wz,.58,.48,r.side==='w'?-Math.PI/2:Math.PI/2);
        box(outer,.1,z+d/2,.12,.1,d,trim);
      }
      const kind=r.r.kind.toLowerCase();
      if(kind.includes('спорт')) {
        box(x+w/2,.09,z+d/2,w*.75,.02,d*.75,material('court',0xa6b8ab));
        box(x+w/2,.105,z+d/2,.03,.015,d*.75,trim);
      } else if(r.r.seats>0) {
        kit.classroom(x,z,w,d,r.side,r.r.seats,mobile);
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
      addWalker(path,floorGroup,.14);
      host.dataset.routePoints=JSON.stringify(route.points);host.dataset.routeLevel=String(floor);
    }
    // Central stair and lift core; repeated treads remain individually visible.
    const cx=X(280),cz=Z(height>224?242:24);
    for(let i=0;i<10;i++)box(cx,.05+i*.055,cz+i*.15,.95,.1+i*.11,.16,trim);
    box(cx-.55,.7,cz+.7,.04,.8,1.6,metal);box(cx+.55,.7,cz+.7,.04,.8,1.6,metal);
    box(cx+1.75,.6,cz+.4,.95,1.2,1.2,concrete);box(cx+1.75,.58,cz+1.02,.7,1.05,.025,metal);
    text('ЛИФТ',cx+1.75,1.55,cz+.4,1);
    if(floor===1&&height===224) {
      // Вестибюль у главного входа посередине южного фасада, как на плане и под козырьком фасада.
      box(X(300),.03,Z(206),2.4,.05,.6,material('doormat',0x5d6a6c,.95));
      box(X(300),.6,Z(214),2.6,1.2,.06,m.glassLight||blue);
      text('ВХОД',X(300),1.32,Z(190),1.2);
    }
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
    const route=currentRoute();
    if(route?.target.building===host.dataset.building&&route.segments.length)xray={route,floors:building.floors};
    if(xray){const [x,z]=route.segments.at(-1).points.at(-1),H=floorLayout(host.dataset.building,route.target.floor).height||224;text(`АУД. ${route.target.room}`,(x-300)/20,buildingHeight+.4,(z-H/2)/20,2.4);}
  }
  kit.flush();
  if(xray)buildXray(xray.route,xray.floors);
  const environment=studioEnvironment();scene.environment=environment;scene.environmentIntensity=.62;
  const ground=new T.Mesh(new T.PlaneGeometry(180,160),new T.ShadowMaterial({opacity:.26}));
  ground.rotation.x=-Math.PI/2;ground.position.y=territory?-.77:-.4;ground.receiveShadow=true;scene.add(ground);
  const stop=mountControls({host,renderer,scene,camera,model,territory,floorGroup,buildingGroup,picks,buildingHeight,ground,mobile,reduced,animate,hasAnimation});
  const modeButton=host.querySelector('[data-scene-mode]');
  const applyMode=(draw=true)=>{
    const evening=sceneMode==='evening';
    host.classList.toggle('scene-evening',evening);
    host.dataset.lighting=sceneMode;
    if(modeButton){modeButton.textContent=evening?'День':'Вечер';modeButton.setAttribute('aria-pressed',String(evening));}
    sun.color.setHex(evening?0xffa35c:0xffe7c7);
    sun.position.set(-26,evening?9:27,-16);sun.intensity=evening?1.15:3.1;
    hemi.color.setHex(evening?0x294b91:0xdde9f3);
    hemi.groundColor.setHex(evening?0x34394c:0x7f8c6c);hemi.intensity=evening?.75:1.25;
    fill.intensity=evening?.25:.6;
    renderer.toneMappingExposure=evening?.94:1.08;
    scene.environmentIntensity=evening?.22:.62;
    kit.setEvening(evening);
    // Полупрозрачные копии фасада в режиме «рентгена» повторяют вечернее свечение оригиналов.
    for(const [source,copy] of ghosts)if(source.emissive&&copy.emissive){copy.emissive.copy(source.emissive);copy.emissiveIntensity=source.emissiveIntensity;}
    renderer.shadowMap.needsUpdate=true;sun.shadow.needsUpdate=true;
    // Controls own the on-demand loop; a mode change needs just one extra frame.
    if(draw&&host.dataset.ready==='true')renderer.render(scene,camera);
  };
  const toggleMode=()=>{
    sceneMode=sceneMode==='evening'?'day':'evening';
    try { localStorage.setItem('campusSceneMode',sceneMode); } catch {}
    modeListeners.forEach((apply)=>apply());
  };
  modeListeners.add(applyMode);modeButton?.addEventListener('click',toggleMode);
  applyMode(false);
  return ()=>{
    modeListeners.delete(applyMode);modeButton?.removeEventListener('click',toggleMode);
    stop();environment.dispose();
    const geometries=new Set(),materials=new Set(),textures=new Set();
    scene.traverse((o)=>{if(o.geometry)geometries.add(o.geometry);for(const mat of [o.material||[]].flat()){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}o.dispose?.();});
    textures.forEach((v)=>v.dispose());materials.forEach((v)=>v.dispose());geometries.forEach((v)=>v.dispose());sun.shadow.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  };
}
