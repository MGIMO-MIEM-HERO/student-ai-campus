/* Optional browser regression check. Needs Playwright and Chromium.
   Run against a local server: node tests/browser_3d.cjs
   CHROMIUM_PATH and CAMPUS_TEST_URL may override their defaults. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {chromium} = require('playwright');
const base = process.env.CAMPUS_TEST_URL || 'http://127.0.0.1:8080';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

async function ready(page, count) {
  if(count===2) {
    await page.locator('.floor-model').scrollIntoViewIfNeeded();
    await page.waitForSelector('.floor-model[data-ready="true"]');
  } else {
    // На телефоне форма входа стоит выше модели, а сцена монтируется лениво — сначала прокручиваем к ней.
    await page.locator('[data-scene]').first().scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-ready="true"]');
  }
}
async function main() {
  const browser = await chromium.launch({executablePath, headless:true, args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror', (e)=>errors.push(e.message));
    await page.goto(base); await ready(page,1);
    await page.locator('[data-wing="Г"]').click();
    assert.equal(await page.locator('[data-wing="Г"]').getAttribute('aria-pressed'),'true');
    await fs.mkdir('/tmp/campus-3d-check',{recursive:true});
    await page.screenshot({path:'/tmp/campus-3d-check/login.png'});
    await page.locator('[data-demo="alina"]').click();
    await page.waitForSelector('.topbar');
    await page.goto(base+'/#rooms'); await ready(page,2);
    assert.equal(await page.locator('.floor-model').getAttribute('data-model-mode'),'building');
    assert.ok(Number(await page.locator('.floor-model').getAttribute('data-triangles'))<60000,'Overview should use lightweight windows');
    await page.locator('.floor-model').screenshot({path:'/tmp/campus-3d-check/building.png'});
    for(let floor=1;floor<=6;floor++) {
      await page.locator(`.floor-chips [data-floor="${floor}"]`).click(); await ready(page,2);
      assert.equal(await page.locator('.plan [data-room3]').count(),24);
    }
    await page.locator('.floor-chips [data-floor="3"]').click(); await ready(page,2);
    await page.locator('.floor-model [data-model-action="zoom-in"]').click();
    await page.locator('.floor-model [data-model-action="zoom-in"]').click();
    await page.waitForFunction(()=>+document.querySelector('.floor-model')?.dataset.viewZoom>1.4);
    const closeUp=await page.locator('.floor-model').getAttribute('data-view-zoom');
    const room=page.locator('.plan [data-room3="А-318"]');
    await room.focus(); await page.keyboard.press('Enter'); await ready(page,2);
    assert.equal(await page.locator('[data-scene="floor"]').getAttribute('data-selected-room'),'А-318');
    assert.match(await page.locator('#room-card').innerText(),/318/);
    assert.equal(await page.locator('.floor-model').getAttribute('data-view-zoom'),closeUp,'Selecting a room must preserve a chosen close-up');
    await page.locator('.floor-model [data-model-action="reset"]').click();
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.viewZoom==='1.000');
    await page.locator('[data-scene="floor"] [data-model-action="top"]').click();
    await page.waitForTimeout(150);
    assert.ok(Number(await page.locator('[data-scene="floor"]').getAttribute('data-triangles'))>1000,'Top view must draw the model');
    const canvas=page.locator('[data-scene="floor"] canvas');
    await canvas.screenshot({path:'/tmp/campus-3d-check/top.png'});
    const bounds=await canvas.boundingBox();
    let picked=false;
    // Кадр подстраивается под модель при любом повороте, поэтому пробуем сетку точек, а не фиксированные координаты.
    for(const [x,y] of [[.25,.26],[.3,.3],[.4,.26],[.65,.26],[.76,.7],...[.3,.4,.5,.6,.7,.8].flatMap((gx)=>[.3,.4,.6,.7].map((gy)=>[gx,gy]))]) {
      await page.mouse.click(bounds.x+bounds.width*x,bounds.y+bounds.height*y);
      await page.waitForTimeout(200);
      const selection=await page.locator('[data-scene="floor"]').getAttribute('data-selected-room');
      if(selection && selection!=='А-318'){picked=true;await ready(page,2);break;}
    }
    assert.ok(picked,'Clicking a room in the 3D scene must select it');
    for(let i=0;i<3;i++){
      await page.goto(base+'/#today');await page.waitForSelector('.today-head');
      assert.equal(await page.locator('canvas').count(),0);
      await page.goto(base+'/#rooms');await ready(page,2);
      assert.ok(await page.locator('canvas').count()<=2,'No accumulated canvases after route changes');
    }
    await page.locator('.floor-model').screenshot({path:'/tmp/campus-3d-check/floor.png'});
    await page.screenshot({path:'/tmp/campus-3d-check/campus.png',fullPage:true});
    for(const width of [1024,768,390,320]) {
      await page.setViewportSize({width,height:900});await page.waitForTimeout(200);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      assert.ok(overflow<=1,`Horizontal page overflow at ${width}: ${overflow}`);
      if(width===390)await page.screenshot({path:'/tmp/campus-3d-check/mobile.png',fullPage:true});
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: wing selection; six floors; keyboard and 3D room selection; scene cleanup; 1024/768/390/320 layouts; no page errors.');
  } finally {await browser.close();}

  const mobileBrowser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const page=await mobileBrowser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
    await page.goto(base);await ready(page,1);
    await page.locator('[data-demo="alina"]').click();await page.waitForSelector('.topbar');
    await page.goto(base+'/#rooms');
    // Территория теперь в раскрывающемся блоке в конце страницы «Корпуса»: раскрываем его, интерьер этажа остаётся вне экрана.
    await page.locator('details.disclosure:has([data-scene="territory"]) > summary').click();
    await page.locator('[data-scene="territory"]').scrollIntoViewIfNeeded();await page.waitForSelector('[data-scene="territory"][data-ready="true"]');
    assert.equal(await page.locator('.floor-model canvas').count(),0,'Offscreen interior must not allocate a renderer before it is needed');
    await page.locator('.floor-model').scrollIntoViewIfNeeded();await ready(page,2);
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.animating==='false');
    const metrics=await page.locator('.floor-model').evaluate((el)=>({calls:+el.dataset.drawCalls,triangles:+el.dataset.triangles,textures:+el.dataset.textures,pixels:el.querySelector('canvas').width*el.querySelector('canvas').height,quality:el.dataset.quality}));
    assert.equal(metrics.quality,'mobile');assert.ok(metrics.pixels<=652000);assert.ok(metrics.calls<70);assert.ok(metrics.triangles<60000);assert.ok(metrics.textures<=16);
    const idle=await page.locator('.floor-model').getAttribute('data-frames');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.floor-model').getAttribute('data-frames'),idle,'No permanent render loop at rest');
    await page.locator('.floor-model [data-model-action="left"]').click();
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.animating==='true');
    const movingRatio=Number(await page.locator('.floor-model').getAttribute('data-pixel-ratio'));
    assert.ok(movingRatio<=1.16,'Motion uses a smaller drawing buffer on mobile');
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.animating==='false');
    assert.ok(Number(await page.locator('.floor-model').getAttribute('data-pixel-ratio'))>=movingRatio,'Restore sharpness after motion stops');
    const bounds=await page.locator('.floor-model canvas').boundingBox();
    await page.mouse.move(bounds.x+bounds.width*.4,bounds.y+bounds.height*.5);await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.54,{steps:6});await page.mouse.up();
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.animating==='true');
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.animating==='false');
    assert.equal(await page.locator('.floor-model').getAttribute('data-selected-room'),'','A rotation drag must not select a room');
    const tour=page.locator('.floor-model [data-model-action="tour"]');await tour.click();
    await page.waitForFunction(()=>document.querySelector('.floor-model [data-model-action="tour"]')?.getAttribute('aria-pressed')==='true');
    await page.waitForFunction(()=>document.querySelector('.floor-model [data-model-action="tour"]')?.getAttribute('aria-pressed')==='false',null,{timeout:15000});
    await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.animating==='false');
    await tour.click();
    await page.locator('.territory').scrollIntoViewIfNeeded();
    // IntersectionObserver срабатывает асинхронно: ждём состояние, а не фиксированную паузу.
    await page.waitForFunction(()=>document.querySelector('.floor-model [data-model-action="tour"]')?.getAttribute('aria-pressed')==='false',null,{timeout:3000}).catch(()=>{});
    assert.equal(await tour.getAttribute('aria-pressed'),'false','Offscreen tours stop automatically');
    const frozen=await page.locator('.floor-model').getAttribute('data-frames');await page.waitForTimeout(250);
    assert.equal(await page.locator('.floor-model').getAttribute('data-frames'),frozen,'Offscreen renderer does no work');
    await page.locator('.floor-model').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.floor-model')?.dataset.animating==='false');
    await page.locator('.floor-model').screenshot({path:'/tmp/campus-3d-check/mobile-building.png'});
    console.log('PASS: DPR-3 mobile rendering budgets, lazy allocation, idle/offscreen suspension, adaptive motion resolution, tour controls.',metrics);
  } finally {await mobileBrowser.close();}

  const fallbackBrowser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-webgl']});
  try {
    const page=await fallbackBrowser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await page.goto(base);
    await page.locator('[data-scene]').first().scrollIntoViewIfNeeded();
    await page.waitForSelector('.scene-unavailable');
    assert.ok(await page.locator('.territory-fallback').isVisible());
    await page.locator('[data-demo="alina"]').click();await page.waitForSelector('.topbar');
    await page.goto(base+'/#rooms');await page.waitForSelector('.plan');
    const room=page.locator('.plan [data-room3]').first();const key=await room.getAttribute('data-room3');
    await room.focus();await page.keyboard.press('Enter');
    await page.waitForFunction((key)=>document.querySelector('[data-scene="floor"]')?.dataset.selectedRoom===key,key);
    console.log('PASS: WebGL unavailable — static territory and keyboard-operable room plan remain usable.');
  } finally {await fallbackBrowser.close();}
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
