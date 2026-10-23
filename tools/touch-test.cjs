const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const ctx = await browser.newContext({ ...devices['Pixel 5 landscape'] });
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setPixelRatio(1); window.__game.renderer.setAnimationLoop(null); });
  const vp = page.viewportSize();
  console.log('viewport', vp, '| touch detected:', await page.evaluate(() => [document.body.classList.contains('touch'), window.__game.touch, document.getElementById('menu-note').textContent.slice(0, 22)]));
  await page.screenshot({ path: 'touch-menu.png' });
  await page.tap('#btn-start');
  const step = (s) => page.evaluate((s) => { const g = window.__game; for (let i = 0; i < Math.round(s * 60); i++) { g.step(1 / 60); g.ui.tick(1 / 60); g.touchCtl.update(); } return [g.state, g.player.pos.x.toFixed(2), g.player.pos.z.toFixed(2), g.player.yaw.toFixed(2), g.player.ammo, g.player.crouching]; }, s);
  console.log('after start:', await step(0.5), '| layer shown:', await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display));
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  // 1. stick: left side drag up = walk forward
  const sx = vp.width * 0.2, sy = vp.height * 0.7;
  await touch('touchStart', [{ x: sx, y: sy, id: 1 }]); await touch('touchMove', [{ x: sx, y: sy - 40, id: 1 }]);
  const before = await step(0.01); await step(1);
  const afterMove = await page.evaluate(() => [window.__game.touchCtl.move, getComputedStyle(document.getElementById('tc-stick')).display, window.__game.player.pos.x.toFixed(2), window.__game.player.pos.z.toFixed(2)]);
  await touch('touchEnd', []);
  console.log('stick: move vec', JSON.stringify(afterMove[0]), 'stick shown', afterMove[1], '| pos before', before[1], before[2], 'after', afterMove[2], afterMove[3], '| released:', await page.evaluate(() => [window.__game.touchCtl.move.x, getComputedStyle(document.getElementById('tc-stick')).display]));
  // 2. look: right side drag
  const yaw0 = (await step(0.01))[3];
  const lx = vp.width * 0.7, ly = vp.height * 0.4;
  await touch('touchStart', [{ x: lx, y: ly, id: 2 }]); await touch('touchMove', [{ x: lx + 60, y: ly, id: 2 }]); await touch('touchMove', [{ x: lx + 120, y: ly, id: 2 }]); await touch('touchEnd', []);
  const yaw1 = (await step(0.01))[3];
  console.log('look: yaw', yaw0, '->', yaw1, '| ammo unchanged by drag:', (await step(0.01))[4]);
  // 3. tap on the right = one shot
  const ammo0 = (await step(0.3))[4];
  await touch('touchStart', [{ x: lx, y: ly, id: 3 }]); await touch('touchEnd', []);
  console.log('tap fires: ammo', ammo0, '->', (await step(0.05))[4]);
  // 4. fire button hold = auto fire; reload; crouch toggle
  const bb = async (id) => { const b = await page.$('#' + id); const r = await b.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const f = await bb('tc-fire'); await touch('touchStart', [{ x: f.x, y: f.y, id: 4 }]); const a1 = (await step(0.05))[4]; await step(1); const a2 = (await step(0.01))[4]; await touch('touchEnd', []);
  console.log('fire button: firing flag', a1, '->', a2, 'after 1 s hold | released firing:', await page.evaluate(() => window.__game.player.firing));
  const r = await bb('tc-reload'); await touch('touchStart', [{ x: r.x, y: r.y, id: 5 }]); await touch('touchEnd', []);
  console.log('reload started:', await page.evaluate(() => window.__game.player.reloading > 0));
  const c = await bb('tc-crouch'); await touch('touchStart', [{ x: c.x, y: c.y, id: 6 }]); await touch('touchEnd', []);
  console.log('crouch toggled:', (await step(0.1))[5], '| held class:', await page.evaluate(() => document.getElementById('tc-crouch').classList.contains('held')));
  await touch('touchStart', [{ x: c.x, y: c.y, id: 7 }]); await touch('touchEnd', []); console.log('crouch off:', (await step(0.1))[5]);
  await page.screenshot({ path: 'touch-play.png' });
  // 5. pause button
  const p = await bb('tc-pause'); await touch('touchStart', [{ x: p.x, y: p.y, id: 8 }]); await touch('touchEnd', []);
  console.log('paused:', await page.evaluate(() => [window.__game.state, document.getElementById('pause').hidden]));
  await page.tap('#btn-resume'); console.log('resumed:', (await step(0.1))[0]);
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
