// The eraser: thrown now and then, bursts into chalk dust, blinds whoever stands in it (players blur, kids hide)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8766/index.html?map=classroom&teacher=math', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const r = await page.evaluate(() => {
    const g = window.__game, V = g.player.pos.constructor; g.renderer.setAnimationLoop(null); g.start();
    g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = []; g.wave = 6; g.bossPhase = true; g.spawnTeacher();
    const t = g.teachers[0]; const out = { teacher: t.def.id, eraserOk: t.eraserOk, firstIn: +t.eraserT.toFixed(1) };
    g.player.hurt = function () { window.__hurts = (window.__hurts || 0) + 1; };
    // natural schedule: an eraser shows up within 25 s
    let seen = false; for (let i = 0; i < 60 * 25 && !seen; i++) { g.step(1 / 60); if (g.darts.list.some(d => d.kind === 'eraser')) seen = true; }
    out.thrownNaturally = seen;
    // forced throw aimed at the player: burst, dust zone, blur, then it fades
    g.player.pos.set(0, 0, 3.5); g.darts.clear(); g.zones.forEach(z => { g.scene.remove(z.mesh); z.puffs.forEach(p => g.scene.remove(p)); }); g.zones = []; g.dustT = 0;
    t.special = null; t.startSpecial(g.player, 'eraser');
    let dust = null; for (let i = 0; i < 60 * 4; i++) { g.step(1 / 60); g.frame && null; const z = g.zones.find(z => z.kind === 'dust'); if (z && !dust) dust = { at: [+z.x.toFixed(1), +z.z.toFixed(1)], r: z.r, puffs: z.puffs.length, afterSteps: i }; }
    out.dust = dust;
    // stand in the cloud: blind; step the frame logic by hand (dustT fades in frame())
    const z = g.zones.find(z => z.kind === 'dust');
    if (z) { g.player.pos.set(z.x, 0, z.z); for (let i = 0; i < 10; i++) { g.step(1 / 60); } }
    out.blind = { dustT: +(g.dustT || 0).toFixed(2) };
    g.ui.dust(g.dustT, g.renderer.domElement);
    out.veil = { opacity: document.getElementById('dust').style.opacity, filter: g.renderer.domElement.style.filter };
    // a kid standing in the dust hides and cannot see
    g.spawnQueue = [{ door: { x: z ? z.x + 0.3 : 0, z: z ? z.z : 0 } }]; g.spawnTimer = 0; g.step(1 / 60); const s = g.students[0];
    if (s && z) { s.path = []; s.state = 'peek'; s.timer = 99; s.group.position.set(z.x, 0, z.z); g.step(1 / 60); out.kidInDust = { state: s.state, canSee: s.canSee(g.player) }; }
    // walk out, wait: the blur fades
    g.player.pos.set(-5, 0, 4); for (let i = 0; i < 60 * 3; i++) { g.step(1 / 60); g.dustT = Math.max(0, (g.dustT || 0) - 1 / 60); }
    g.ui.dust(g.dustT, g.renderer.domElement); out.afterFade = { dustT: +(g.dustT || 0).toFixed(2), opacity: document.getElementById('dust').style.opacity, filter: g.renderer.domElement.style.filter };
    return out;
  });
  console.log(JSON.stringify(r));
  // a screenshot in the cloud
  await page.evaluate(() => { const g = window.__game; const z = g.zones.find(z => z.kind === 'dust'); g.dustT = 1.8; g.ui.dust(1.8, g.renderer.domElement); if (z) { g.player.pos.set(z.x, 0, z.z + 1.2); g.player.yaw = 0; g.player.pitch = 0.05; } g.player.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'dust.png' });
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
