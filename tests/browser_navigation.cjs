const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.CAMPUS_TEST_URL||'http://127.0.0.1:8080';
async function map(page) {
  await page.locator('.floor-model').scrollIntoViewIfNeeded();
  await page.waitForSelector('.floor-model[data-ready="true"]');
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',(e)=>errors.push(e.message));
    await page.clock.install();await page.goto(base);
    await page.locator('[data-demo="alina"]').click();await page.waitForSelector('.topbar');
    const original=await (await page.request.get(base+'/api/dashboard')).json();
    let fixture=structuredClone(original);
    await page.route('**/api/dashboard',(route)=>route.fulfill({json:fixture}));
    await page.goto(base+'/#rooms');
    await page.locator('[data-route-next]').click();await map(page);
    assert.ok(await page.locator('.navigation-context').count());
    assert.ok(await page.locator('.floor-model').getAttribute('data-route-points'));
    const entry=original.schedule.flatMap((d)=>d.lessons.map((l)=>({l,date:d.date}))).find(({l})=>l.building==='А'&&l.room==='304'&&!l.cancelled&&l.format!=='Онлайн');
    assert.ok(entry,'Fixture needs a physical class in A-304');
    await page.locator('#map-date').selectOption(entry.date);
    await page.locator(`[data-nav-lesson="${entry.l.id}"]`).click();await map(page);
    assert.equal(await page.locator('#map-date').inputValue(),entry.date);
    assert.equal(await page.locator('.floor-model').getAttribute('data-pair-number'),String(entry.l.pair));
    assert.equal(await page.locator('.floor-model').getAttribute('data-selected-room'),'А-304');
    assert.match(await page.locator('.navigation-map-caption').innerText(),new RegExp(entry.l.title));
    assert.match(await page.locator('.navigation-map-caption').innerText(),new RegExp(entry.l.teacher.short.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    for(const floor of [1,3]) {
      await page.locator(`[data-route-floor="${floor}"]`).click();await map(page);
      assert.equal(await page.locator('.floor-model').getAttribute('data-route-level'),String(floor));
      const points=JSON.parse(await page.locator('.floor-model').getAttribute('data-route-points'));
      assert.equal(await page.locator('.plan .route-line').getAttribute('points'),points.map((p)=>p.join(',')).join(' '));
    }
    await page.locator('#route-origin').selectOption('А-201');await map(page);
    assert.ok(await page.locator('[data-route-floor="2"]').count());
    await page.locator('#route-origin').selectOption('lift');await map(page);
    assert.equal(await page.locator('button[data-route-floor]').count(),1);
    await page.locator('.floor-model').screenshot({path:'/tmp/campus-navigation-3d.png'});
    const changed=fixture.schedule.flatMap((d)=>d.lessons).find((l)=>l.id===entry.l.id);
    Object.assign(changed,{room:'318',floor:3,place:'Корпус А, ауд. 318',pair:3,start:'12:40',end:'14:10',change:{label:'Новая аудитория',was:'А-304',now:'А-318'}});
    console.log('Navigation: route geometry and origins OK; checking live refresh');
    await page.evaluate(()=>document.activeElement.blur());await page.clock.fastForward(61000);
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.selectedRoom==='А-318',null,{timeout:10000});await map(page);
    assert.equal(await page.locator('.floor-model').getAttribute('data-pair-number'),'3');
    assert.match(await page.locator('.navigation-notice').innerText(),/перестроен/);
    assert.ok(await page.locator('.plan .route-line').count());
    changed.cancelled=true;await page.clock.fastForward(61000);
    await page.waitForFunction(()=>document.querySelector('.navigation-notice')?.textContent.includes('отменена'));
    assert.equal(await page.locator('.plan .route-line').count(),0);
    changed.cancelled=false;changed.format='Онлайн';await page.clock.fastForward(61000);
    await page.waitForFunction(()=>document.querySelector('.navigation-notice')?.textContent.includes('онлайн'));
    assert.equal(await page.locator('.plan .route-line').count(),0);
    fixture=structuredClone(original);await page.clock.fastForward(61000);
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.selectedRoom==='А-304');await map(page);
    assert.equal(await page.locator('.floor-model').getAttribute('data-selected-room'),'А-304');
    await page.setViewportSize({width:390,height:844});await page.clock.runFor(200);await map(page);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));
    await page.locator('.floor-model').screenshot({path:'/tmp/campus-navigation-mobile.png'});
    const otherDay=original.schedule.find((d)=>d.date!==original.campus.rooms_date).date;
    await page.locator('#map-date').selectOption(otherDay);await map(page);
    assert.ok(await page.locator('.plan .rm.unknown').count(),'Do not present unknown future occupancy as free');
    assert.deepEqual(errors,[]);
    console.log('PASS: schedule -> room/date/pair/teacher; entry/lift/other-room routes; 2D/3D agreement; live relocation/time change, cancellation, online mode, recovery; mobile layout; unknown future occupancy.');
  } finally {await browser.close();}
})().catch((e)=>{console.error(e);process.exitCode=1;});
