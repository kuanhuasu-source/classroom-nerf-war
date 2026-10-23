const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?map=classroom', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); window.__game.start(); });
  const r = await page.evaluate(() => { const g = window.__game, w = g.world, V = g.player.pos.constructor; const out = {};
    out.room = [w.room.w, w.room.d, w.desks.length];
    // walk every row aisle left to right and every column aisle front to back
    const rows = [-2.9, -1.2, 0.5, 2.2], cols = [-3.6, -1.8, 0, 1.8, 3.6];
    out.rowAisles = []; for (let i = 0; i < rows.length - 1; i++) { const z = (rows[i] + 0.68 + rows[i + 1] - 0.23) / 2; const p = new V(-5.0, 0, z); for (let k = 0; k < 260; k++) w.walk(p, 0.045, 0, 0.28); out.rowAisles.push(+p.x.toFixed(1)); }
    out.colAisles = []; for (let i = 0; i < cols.length - 1; i++) { const x = (cols[i] + cols[i + 1]) / 2; const p = new V(x, 0, 4.5); for (let k = 0; k < 220; k++) w.walk(p, 0, -0.045, 0.28); out.colAisles.push(+p.z.toFixed(1)); }
    // diagonal wander with random direction changes: how often does the player get wedged (no movement for 1 s)?
    const p = new V(-5, 0, 4); let stuck = 0, a = 0; for (let k = 0; k < 3600; k++) { if (k % 90 === 0) a = Math.random() * 6.28; const before = p.clone(); w.walk(p, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.28); if (p.distanceTo(before) < 0.005) { stuck++; a += 1.3; } }
    out.wedgedFrames = stuck;
    out.pathCorner = w.path(w.layout.start, { x: 5.5, z: -4.5 }).length;
    return out; });
  console.log(JSON.stringify(r)); console.log('ERRORS:', errors.length ? errors : 'none');
  await page.evaluate(() => { const g = window.__game; const p = g.player; p.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'classroom-big.png' });
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
