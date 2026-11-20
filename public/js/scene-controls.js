import * as T from './vendor/three.module.js';
import {S} from './state.js';

// Keep a chosen close-up when room selection or dashboard refresh replaces DOM.
const views=new Map();

export function mountControls({host,renderer,scene,camera,model,territory,floorGroup,buildingGroup,picks,bounds,fitShadow,ground,mobile,reduced,animate,hasAnimation}) {
  const canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',territory?'Объёмная схема территории. Стрелки — вращение, плюс и минус — масштаб.':'Модель корпуса и этажа. Стрелки — вращение, плюс и минус — масштаб. Аудитории доступны на схеме рядом.');
  host.prepend(canvas);
  let mode=territory?'territory':S.modelMode||'building';
  const orbitCenter=new T.Vector3();
  const routeZoom=1.18;
  const viewKey=()=>territory?'territory':`${host.dataset.building}-${mode}`;
  const initial={a:territory?-.14:-20*Math.PI/180,e:.76,z:1,x:0,depth:0};
  const target={...initial,a:territory?-.14:S.rz*Math.PI/180,...views.get(viewKey())};
  const current={...target};
  const renderSize=new T.Vector2(),details=[];
  model.traverse(o=>{if(o.userData.detail||o.userData.labels)details.push(o);});
  let frame=0,disposed=false,visible=true,dirtyShadow=true,gesture=null,velocity=0;
  let lastTime=0,lastDraw=0,tourUntil=0,tourStart=0,tourAngle=0,frameCount=0,slowFrames=0;
  const abort=new AbortController(),opts={signal:abort.signal};
  const setTour=(playing)=>{
    tourStart=performance.now();tourAngle=target.a;tourUntil=playing?tourStart+12000:0;
    host.querySelectorAll('[data-model-action="tour"]').forEach((b)=>{b.setAttribute('aria-pressed',String(playing));b.textContent=playing?'Пауза':'Облёт';});
  };
  const saveRotation=()=>{if(!territory)S.rz=target.a*180/Math.PI;};
  const request=()=>{if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(tick);};
  function setMode(next) {
    if(territory)return;
    if(next!==mode){views.set(viewKey(),{...target});mode=next;Object.assign(target,views.get(viewKey())||initial);}
    mode=next;S.modelMode=next;host.dataset.modelMode=next;
    floorGroup.visible=mode==='floor';buildingGroup.visible=mode==='building';
    host.querySelectorAll('[data-model-mode]').forEach((b)=>b.setAttribute('aria-pressed',String(b.dataset.modelMode===next)));
    const note=host.querySelector('.model-stamp small');if(note)note.textContent=mode==='building'?(host.dataset.xray?'Путь внутри корпуса · фасад прозрачный':'Архитектурный концепт'):'Проектный интерьер';
    const title=host.querySelector('.model-stamp>span');if(title)title.textContent=mode==='building'?`Корпус ${host.dataset.building}`:`${host.dataset.floorNumber} этаж`;
    ground.position.y=mode==='building'?-.61:-.4;
    fitShadow(bounds[mode]);
    velocity=0;setTour(false);dirtyShadow=true;request();
  }
  if(territory)fitShadow(bounds.territory);else setMode(mode);
  function tick(time) {
    frame=0;if(disposed||!visible||document.hidden)return;
    const animatingRoute=!reduced.matches&&hasAnimation();
    // Route animation is capped at 30 fps on desktop as well as mobile.
    if((mobile||animatingRoute)&&lastDraw&&time-lastDraw<(animatingRoute?1000/30:30)){request();return;}
    const dt=Math.min((time-(lastTime||time-16))/1000,.05);lastTime=time;lastDraw=time;
    if(tourUntil) {
      if(reduced.matches)setTour(false);
      else {target.a=tourAngle+Math.PI*2*Math.min(1,(time-tourStart)/12000);if(time>=tourUntil)setTour(false);}
    }
    if(!gesture&&!reduced.matches&&Math.abs(velocity)>.006){target.a+=velocity*dt;velocity*=Math.exp(-7.5*dt);}else if(!gesture)velocity=0;
    const damping=reduced.matches?1:1-Math.exp(-(introUntil&&time<introUntil?1.35:18)*dt);
    for(const k of ['a','e','z','x','depth'])current[k]+=(target[k]-current[k])*damping;
    const unsettled=['a','e','z','x','depth'].some((k)=>Math.abs(current[k]-target[k])>.0008);
    const moving=!!gesture||!!tourUntil||Math.abs(velocity)>.006||unsettled;
    if(!moving)Object.assign(current,target);
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    const pixelBudget=mobile?650000:1800000;
    const crisp=Math.min(devicePixelRatio||1,2,Math.sqrt(pixelBudget/(width*height)));
    const ratio=moving?Math.min(crisp,mobile?(slowFrames>5?.85:1.15):1.5):crisp;
    if(Math.abs(renderer.getPixelRatio()-ratio)>.01)renderer.setPixelRatio(ratio);
    const size=renderer.getSize(renderSize);if(size.x!==width||size.y!==height)renderer.setSize(width,height,false);
    const worldWidth=territory?55:mode==='building'?43:35;
    const {center,radius}=bounds[mode];
    const aspect=width/height;
    const flat=bounds[mode].flat??radius,tall=bounds[mode].height??radius*2;
    // Полувысота кадра: проекция основания при текущем наклоне камеры плюс высота корпуса; полуширина — полудиагональ.
    const vertical=flat*Math.sin(current.e)+tall/2*Math.cos(current.e);
    const fit=Math.max(Math.min(vertical,radius),flat/aspect)*1.08;
    const halfHeight=Math.max(fit,worldWidth/(2*aspect))/current.z;
    const halfWidth=halfHeight*aspect;
    // Keep a margin on both axes at reset and zoom-out, and ease into the route close-up.
    const pan=Math.hypot(current.x,current.depth);
    const availablePan=Math.max(0,Math.min(halfWidth,halfHeight)-radius*1.03);
    const zoomBlend=T.MathUtils.clamp((current.z-1)/(routeZoom-1),0,1);
    const panScale=pan?T.MathUtils.lerp(Math.min(1,availablePan/pan),1,zoomBlend):1;
    orbitCenter.copy(center);
    orbitCenter.x+=current.x*panScale;
    orbitCenter.z+=current.depth*panScale;
    const reach=radius+pan*panScale;
    const distance=Math.max(60,reach*1.06+camera.near);
    camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;
    camera.far=distance+Math.max(radius*2,reach)*1.06;
    camera.updateProjectionMatrix();
    camera.position.set(
      Math.sin(current.a)*Math.cos(current.e),
      Math.sin(current.e),
      Math.cos(current.a)*Math.cos(current.e)
    ).multiplyScalar(distance).add(orbitCenter);
    camera.lookAt(orbitCenter);
    const close=!moving&&width*current.z/worldWidth>32;
    details.forEach((o)=>{
      if(o.userData.detail===1)o.visible=!moving&&(current.z>1.22||width>700);
      if(o.userData.detail===2)o.visible=close;
      if(o.userData.detail===3)o.visible=!close;
      if(o.userData.labels)o.visible=!moving||current.z>1.35;
    });
    // The world and sun stay still when the camera moves: shadows need one bake.
    renderer.shadowMap.needsUpdate=dirtyShadow;
    animate(dt);
    const started=performance.now();renderer.render(scene,camera);const cpu=performance.now()-started;
    if(moving&&cpu>22)slowFrames++;
    dirtyShadow=false;frameCount++;
    Object.assign(host.dataset,{ready:'true',animating:String(moving||animatingRoute),frames:String(frameCount),drawCalls:String(renderer.info.render.calls),triangles:String(renderer.info.render.triangles),textures:String(renderer.info.memory.textures),geometries:String(renderer.info.memory.geometries),pixelRatio:ratio.toFixed(2),viewZoom:current.z.toFixed(3),renderCpuMs:cpu.toFixed(2),quality:mobile?'mobile':'desktop'});
    host.querySelector('[data-scene-status]').textContent='';
    if(moving||animatingRoute)request();else {lastTime=0;saveRotation();views.set(viewKey(),{...target});}
  }
  const resize=new ResizeObserver(()=>{lastTime=0;request();});resize.observe(host);
  const intersection=new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;
    if(!visible){cancelAnimationFrame(frame);frame=0;gesture=null;velocity=0;setTour(false);host.dataset.animating='false';}
    else {lastTime=0;request();}
  },{rootMargin:'40px'});intersection.observe(host);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;gesture=null;velocity=0;setTour(false);host.dataset.animating='false';}
    else {lastTime=0;request();}
  },opts);
  const pick=new T.Raycaster(),pointer=new T.Vector2();
  function selectWing(id,preserveCaption=false) {
    for(const mesh of picks)if(mesh.userData.wing)mesh.material[0].color.set(mesh.userData.wing.id===id?0x5f93a6:0x80878a);
    const root=host.closest('.territory');root?.querySelectorAll('[data-wing]').forEach((b)=>b.setAttribute('aria-pressed',String(b.dataset.wing===id)));
    const desc=root?.querySelector('.model-description');if(desc&&(!preserveCaption||!desc.textContent.trim()))desc.textContent=`Корпус ${id} · расположение по предоставленной схеме`;
    request();
  }
  if(territory&&host.dataset.routeWing) {
    const wing=picks.find((mesh)=>mesh.userData.wing?.id===host.dataset.routeWing);
    if(wing) {
      const center=new T.Box3().setFromObject(wing).getCenter(new T.Vector3());
      Object.assign(target,{x:center.x-bounds.territory.center.x,depth:center.z-bounds.territory.center.z,z:routeZoom});
      if(reduced.matches)Object.assign(current,target);
      selectWing(host.dataset.routeWing,true);
    }
  }
  // Вступительный подлёт: камера стартует далеко и сверху, делает почти полтора оборота и медленно «садится» на корпус пары.
  let introUntil=0;
  if(territory&&host.dataset.intro==='1'&&!reduced.matches) {
    Object.assign(current,{a:target.a+Math.PI*1.45,e:1.05,z:.62,x:0,depth:0});
    target.z=Math.max(target.z,1.75);target.e=.64;
    introUntil=performance.now()+4800;
  }
  function action(name) {
    velocity=0;
    if(name!=='tour')setTour(false);
    if(name==='reset'){Object.assign(target,initial,{a:current.a+Math.atan2(Math.sin(initial.a-current.a),Math.cos(initial.a-current.a))});}
    if(name==='left')target.a-=Math.PI/8;
    if(name==='right')target.a+=Math.PI/8;
    if(name==='top')target.e=target.e>1.4?.76:1.55;
    if(name==='zoom-in')target.z=Math.min(target.z*1.23,2.6);
    if(name==='zoom-out')target.z=Math.max(target.z/1.23,.7);
    if(name==='tour'&&!reduced.matches)setTour(!tourUntil);
    if(reduced.matches)Object.assign(current,target);
    saveRotation();request();
  }
  host.querySelectorAll('[data-model-action="tour"]').forEach((b)=>{b.disabled=reduced.matches;});
  reduced.addEventListener('change',()=>{velocity=0;setTour(false);host.querySelectorAll('[data-model-action="tour"]').forEach((b)=>{b.disabled=reduced.matches;});request();},opts);
  if(!territory)document.addEventListener('campus-rotation',(e)=>{target.a+=Math.atan2(Math.sin(e.detail*Math.PI/180-target.a),Math.cos(e.detail*Math.PI/180-target.a));velocity=0;setTour(false);request();},opts);
  host.closest('.territory')?.addEventListener('click',(e)=>{const button=e.target.closest('[data-wing]');if(button)selectWing(button.dataset.wing);},opts);
  host.addEventListener('click',(e)=>{
    const button=e.target.closest('[data-model-action]');if(button)action(button.dataset.modelAction);
    const tab=e.target.closest('button[data-model-mode]');if(tab)setMode(tab.dataset.modelMode);
  },opts);
  canvas.addEventListener('keydown',(e)=>{const names={ArrowLeft:'left',ArrowRight:'right','+':'zoom-in','=':'zoom-in','-':'zoom-out',Home:'reset'};if(names[e.key]){e.preventDefault();action(names[e.key]);}},opts);
  canvas.addEventListener('pointerdown',(e)=>{
    if(e.button!==0)return;
    velocity=0;setTour(false);gesture={x:e.clientX,y:e.clientY,a:target.a,e:target.e,lastX:e.clientX,lastTime:performance.now(),moved:false,touch:e.pointerType==='touch',id:e.pointerId};canvas.setPointerCapture(e.pointerId);
  },opts);
  canvas.addEventListener('pointermove',(e)=>{
    if(!gesture||e.pointerId!==gesture.id)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    // Vertical swipes on a phone remain page scrolling; horizontal swipes rotate.
    if(gesture.touch&&!gesture.moved&&(Math.abs(dx)<6||Math.abs(dx)<Math.abs(dy)*1.2))return;
    if(Math.hypot(dx,dy)>5)gesture.moved=true;
    if(!gesture.moved)return;
    const now=performance.now();velocity=T.MathUtils.clamp((e.clientX-gesture.lastX)*.005/Math.max(.008,(now-gesture.lastTime)/1000),-2,2);
    gesture.lastX=e.clientX;gesture.lastTime=now;
    target.a=gesture.a+dx*.005;
    if(!gesture.touch)target.e=T.MathUtils.clamp(gesture.e+dy*.003,.24,1.55);
    saveRotation();request();
  },opts);
  canvas.addEventListener('pointerup',(e)=>{
    if(!gesture||e.pointerId!==gesture.id)return;
    const moved=gesture.moved,age=performance.now()-gesture.lastTime;gesture=null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(moved){if(age>80||reduced.matches)velocity=0;request();return;}
    velocity=0;
    if(!territory&&mode!=='floor')return;
    const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pick.setFromCamera(pointer,camera);
    const hit=pick.intersectObjects(picks,false)[0],object=hit?.object;
    if(object?.userData.wing)selectWing(object.userData.wing.id);
    const room=object?.userData.rooms?.[hit.instanceId];
    if(room)document.querySelector(`.plan [data-room3="${CSS.escape(room)}"]`)?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  },opts);
  const cancel=()=>{gesture=null;velocity=0;request();};
  canvas.addEventListener('pointercancel',cancel,opts);
  canvas.addEventListener('lostpointercapture',()=>{if(gesture)cancel();},opts);
  canvas.addEventListener('webglcontextlost',(e)=>{e.preventDefault();cancelAnimationFrame(frame);frame=0;setTour(false);delete host.dataset.ready;host.querySelector('[data-scene-status]').textContent='3D приостановлено. Схема помещений доступна рядом.';},opts);
  canvas.addEventListener('webglcontextrestored',()=>{dirtyShadow=true;request();},opts);
  request();
  return ()=>{views.set(viewKey(),{...target});disposed=true;cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();abort.abort();};
}
