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
  assert.equal(page.meta.content,'#11151b');
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
test('dark hero labels, secondary text and map labels keep readable contrast',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../public/css/theme.css'),'utf8');
  const tokens=Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(m=>[m[1],m[2]]));
  const luminance=hex=>{
    const rgb=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  };
  for(const [foreground,background] of [['--ink','--paper'],['--ink','--surface'],['--muted','--card'],['--hero-chip-fg','--hero-chip-bg'],['--hero-chip-muted','--hero-chip-bg'],['#ffffff','--route-active'],['#ffffff','--pine'],['#ffffff','--pine-2']]){
    const a=luminance(tokens[foreground]||foreground),b=luminance(tokens[background]||background);
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${foreground} on ${background}`);
  }
});
