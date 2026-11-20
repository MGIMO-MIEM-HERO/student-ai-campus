const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/js/deck.js'),'utf8').replace(/export function /g,'function ');

function boot(){
  const events={},overlayEvents={},classes=new Set();
  let overlay,animations=0;
  const document={activeElement:null,documentElement:{classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}},
    addEventListener(name,fn){events[name]=fn;},removeEventListener(name){delete events[name];}};
  const control=()=>({focus(){document.activeElement=this;}});
  const opener=control(),close=control(),prev=control(),next=control(),select=control(),demo=control(),count={},live={};
  document.activeElement=opener;
  const stage={innerHTML:'',contains(el){return el===demo;},animate(){animations++;return {cancel(){}};}};
  const nodes={'[data-deck-stage]':stage,'[data-deck-select]':select,'[data-deck-count]':count,'[data-deck-live]':live,'[data-deck-next]':next};
  const page={inert:false},existingModal={inert:true};
  document.body={children:[page,existingModal],append(el){this.children.push(el);}};
  document.createElement=()=>overlay={setAttribute(){},addEventListener(name,fn){overlayEvents[name]=fn;},querySelector:s=>nodes[s],
    querySelectorAll(){return [close,...(stage.innerHTML.includes('data-deck-demo')?[demo]:[]),prev,select,next];},
    remove(){document.body.children=document.body.children.filter(el=>el!==this);}};
  const context={document,matchMedia:()=>({matches:true}),location:{hash:''}};
  vm.runInNewContext(source+'\nglobalThis.api={openDeck,closeDeck};',context);
  const key=(key,target={closest:()=>null},extra={})=>{const e={key,target,preventDefault(){this.prevented=true;},stopImmediatePropagation(){},...extra};events.keydown(e);return e;};
  const swipe=(dx,dy)=>{overlayEvents.touchstart({target:{closest:()=>null},touches:[{clientX:100,clientY:100}]});overlayEvents.touchend({changedTouches:[{clientX:100+dx,clientY:100+dy}]});};
  return {...context,opener,page,existingModal,stage,close,next,prev,select,demo,count,live,classes,key,swipe,animations:()=>animations,
    change(value){select.value=String(value);overlayEvents.change({target:{matches:()=>true,value:select.value}});},
    click(attr){overlayEvents.click({target:{closest:()=>({hasAttribute:name=>name===attr})}});}};
}

test('presentation opens, changes slides, wraps and respects reduced motion',()=>{
  const p=boot();p.api.openDeck();
  assert.equal(p.count.textContent,'1 / 10');assert.equal(p.document.activeElement,p.next);
  p.key('ArrowLeft');assert.equal(p.count.textContent,'10 / 10');
  assert.match(p.stage.innerHTML,/К демо-аккаунтам/);
  p.key('ArrowRight');assert.equal(p.count.textContent,'1 / 10');
  p.key('End');assert.equal(p.select.value,'9');
  p.key('Home');assert.equal(p.select.value,'0');assert.equal(p.animations(),0);
});

test('native slide selection keeps arrow keys and changes to the requested slide',()=>{
  const p=boot();p.api.openDeck();
  const event=p.key('ArrowRight',{closest:s=>s==='select'?p.select:null});
  assert.equal(event.prevented,undefined);assert.equal(p.select.value,'0');
  p.change(3);assert.equal(p.select.value,'3');assert.match(p.live.textContent,/Библиотека|Учебник/);
  p.change(100);assert.equal(p.count.textContent,'4 / 10');
});

test('vertical and diagonal scrolling do not flip a slide, horizontal swipes do',()=>{
  const p=boot();p.api.openDeck();p.swipe(-70,180);assert.equal(p.select.value,'0');
  p.swipe(-90,5);assert.equal(p.select.value,'1');p.swipe(90,5);assert.equal(p.select.value,'0');
});

test('focus stays in the dialog and closing restores the original inert states',()=>{
  const p=boot();p.api.openDeck();assert.equal(p.page.inert,true);
  p.key('Tab');assert.equal(p.document.activeElement,p.close);
  p.key('Tab',undefined,{shiftKey:true});assert.equal(p.document.activeElement,p.next);
  p.api.openDeck();assert.equal(p.document.body.children.length,3);
  p.key('Escape');assert.equal(p.page.inert,false);assert.equal(p.existingModal.inert,true);
  assert.equal(p.document.activeElement,p.opener);assert.equal(p.classes.has('deck-open'),false);
});

test('leaving the final slide restores focus and the demo action closes the dialog',()=>{
  const p=boot();p.api.openDeck(9);p.demo.focus();p.key('ArrowRight');
  assert.equal(p.document.activeElement,p.next);
  p.key('End');p.click('data-deck-demo');assert.equal(p.location.hash,'about');
  assert.equal(p.document.body.children.length,2);assert.equal(p.document.activeElement,p.opener);
});
