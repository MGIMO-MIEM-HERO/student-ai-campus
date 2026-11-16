/* Responsive regression. Start python3 server.py, then: node tests/browser_mobile.cjs.
   Requires Playwright and Chromium; CAMPUS_TEST_URL / CHROMIUM_PATH override defaults.
   Checks layout and real interactions without changing demo records. */
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const base = process.env.CAMPUS_TEST_URL || 'http://127.0.0.1:8080';
const viewports = [[280,653],[320,568],[360,740],[375,667],[390,844],[430,932],
  [600,960],[768,1024],[820,1180],[960,700],[1024,768],[1200,800],[1440,900],[844,390]];
const roles = [
  [null, ['login','about']],
  ['alina', ['today','schedule','tasks','study','requests','rooms','news','notices','assistant','profile','library']],
  ['vetrova', ['today','schedule','journal','tasks','rooms','profile']],
  ['dekanat', ['queue','rooms','announce','profile']],
];
async function route(page, key) {
  const hash = key === 'login' ? '' : '#' + key;
  if (await page.evaluate(() => location.hash) !== hash) {
    const main = await page.$('#app > :first-child');
    await page.evaluate(hash => { location.hash = hash; }, hash);
    await page.waitForFunction(el => !el.isConnected, main);
    await main.dispose();
  }
  if (key.startsWith('verify/')) await page.locator('.verify h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function login(page, account) {
  await page.goto(base);
  await page.locator('[data-demo="alina"]').waitFor();
  if (account) {
    await page.locator(`[data-demo="${account}"]`).click();
    await page.locator('.topbar').waitFor();
  }
}
async function layout(page, label) {
  const issues = await page.evaluate(() => {
    const errors = [], width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > width + 1) errors.push('page overflows horizontally');
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    for (const el of document.querySelectorAll('.topbar-in>.brand,.topbar-in>.avatar,.topbar-in>.icon-btn,.nav a')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > width + 1) errors.push(`header/navigation clipped: ${el.getAttribute('aria-label') || el.className}`);
    }
    for (const card of document.querySelectorAll('.tcard')) {
      const r = card.getBoundingClientRect();
      for (const button of card.querySelectorAll('.btn')) {
        const b = button.getBoundingClientRect();
        if (b.left < r.left || b.right > r.right + 1) errors.push('teacher action escapes its card');
      }
    }
    for (const el of document.querySelectorAll('.btn,.chip,.icon-btn,.hw-check,.jr button.jm,.lib-tabs button,.lib-caption>button')) {
      if (visible(el) && el.getBoundingClientRect().height < 43.9) errors.push(`touch target too short: ${el.className}`);
    }
    for (const el of document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),select,textarea')) {
      if (visible(el) && parseFloat(getComputedStyle(el).fontSize) < 16) errors.push('input can trigger iOS focus zoom');
    }
    return [...new Set(errors)];
  });
  assert.deepEqual(issues, [], label);
}
async function dialog(page, label) {
  await page.locator('#sheet[open]').waitFor();
  const original = page.viewportSize();
  for (const [width,height] of [[280,653],[320,568],[390,844],[768,1024],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const bounds = await page.locator('#sheet').evaluate(el => {
      const r = el.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth,height:innerHeight};
    });
    assert.ok(bounds.top >= -1 && bounds.bottom <= bounds.height + 1, `${label} at ${width}: dialog fits viewport`);
    assert.ok(bounds.overflow <= 1, `${label} at ${width}: dialog content fits width`);
    await page.locator('#sheet').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const close = await page.locator('.sheet-close').boundingBox();
    assert.ok(close.y >= 0 && close.y + close.height <= height + 1, `${label} at ${width}: close stays reachable after scrolling`);
  }
  await page.locator('.sheet-close').click();
  await page.locator('#sheet[open]').waitFor({state:'hidden'});
  await page.setViewportSize(original);
}
async function main() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args:['--no-sandbox','--disable-webgl']});
  let cases = 0;
  const pageErrors = [];
  try {
    for (const [account, screens] of roles) {
      const context = await browser.newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await login(page, account);
      if (!account) {
        const button = await page.locator('#login-form button').boundingBox();
        assert.ok(button.y >= 0 && button.y + button.height <= 568, 'login is available on the first small-phone screen');
        await page.locator('#login').fill('alina');
        assert.equal(await page.locator('#login').inputValue(), 'alina');
      }
      const routes = [...screens];
      if (account === 'alina') {
        const data = await (await page.request.get(base + '/api/dashboard')).json();
        const doc = data.requests.find(r => r.document);
        assert.ok(doc, 'demo student has a document to check');
        routes.push('doc/' + doc.id, 'verify/' + data.profile.card_code);
      }
      for (const screen of routes) {
        await route(page, screen);
        for (const [width,height] of viewports) {
          await page.setViewportSize({width,height});
          await page.evaluate(() => new Promise(requestAnimationFrame));
          await layout(page, `${account || 'public'} / ${screen} / ${width}x${height}`);
          cases++;
        }
      }
      await page.setViewportSize({width:320,height:568});
      if (account === 'alina') {
        await route(page, 'requests');
        await page.locator('[data-request-kind]').first().click();
        await page.locator('#note').fill('Проверка мобильной формы');
        await dialog(page, 'request form');
        await route(page, 'today');
        await page.locator('.tcard [data-consult]').first().click();
        await dialog(page, 'consultation form');
        await page.locator('[data-search]').filter({visible:true}).first().click();
        await page.locator('#search-q').fill('математ');
        await dialog(page, 'search');
        await route(page, 'library');
        await page.locator('[data-lib-stage]').scrollIntoViewIfNeeded();
        const previousBook = await page.locator('.lib-settled').getAttribute('data-lib-book');
        await page.locator('[data-lib-step="1"]').click();
        await page.locator('[data-lib-stage]').scrollIntoViewIfNeeded();
        await page.waitForFunction(previous => {
          const book = document.querySelector('.lib-settled');
          return book && book.dataset.libBook !== previous;
        }, previousBook);
        const cover = await page.locator('.lib-settled .lib-cover').boundingBox();
        await page.touchscreen.tap(cover.x + cover.width / 2, cover.y + cover.height / 2);
        await page.locator('.lib-sheet:not([hidden])').waitFor();
        for (const [width,height] of [[280,653],[390,844],[844,390]]) {
          await page.setViewportSize({width,height});
          assert.ok(await page.locator('.lib-sheet').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'book dialog fits width');
        }
        await page.locator('[data-lib-dismiss]').click();
        await page.locator('.lib-sheet').waitFor({state:'hidden'});
      }
      if (account === 'vetrova') {
        await route(page, 'tasks');
        await page.locator('[data-newtask]').first().click();
        await page.locator('#tf-title').fill('Мобильное задание');
        await page.locator('input[name="due_mode"][value="date"]').check();
        assert.equal(await page.locator('.due-when').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1);
        await dialog(page, 'new task form');
        await page.locator('[data-review]').first().click();
        await dialog(page, 'task review');
        await route(page, 'today');
        await page.locator('[data-att]').first().click();
        await dialog(page, 'attendance');
      }
      if (account === 'dekanat') {
        await route(page, 'announce');
        await page.locator('#a-title').fill('Мобильное объявление');
        await page.locator('#a-body').fill('Проверка ввода текста с телефона без публикации.');
        await layout(page, 'staff announcement form');
      }
      await context.close();
    }
    // Deterministic keyboard geometry: desktop automation cannot open a real OS keyboard.
    const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
    await context.addInitScript(() => {
      const viewport = Object.assign(new EventTarget(), {height:844,offsetTop:0,scale:1});
      Object.defineProperty(window, 'visualViewport', {value:viewport});
      window.testViewport = viewport;
    });
    const page = await context.newPage();
    page.on('pageerror', e => pageErrors.push(e.message));
    await login(page, 'alina');
    await route(page, 'requests');
    await page.locator('[data-request-kind]').first().click();
    await page.locator('#note').focus();
    await page.evaluate(() => { testViewport.height = 400; testViewport.dispatchEvent(new Event('resize')); });
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-keyboard-open'));
    assert.equal(await page.locator('.nav').isVisible(), false, 'keyboard leaves room for the form');
    const bounds = await page.locator('#sheet').boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 401, 'dialog stays above the keyboard');
    await page.evaluate(() => { testViewport.scale = 2; testViewport.height = 200; testViewport.dispatchEvent(new Event('resize')); });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--viewport-height')), '400px', 'pinch zoom does not resize the layout');
    await page.evaluate(() => { testViewport.scale = 1; testViewport.height = 844; testViewport.dispatchEvent(new Event('resize')); });
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-keyboard-open'));
    await page.locator('.sheet-close').click();
    await page.locator('#sheet[open]').waitFor({state:'hidden'});
    await context.close();
    assert.deepEqual(pageErrors, [], 'no JavaScript errors');
    console.log(`PASS: ${cases} responsive page/viewport cases; phone, tablet, landscape and desktop; login, student/teacher dialogs, staff input, touch targets and simulated keyboard/zoom.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
