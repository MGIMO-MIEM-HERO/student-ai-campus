const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../public/js/theme.js'),'utf8');

function boot(saved,{blocked=false,header=true}={}){
  const root={dataset:{}},meta={},events={},windowEvents={},writes=[];
  let button=null,observe;
  const target={append(value){button=value;}};
  const app={querySelector(selector){return selector==='[data-theme-toggle]'?button:header?target:null;},append:target.append};
  const document={documentElement:root,readyState:'complete',
    querySelector(selector){return selector==='#app'?app:meta;},
    querySelectorAll(){return button?[button]:[];},
    createElement(){return {dataset:{},attributes:{},setAttribute(name,value){this.attributes[name]=value;}};},
    addEventListener(name,fn){events[name]=fn;}};
  const storage={getItem(){if(blocked)throw Error('Storage denied');return saved;},setItem(key,value){if(blocked)throw Error('Storage denied');writes.push([key,value]);}};
  vm.runInNewContext(code,{document,localStorage:storage,window:{addEventListener(name,fn){windowEvents[name]=fn;}},MutationObserver:class{constructor(fn){observe=fn;}observe(){}}});
  return {root,meta,writes,button:()=>button,click(){events.click({target:{closest:()=>button},preventDefault(){}});},storage(value){windowEvents.storage({key:'campusTheme',newValue:value});},rerender(){button=null;observe();}};
}
test('restores a saved dark theme and accessible toggle state',()=>{
  const page=boot('dark');
  assert.equal(page.root.dataset.theme,'dark');
  assert.equal(page.meta.content,'#111923');
  assert.equal(page.button().attributes['aria-pressed'],'true');
  assert.match(page.button().attributes['aria-label'],/светлую/);
});
test('toggles both ways and stores the choice without rebuilding the button',()=>{
  const page=boot('light'),button=page.button();page.click();
  assert.equal(page.root.dataset.theme,'dark');
  assert.deepEqual(page.writes,[['campusTheme','dark']]);
  page.click();assert.equal(page.root.dataset.theme,'light');
  assert.equal(page.button(),button);
});
test('remains usable when storage is blocked and puts the login control top right',()=>{
  const page=boot(null,{blocked:true,header:false});
  assert.equal(page.root.dataset.theme,'light');
  assert.match(page.button().className,/theme-floating/);
  page.click();assert.equal(page.root.dataset.theme,'dark');
});
test('preserves the theme across route renders and synchronizes another tab',()=>{
  const page=boot('dark');page.rerender();
  assert.equal(page.button().attributes['aria-pressed'],'true');
  page.storage('light');assert.equal(page.button().attributes['aria-pressed'],'false');
  assert.equal(page.writes.length,0);
});
