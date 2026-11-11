// new moves: the slide (run + crouch: a short fast low dash, with a cooldown, also under the playground slide) and the thrown eraser
// (stock, a dust cloud where it lands, kids in it cannot see and duck, one back per cleared wave, a guest's throw flown by the host)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } }); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?id=TEST&map=classroom', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const r = await page.evaluate(() => { const g = window.__game, P = () => g.player, out = {}; g.renderer.setAnimationLoop(null); g.setDifficulty('normal'); g.start(); g.player.hurt = function () {}; g.openOffer = () => {}; g.startWave = () => {}; g.startBoss = () => {};
    const run = (keys, n) => { P().keys = keys; const a = P().pos.clone(); for (let i = 0; i < n; i++) P().update(1 / 60); return +P().pos.distanceTo(a).toFixed(2); };
    // run for 0.6 s, crouch-walk for 0.6 s, slide for 0.6 s: the slide covers the most ground and ends low
    P().pos.set(-5, 0, 5.4); P().yaw = -Math.PI / 2; const runD = run({ KeyW: true, ShiftLeft: true }, 36);
    P().pos.set(-5, 0, 5.4); const crouchD = run({ KeyW: true, KeyC: true }, 36); P().keys = {}; P().update(1 / 60);
    P().pos.set(-5, 0, 5.4); P().slideCd = 0; run({ KeyW: true, ShiftLeft: true }, 6); const before = P().pos.clone(); P().keys = { KeyW: true, ShiftLeft: true, KeyC: true }; P().update(1 / 60); const started = P().slideT > 0; let low = 9; for (let i = 0; i < 35; i++) { P().update(1 / 60); low = Math.min(low, P().eye); }
    out.slide = { runD, crouchD, slideD: +P().pos.distanceTo(before).toFixed(2), started, lowEye: +low.toFixed(2), cdAfter: +P().slideCd.toFixed(2) };
    P().keys = { KeyW: true, ShiftLeft: true }; P().update(1 / 60); P().keys = { KeyW: true, ShiftLeft: true, KeyC: true }; P().update(1 / 60); out.slide.againDuringCd = P().slideT > 0 && P().slideCd > 1.5; // a second press while cooling down only crouches
    P().keys = {}; for (let i = 0; i < 120; i++) P().update(1 / 60);
    // not from a standstill, not from a walk
    P().slideCd = 0; P().keys = { KeyC: true }; P().update(1 / 60); const still = P().slideT > 0; P().keys = {}; P().update(1 / 60); P().keys = { KeyW: true }; P().update(1 / 60); P().keys = { KeyW: true, KeyC: true }; P().update(1 / 60); out.slide.fromStill = still; out.slide.fromWalk = P().slideT > 0; P().keys = {};
    // eraser: stock 2, a cloud where it lands, kids standing in it lose sight and duck
    for (let i = 0; i < 30; i++) g.step(1 / 60);
    g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = [];
    g.spawnQueue.push({ door: { x: 0.3, z: -1 } }); g.spawnTimer = 0; g.step(1 / 60); const s = g.students[0]; s.group.position.set(0, 0, -1); s.state = 'peek'; s.timer = 5; g.spawnQueue = [];
    P().pos.set(0, 0, 4); P().yaw = 0; P().pitch = 0; P().update(1 / 60);
    out.eraser = { stock0: P().erasers, hud0: document.getElementById('eraser-n').textContent, seesBefore: s.canSee(P()) };
    P().throwEraser(); out.eraser.stock1 = P().erasers; out.eraser.kind = g.darts.list[g.darts.list.length - 1].kind;
    let t = 0; while (t < 3 && !g.zones.some(z => z.kind === 'dust')) { g.step(1 / 60); t += 1 / 60; }
    const z = g.zones.find(z => z.kind === 'dust'); out.eraser.landed = z ? { after: +t.toFixed(2), x: +z.x.toFixed(1), z: +z.z.toFixed(1), r: z.r } : null;
    if (z) { s.group.position.set(z.x, 0, z.z); s.state = 'peek'; s.timer = 5; g.step(1 / 60); out.eraser.kidInDust = { sees: s.canSee(P()), state: s.state }; }
    P().eraserCd = 0; P().throwEraser(); P().eraserCd = 0; P().throwEraser(); out.eraser.empty = [P().erasers, document.getElementById('eraser-n').textContent];
    // clearing a wave gives one back
    g.startWave = undefined; delete g.startWave; g.students.forEach(x => x.dispose()); g.students = []; g.wave = 1; g.nextWavePending = false; g.bossPhase = false; g.step(1 / 60); out.eraser.afterWave = P().erasers;
    return out; });
  console.log(JSON.stringify(r));
  // under the playground slide: a slide dash gets through the low part a standing run cannot enter
  await page.goto('http://localhost:8766/index.html?id=TEST&map=yard', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const y = await page.evaluate(() => { const g = window.__game, P = g.player; g.renderer.setAnimationLoop(null); g.start(); const Pl = g.player; Pl.hurt = function () {};
    Pl.pos.set(-2.2, 0, -0.4); Pl.yaw = 0; Pl.keys = { KeyW: true, ShiftLeft: true }; for (let i = 0; i < 6; i++) Pl.update(1 / 60); Pl.keys = { KeyW: true, ShiftLeft: true, KeyC: true }; for (let i = 0; i < 40; i++) Pl.update(1 / 60);
    return { z: +Pl.pos.z.toFixed(2), crouching: Pl.crouching }; });
  console.log('under the yard slide', JSON.stringify(y));
  // a guest throws: the host flies the eraser
  const mk2 = async (q) => { const p = await browser.newPage({ viewport: { width: 800, height: 450 } }); p.on('pageerror', e => errors.push(q + ' ' + e.message)); await p.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.__game, null, { timeout: 30000 }); await p.evaluate(() => { window.__game.renderer.setAnimationLoop(null); }); return p; };
  const host = await mk2('role=host'), guest = await mk2('role=guest&slot=g1');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const gq = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), gq); };
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { await host.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); await guest.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); } };
  await relay(); await host.click('#btn-start'); await tick(5);
  const gs = await guest.evaluate(() => { const g = window.__game; g.player.throwEraser(); return g.player.erasers; }); await relay();
  const hs = await host.evaluate(() => window.__game.darts.list.filter(d => d.kind === 'eraser' && d.who === 'g1').length); await tick(25);
  const dust = await Promise.all([host, guest].map(p => p.evaluate(() => window.__game.zones.filter(z => z.kind === 'dust').length)));
  console.log('guest eraser', JSON.stringify({ guestStock: gs, hostEraser: hs, dustHostGuest: dust }));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
