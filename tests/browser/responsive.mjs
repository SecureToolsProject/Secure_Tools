import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { translations } from '../../js/i18n.js';
import { createFixtures, PDFLib } from '../production/fixtures.mjs';
import { assertSecurityHeaders } from '../../scripts/http-security-headers.mjs';

// Exercise the real built pages and native controls; never substitute app code/CSP.
const viewports = [[320,568],[360,800],[375,812],[390,844],[430,932],[768,1024],[1280,900]];
const routes = ['/', '/image/', '/image/converter/', '/image/to-text/', '/pdf/merge/', '/pdf/metadata/', '/image/metadata/'];
const directory = '.ts-build/responsive';
await fs.mkdir(directory, { recursive: true });
const report = { cases: [], errors: [], headerErrors: [], external: [], status: 'FAIL' };
const port = 44000 + Math.floor(Math.random() * 9000);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['tests/serve-ocr-smoke.mjs', String(port)], { stdio: ['ignore','pipe','inherit'] });
let browser;
try {
  await new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(new Error('Responsive server timed out')),10000);
    server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Server exited ${code}`)));
  });
  browser = await chromium.launch();
  const fixtures = await createFixtures(browser);
  const pdf = await PDFLib.PDFDocument.load(fixtures.replacement.buffer);
  pdf.setTitle('Mobile metadata — 한국어 日本語 '.repeat(12));
  const pdfFile = { name: '모바일-メタデータ.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) };
  for (const language of ['en','ko','ja']) for (const theme of ['system','light','dark']) {
    const context = await browser.newContext({ locale: language, colorScheme: theme === 'light' ? 'light' : 'dark', acceptDownloads: true });
    await context.addInitScript(({language,theme}) => {
      // Exercise the browser download fallback without opening an OS save dialog.
      delete window.showSaveFilePicker;
      localStorage.setItem('secure-tools-language', language);
      localStorage.setItem('secure-tools-theme', theme);
      document.addEventListener('securitypolicyviolation', event => console.error(`CSP: ${event.effectiveDirective} ${event.blockedURI}`));
    }, {language,theme});
    context.on('request', request => {
      if (!request.url().startsWith(origin + '/') && !/^(blob:|data:|about:)/.test(request.url())) report.external.push(request.url());
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    for (const [width,height] of viewports) {
      await page.setViewportSize({width,height});
      for (const route of routes) {
        report.active = {language,theme,width,height,route};
        const response = await page.goto(origin + route);
        if (!report.headerErrors.length) {
          try { assertSecurityHeaders(new Headers(response.headers())); }
          catch (error) { report.headerErrors.push(error.message); }
        }
        await page.waitForFunction(({language,theme}) => document.documentElement.lang === language && document.documentElement.dataset.theme === theme && document.querySelector('.header-menu')?.dataset.navigationReady === 'true', {language,theme});
        const menu = page.locator('.header-menu');
        const summary = menu.locator(':scope > summary');
        const mobile = width <= 608;
        assert.equal(await menu.evaluate(el => el.open), !mobile);
        if (mobile) {
          assert.ok((await page.locator('.site-header').boundingBox()).height <= 80, 'Collapsed mobile header stays compact');
          assert.equal(await page.locator('.site-nav').isVisible(), false);
          await summary.focus(); await page.keyboard.press('Enter');
          assert.equal(await menu.evaluate(el => el.open), true);
          assert.equal(await page.locator('.site-nav a').count(), 4);
          assert.ok(await page.locator('[data-language-select]').isVisible());
          assert.ok(await page.locator('[data-theme-select]').isVisible());
          assert.equal(await summary.innerText(), translations[language].common.menu);
          await page.keyboard.press('Tab');
          assert.ok(await page.locator('.site-nav a').first().evaluate(el => el === document.activeElement), 'Links follow disclosure in tab order');
          await page.keyboard.press('Escape');
          assert.equal(await menu.evaluate(el => el.open), false);
          assert.ok(await summary.evaluate(el => el === document.activeElement));
        }
        const category = page.locator('.category-nav__inner');
        if (await category.count()) {
          const rects = await category.locator('a').evaluateAll(links => links.map(link => { const r = link.getBoundingClientRect(); return {top:r.top,height:r.height}; }));
          assert.ok(rects.every(r => Math.abs(r.top - rects[0].top) < 1 && r.height >= 44), 'Single-row category navigation retains touch targets');
          assert.equal(await page.locator('.category-nav [aria-current="page"]').count(), 1);
          if (mobile) assert.ok((await page.locator('.category-nav').boundingBox()).height <= 64);
          await category.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        }
        const scope = page.locator('.scope-note');
        if (await scope.count()) {
          assert.ok(await scope.evaluate(el => {
            const result = document.querySelector('.clean-result, .metadata-comparison');
            return !!(result.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
          }), 'Scope follows results in source order at every viewport');
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert.equal(overflow, false, `${language}/${theme}/${width} ${route}: page overflow`);
        const clipped = await page.locator('select:visible').evaluateAll(selects => selects.filter(el => {const r=el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.width < 40;}).map(el => el.id));
        assert.deepEqual(clipped, [], 'Visible selects stay inside viewport');
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.locator('.skip-link[href="#main"]').count(), 1);
        // Populate metadata and settings pages at each width, including long CJK metadata.
        if (theme === 'dark' && route.includes('/metadata/')) {
          await page.locator('#file-input').setInputFiles(route.startsWith('/pdf') ? pdfFile : fixtures.english);
          const clean = page.locator(route.startsWith('/pdf') ? '#clean-pdf' : '#clean-image');
          await clean.waitFor({state:'visible'});
          await page.waitForFunction(selector => !document.querySelector(selector).disabled, route.startsWith('/pdf') ? '#clean-pdf' : '#clean-image');
          const download = page.waitForEvent('download'); await clean.click(); await download;
          await page.locator(route.startsWith('/pdf') ? '.metadata-comparison' : '.clean-result').waitFor({state:'visible'});
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Populated metadata has no page overflow');
          assert.ok((await scope.boundingBox()).y > (await page.locator('.metadata-workspace').boundingBox()).y);
        }
        if (language === 'ko' && theme === 'dark' && [320,390,768,1280].includes(width)) {
          await page.screenshot({path:`${directory}/${width}-${route.replaceAll('/','_') || 'home'}.png`,fullPage:true});
        }
        report.cases.push({language,theme,width,height,route,passed:true});
      }
    }
    // Native select keyboard and resolved system theme remain functional.
    await page.setViewportSize({width:1280,height:900});
    await page.goto(origin + '/');
    await page.locator('[data-theme-select]').selectOption('light');
    await page.waitForFunction(() => document.documentElement.dataset.resolvedTheme === 'light');
    await page.locator('[data-theme-select]').selectOption('system');
    await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
    await page.waitForFunction(() => document.documentElement.dataset.resolvedTheme === 'dark');
    await page.locator('[data-language-select]').selectOption(language);
    if (language === 'en' && theme === 'system') {
      const select = page.locator('[data-language-select]');
      await select.selectOption('en'); await select.focus();
      await page.keyboard.press('Space'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
      assert.equal(await select.inputValue(), 'fr', 'Native popup supports keyboard selection');
      await select.selectOption('en');
      await page.keyboard.press('Space'); await page.keyboard.press('Escape');
      assert.equal(await select.inputValue(), 'en', 'Escape leaves selection unchanged');
    }
    await context.close();
    console.log(`Responsive matrix: ${language}/${theme} complete (${report.cases.length} cases)`);
  }
  // All six localized menu names and no-JS semantic navigation fallback.
  const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:568}});
  const page = await context.newPage(); await page.goto(origin + '/');
  await page.locator('.header-menu > summary').click();
  assert.ok(await page.locator('.site-nav').isVisible());
  await context.close();
  for (const language of ['en','ko','ja','es','de','fr']) assert.ok(translations[language].common.menu);
  assert.deepEqual(report.headerErrors, [], 'Served headers must preserve strict CSP');
  assert.deepEqual(report.external, [], 'No external requests or telemetry');
  assert.deepEqual(report.errors, [], 'No page/console/CSP errors');
  report.status = 'PASS';
  console.log(`Responsive/accessibility matrix passed: ${report.cases.length} cases, populated metadata, themes, keyboard and no-JS navigation.`);
} finally {
  await fs.writeFile(`${directory}/report.json`, JSON.stringify(report,null,2));
  await browser?.close(); server.kill();
}
