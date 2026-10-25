// lunch mode with the real animation loop and real key presses: drive to the first door and watch for errors when kids come out
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (q, role) => { const page = await browser.newPage({ viewport: { width: 900, height: 500 } }); page.on('pageerror', e => errors.push(role + ' pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n'))); page.on('console', m => { if (m.type() === 'error') errors.push(role + ' console: ' + m.text().slice(0, 300)); }); page.on('crash', () => errors.push(role + ' PAGE CRASHED')); await page.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 }); await page.evaluate(() => window.__game.renderer.setPixelRatio(0.5)); return page; };
  const host = await mk('role=host&mode=lunch', 'host'), guest = await mk('role=guest&slot=g1', 'guest');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const g = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), g); };
  await relay(); await host.click('#btn-start'); await relay();
  // real key presses on the host (driver) while both pages run their own loops; relay every 60 ms
  await host.keyboard.down('KeyW');
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < 14000) { await relay(); await new Promise(r => setTimeout(r, 60));
    const s = await host.evaluate(() => { const g = window.__game, L = g.lunchMode; return L ? { x: +L.cart.pos.x.toFixed(1), vis: L.kids.filter(k => k.group.visible).length, state: g.state, fps: g.lastFps || 0 } : null; }).catch(e => ({ err: String(e).slice(0, 80) }));
    const j = JSON.stringify(s); if (j !== last && (s.vis || s.err)) { console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', j); last = j; }
    if (errors.length) break; }
  await host.keyboard.up('KeyW');
  console.log('guest kids visible', await guest.evaluate(() => window.__game.lunchMode ? window.__game.lunchMode.kids.filter(k => k.group.visible).length : -1).catch(e => 'ERR ' + e.message));
  await host.screenshot({ path: 'lunch-live-host.png' }); await guest.screenshot({ path: 'lunch-live-guest.png' });
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
