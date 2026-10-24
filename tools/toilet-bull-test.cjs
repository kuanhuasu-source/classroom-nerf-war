// the bullseye must be visible (outside every collision box) and hittable the way a player does it: crosshair on it, pull the trigger
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?mode=toilet', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); window.__game.start(); });
  const r = await page.evaluate(() => { const g = window.__game, w = g.world, V = g.player.pos.constructor, T = w.target, out = {};
    g.students.forEach(s => { s.update = () => {}; }); g.player.hurt = () => {};
    out.targetInBox = !!w.pointInBox(new V(T.x, T.y, T.z));
    out.visibleFromStart = !w.segmentBlocked(new V(g.world.layout.start.x, 1.25, g.world.layout.start.z), new V(T.x, T.y, T.z));
    // like a player: stand at several distances, put the crosshair on the centre, fire once, step
    out.shots = [];
    for (const dist of [3, 5, 7, 9]) {
      g.toMenu(); g.start(); g.students.forEach(s => { s.update = () => {}; }); g.player.hurt = () => {};
      g.player.pos.set(0, 0, T.z + dist); g.player.yaw = 0; g.player.pitch = 0; g.player.update(1 / 60);
      // aim: the camera looks down -z at eye height 1.25 = target height, so pitch 0 is on the centre; add the gravity drop the crosshair ignores
      g.player.fireCd = 0; g.player.tryFire(); for (let i = 0; i < 60 && g.state === 'playing'; i++) g.step(1 / 60);
      out.shots.push([dist, g.state]);
    }
    // an off-centre shot inside the bull and one in the outer ring
    g.toMenu(); g.start(); g.students.forEach(s => { s.update = () => {}; }); g.player.hurt = () => {};
    const fireAt = (dx, dy) => { const from = new V(0, 1.25, T.z + 4); const d = g.darts.fire(from, new V(T.x + dx - from.x, T.y + dy - from.y, T.z - from.z).normalize(), 32, 'player'); d.who = 'host'; for (let i = 0; i < 40 && g.state === 'playing'; i++) g.step(1 / 60); return g.state; };
    out.ring = fireAt(0.35, 0); out.ringMsg = document.getElementById('msg').textContent.slice(0, 12); out.nearEdge = fireAt(0.15, 0.08);
    return out; });
  console.log(JSON.stringify(r));
  await page.evaluate(() => { const g = window.__game; g.toMenu(); g.start(); g.player.pos.set(0.6, 0, -2.5); g.player.yaw = 0.1; g.player.pitch = 0; g.player.update(1 / 60); g.renderer.render(g.scene, g.camera); }); await page.screenshot({ path: 'toilet-target.png' });
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
