// the front page's QR decodes to the site address; a room's QR decodes to ?room=CODE and that link auto-joins
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.addScriptTag({ path: path.join(__dirname, 'node_modules/jsqr/dist/jsQR.js') });
  const decode = (id) => page.evaluate((id) => { const c = document.getElementById(id); const ctx = c.getContext('2d'); const d = ctx.getImageData(0, 0, c.width, c.height); const r = window.jsQR(d.data, d.width, d.height); return r ? r.data : null; }, id);
  console.log('site QR visible:', await page.evaluate(() => !document.getElementById('qr-site-wrap').hidden), '| decodes to:', await decode('qr-site'));
  await page.click('#btn-host'); await page.waitForTimeout(500);
  const code = await page.evaluate(() => document.getElementById('lobby-code').textContent);
  console.log('room code', code, '| room QR decodes to:', await decode('qr-room'));
  await page.screenshot({ path: 'qr-lobby.png', clip: { x: 300, y: 560, width: 700, height: 340 } });
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.goto('http://localhost:8766/index.html?room=' + code, { waitUntil: 'networkidle' }); await p2.waitForFunction(() => window.__game); await p2.waitForTimeout(1200);
  console.log('scanned link: join panel open', await p2.evaluate(() => !document.getElementById('lobby-join').hidden), '| code filled', await p2.evaluate(() => document.getElementById('join-code').value), '| status:', await p2.evaluate(() => document.getElementById('lobby-status').textContent.slice(0, 24)));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
