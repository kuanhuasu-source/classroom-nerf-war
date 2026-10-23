const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ ...devices['Pixel 5 landscape'] });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => window.__game.renderer.setAnimationLoop(null));
  console.log('viewport meta:', await page.evaluate(() => document.querySelector('meta[name=viewport]').content), '| body touch-action:', await page.evaluate(() => getComputedStyle(document.body).touchAction));
  await page.tap('#btn-start'); await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__game.step(1 / 60); });
  // two fingers at once: one on the stick side, one on the look side. The touch events must be cancelled (defaultPrevented) and both controls must still work.
  const r = await page.evaluate(() => new Promise(res => {
    const seen = []; const rec = e => seen.push(e.type + ':' + e.touches.length + ':' + e.defaultPrevented);
    for (const n of ['touchstart', 'touchmove', 'touchend']) document.addEventListener(n, rec, { passive: true }); // registered after the game's listener, so defaultPrevented is final
    window.__seen = seen; res(true);
  }));
  const cdp = await ctx.newCDPSession(page); const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const W = page.viewportSize().width, H = page.viewportSize().height;
  await touch('touchStart', [{ x: W * 0.2, y: H * 0.7, id: 1 }]); await touch('touchStart', [{ x: W * 0.2, y: H * 0.7, id: 1 }, { x: W * 0.7, y: H * 0.4, id: 2 }]);
  await touch('touchMove', [{ x: W * 0.2, y: H * 0.7 - 40, id: 1 }, { x: W * 0.7 + 80, y: H * 0.4, id: 2 }]);
  const mid = await page.evaluate(() => [window.__game.touchCtl.move.z.toFixed(2), !!window.__game.touchCtl.look]);
  await touch('touchEnd', [{ x: W * 0.2, y: H * 0.7 - 40, id: 1 }]); await touch('touchEnd', []);
  console.log('two fingers: stick z', mid[0], 'look active', mid[1], '| events prevented:', await page.evaluate(() => window.__seen.join(' ')));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
