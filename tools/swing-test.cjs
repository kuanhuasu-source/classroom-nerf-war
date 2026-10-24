// through the swing's A-frame: the crosshair ray and a real dart must pass; walking into it must still stop
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?map=yard', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); window.__game.start(); });
  const r = await page.evaluate(() => { const g = window.__game, w = g.world, V = g.player.pos.constructor;
    const eye = new V(2.6, 1.25, -0.5), dir = new V(0, 0, -1); // looking down the x = 2.6 leg pair of the swing at (4, -3)
    const ray = w.rayDistance(eye, dir, 30);
    const los = w.segmentBlocked(eye, new V(2.6, 1.25, -6));
    const d = g.darts.fire(eye.clone(), dir.clone(), 32, 'player'); for (let i = 0; i < 30; i++) g.darts.update(1 / 60, () => false);
    const dartZ = +d.mesh.position.z.toFixed(2);
    const p = new V(2.6, 0, -1.5); for (let k = 0; k < 80; k++) w.walk(p, 0, -0.04, 0.28); const walkZ = +p.z.toFixed(2);
    const q = new V(0.5, 0, 0.5); for (let k = 0; k < 80; k++) w.walk(q, 0, 0.04, 0.28); const pondZ = +q.z.toFixed(2);
    const over = w.rayDistance(new V(0.5, 0.3, 0.5), new V(0, 0, 1), 30); // a low dart across the pond
    return { ray: +ray.toFixed(1), losBlocked: los, dartZ, walkStopsAt: walkZ, pondWalkStopsAt: pondZ, lowRayOverPond: +over.toFixed(1), softBoxes: w.boxes.filter(b => b.soft).length }; });
  console.log(JSON.stringify(r)); console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
