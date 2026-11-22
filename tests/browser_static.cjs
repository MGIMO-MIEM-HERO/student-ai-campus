/* E2E статической сборки для GitHub Pages (подкаталог, без Python-сервера).
   python3 tools/build_pages.py /tmp/pages/student-ai-campus && (cd /tmp/pages && python3 -m http.server 8098)
   CAMPUS_STATIC_URL=http://127.0.0.1:8098/student-ai-campus/ node tests/browser_static.cjs */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.CAMPUS_STATIC_URL||'http://127.0.0.1:8098/student-ai-campus/';
(async()=>{try{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const p=await ctx.newPage();const errs=[],bad=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())});
await p.goto(base);await p.waitForSelector('[data-demo="alina"]');
console.log('disclaimer static:',await p.locator('.disclaimer').innerText().then(t=>t.includes('статическая')));
// wrong password
await p.fill('input[name=login], #login', 'alina').catch(()=>{});
await p.locator('[data-demo="alina"]').click();await p.waitForSelector('.topbar');await p.waitForTimeout(1500);
console.log('logged in:',await p.locator('.topbar').count());
// assistant
const r=await p.evaluate(async()=>{const {api}=await import('./js/api.js');
  const a=await api('assistant',{question:'Какие пары завтра?'});
  const before=(await api('dashboard')).requests.length;
  const d=await api('requests',{kind:'Справка об обучении',note:'Для военкомата'});
  const n=await api('notice',{id:'all'});
  let err='';try{await api('consult',{})}catch(e){err=e.message}
  return {a:a.answer.slice(0,60),before,after:d.requests.length,unread:n.notices.filter(x=>!x.read).length,err:err.slice(0,40),id:d.requests[0].id};});
console.log(r);
await p.evaluate(async()=>{const {api}=await import('./js/api.js');await api('logout',{});});
// staff changes status
const s=await p.evaluate(async(id)=>{const {api}=await import('./js/api.js');
  await api('login',{login:'dekanat',password:'Campus-demo-2026'});
  const d=await api(`staff/requests/${id}`,{status:'Готова',comment:'Готово'});
  const req=d.requests.find(x=>x.id===id);
  await api('logout',{});
  let wrong='';try{await api('login',{login:'alina',password:'nope'})}catch(e){wrong=e.message}
  await api('login',{login:'alina',password:'Campus-demo-2026'});
  const a=await api('dashboard');const mine=a.requests.find(x=>x.id===id);
  const v=await api('verify/'+mine.document.code);
  const card=await api('verify/'+a.profile.card_code);
  return {staffStatus:req.status,studentStatus:mine.status,doc:!!mine.document,verify:v.valid&&v.type,card:card.valid&&card.type,wrong};},r.id);
console.log(s);
await p.reload();await p.waitForSelector('.topbar');
for(const h of ['#schedule','#tasks','#study','#requests','#rooms','#library','#notices','#profile','#assistant']){await p.goto(base+h);await p.waitForTimeout(700);}
assert.equal(r.after,r.before+1);assert.equal(r.unread,0);assert.ok(r.a.startsWith('Завтра'));
assert.equal(s.studentStatus,'Готова');assert.equal(s.verify,'document');assert.equal(s.card,'card');
assert.deepEqual(errs,[]);assert.deepEqual(bad,[]);
console.log('PASS: static Pages build — login by hash, request → dean status → document QR, notices, assistant, all routes, no errors.');
await b.close();}catch(e){console.error(e);process.exitCode=1;}})();
