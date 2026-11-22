import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/js/vendor/three.module.min.js';
import {mountControls} from '../public/js/scene-controls.js';
import {S} from '../public/js/state.js';

// Exercise the real camera controller with a deterministic display clock and a stub
// renderer. This measures scheduling behavior, not GPU performance or browser FPS.
let identity=0;
function mount({route=true,mobile=false,reducedMotion=false}={}){
  let now=0,sequence=0,routeElapsed=0,peakQueue=0;
  const queue=new Map(),draws=[],saved=new Map();
  class Element{
    listeners=new Map();dataset={};attributes={};textContent='';
    addEventListener(name,fn,options={}){
      const list=this.listeners.get(name)||new Set();list.add(fn);this.listeners.set(name,list);
      options.signal?.addEventListener('abort',()=>list.delete(fn),{once:true});
    }
    emit(name,event={}){for(const fn of this.listeners.get(name)||[])fn(event);}
    setAttribute(key,value){this.attributes[key]=value;}
    closest(){return null;}
  }
  const document=new Element();document.hidden=false;
  const tour=new Element();tour.dataset.modelAction='tour';
  tour.closest=selector=>selector==='[data-model-action]'?tour:null;
  const host=new Element(),canvas=new Element(),status={},note={},title={};
  Object.assign(host,{clientWidth:mobile?390:1000,clientHeight:500});
  host.dataset.building=`test-${++identity}`;
  host.prepend=()=>{};
  host.querySelectorAll=selector=>selector==='[data-model-action="tour"]'?[tour]:[];
  host.querySelector=selector=>({'[data-scene-status]':status,'.model-stamp small':note,'.model-stamp>span':title}[selector]||null);
  const globals={document,performance:{now:()=>now},devicePixelRatio:2,
    requestAnimationFrame:fn=>{const id=++sequence;queue.set(id,fn);peakQueue=Math.max(peakQueue,queue.size);return id;},
    cancelAnimationFrame:id=>queue.delete(id),
    ResizeObserver:class{observe(){}disconnect(){}},
    IntersectionObserver:class{observe(){}disconnect(){}}};
  for(const [key,value] of Object.entries(globals)){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  let ratio=1,width=0,height=0;
  const renderer={domElement:canvas,shadowMap:{},info:{render:{calls:20,triangles:1000},memory:{textures:2,geometries:3}},
    getPixelRatio:()=>ratio,setPixelRatio:value=>{ratio=value;},getSize:target=>target.set(width,height),
    setSize:(w,h)=>{width=w;height=h;},render(){draws.push(now);}};
  const model=new T.Group(),floorGroup=new T.Group(),buildingGroup=new T.Group();model.add(floorGroup,buildingGroup);
  const sphere=new T.Sphere(new T.Vector3(),10);sphere.flat=8;sphere.height=5;
  const reduced=new Element();reduced.matches=reducedMotion;
  S.modelMode='building';S.rz=-20;
  const dispose=mountControls({host,renderer,scene:new T.Scene(),camera:new T.OrthographicCamera(),model,territory:false,
    floorGroup,buildingGroup,picks:[],bounds:{building:sphere,floor:sphere},fitShadow(){},ground:new T.Object3D(),mobile,reduced,
    animate:dt=>{if(route)routeElapsed=Math.min(6,routeElapsed+dt);},hasAnimation:()=>route&&routeElapsed<6});
  const step=ms=>{now+=ms;const pending=[...queue.values()];queue.clear();pending.forEach(fn=>fn(now));};
  const run=(seconds,hz=60)=>{for(let i=0;i<Math.round(seconds*hz);i++)step(1000/hz);};
  return {host,tour,draws,document,run,step,routeElapsed:()=>routeElapsed,pending:()=>queue.size,peakQueue:()=>peakQueue,
    toggleTour:()=>host.emit('click',{target:tour}),hide(value){document.hidden=value;document.emit('visibilitychange');},
    close(){dispose();for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}

test('a route does not halve desktop flyover camera updates',()=>{
  const p=mount();try{
    p.step(1000/60);p.toggleTour();const before=p.draws.length;p.run(2);
    const frames=p.draws.length-before;
    assert.ok(frames>=115,`Only ${frames} camera updates over two seconds on a 60 Hz clock`);
    assert.equal(p.peakQueue(),1,'Only one frame callback may be pending');
  }finally{p.close();}
});

test('the route completes in six seconds even on a slow display',()=>{
  const p=mount();try{
    p.step(100);p.run(6.2,10);
    assert.equal(p.routeElapsed(),6,'Route progress must use elapsed time, not the camera smoothing clamp');
    assert.equal(p.pending(),0,'An idle scene stops requesting frames after the route completes');
  }finally{p.close();}
});

test('route-only rendering averages 30 updates per second on a 75 Hz display',()=>{
  const p=mount();try{
    p.step(1000/75);const before=p.draws.length;p.run(2,75);
    const frames=p.draws.length-before;
    assert.ok(frames>=59&&frames<=61,`${frames} route updates instead of approximately 60`);
  }finally{p.close();}
});

test('the flyover and route finish without leaving a permanent animation loop',()=>{
  const p=mount();try{
    p.step(1000/60);p.toggleTour();p.run(14);
    assert.equal(p.routeElapsed(),6);assert.equal(p.tour.attributes['aria-pressed'],'false');
    assert.equal(p.pending(),0);assert.equal(p.host.dataset.animating,'false');
    const count=p.draws.length;p.run(1);assert.equal(p.draws.length,count);
  }finally{p.close();}
});

test('route throttling keeps its average cadence on high refresh displays',()=>{
  for(const hz of [60,120,144]){
    const p=mount();try{
      p.step(1000/hz);const before=p.draws.length;p.run(2,hz);
      const frames=p.draws.length-before;
      assert.ok(frames>=59&&frames<=61,`${frames} route updates at ${hz} Hz`);
    }finally{p.close();}
  }
});

test('mobile flyover stays bounded and rapid tour clicks do not multiply loops',()=>{
  const p=mount({mobile:true});try{
    p.step(1000/60);p.toggleTour();p.toggleTour();p.toggleTour();const before=p.draws.length;p.run(2);
    const frames=p.draws.length-before;assert.ok(frames>=59&&frames<=61,`${frames} mobile updates`);
    assert.equal(p.peakQueue(),1);assert.equal(p.tour.attributes['aria-pressed'],'true');
  }finally{p.close();}
});

test('desktop flyover stays at a 60 Hz budget on high refresh displays',()=>{
  for(const hz of [75,120,144]){
    const p=mount();try{
      p.step(1000/hz);p.toggleTour();const before=p.draws.length;p.run(2,hz);
      const frames=p.draws.length-before;
      assert.ok(frames>=119&&frames<=121,`${frames} camera updates at ${hz} Hz`);
    }finally{p.close();}
  }
});

test('pause and resume keep the button accessible and stop the idle camera loop',()=>{
  const p=mount();try{
    p.step(1000/60);p.toggleTour();p.run(7);
    assert.equal(p.tour.attributes['aria-label'],'Приостановить облёт');
    assert.match(p.tour.innerHTML,/<svg/);assert.match(p.tour.innerHTML,/<span>Пауза<\/span>/);
    p.toggleTour();p.run(1);assert.equal(p.pending(),0);
    assert.equal(p.tour.attributes['aria-label'],'Запустить облёт');assert.match(p.tour.innerHTML,/<span>Облёт<\/span>/);
    p.toggleTour();p.run(1);assert.equal(p.tour.attributes['aria-pressed'],'true');assert.equal(p.pending(),1);
  }finally{p.close();}
});

test('hiding the tab pauses the route and cancels the flyover without a resume jump',()=>{
  const p=mount();try{
    p.step(1000/60);p.toggleTour();p.run(1);p.hide(true);
    const elapsed=p.routeElapsed();assert.equal(p.pending(),0);assert.equal(p.tour.attributes['aria-pressed'],'false');
    p.run(20);assert.equal(p.routeElapsed(),elapsed);p.hide(false);p.step(1000/60);
    assert.ok(p.routeElapsed()-elapsed<.05);
  }finally{p.close();}
});

test('reduced motion disables flyover and leaves no continuous frame loop',()=>{
  const p=mount({reducedMotion:true});try{
    p.step(1000/60);assert.equal(p.tour.disabled,true);assert.equal(p.pending(),0);
    p.toggleTour();p.step(1000/60);assert.equal(p.pending(),0);assert.equal(p.tour.attributes['aria-pressed'],'false');
  }finally{p.close();}
});
