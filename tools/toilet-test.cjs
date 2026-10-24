// 搶廁所: toilet map forced, 3 hp, countdown, cleaners with water (slow) and plunger bursts, crew refill, bullseye win, timeout loss
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?mode=toilet', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); window.__game.start(); });
  const snap = () => page.evaluate(() => { const g = window.__game; return { state: g.state, map: g.world.layout.id, target: g.world.target, hp: [g.player.hp, g.player.maxHp], timer: [document.getElementById('hud-time').hidden, document.getElementById('time').textContent], label: document.getElementById('left').previousElementSibling.textContent, wave: document.getElementById('wave').textContent, cleaners: g.students.filter(s => s.alive).map(s => [s.state, !!s.v.cleaner]), timeLeft: +g.timeLeft.toFixed(1) }; });
  console.log('start', JSON.stringify(await snap()));
  await page.evaluate(() => { const g = window.__game; g.player.update(1 / 60); g.renderer.render(g.scene, g.camera); }); await page.screenshot({ path: 'toilet-start.png' });
  // watch what the crew throws for 25 s (player invulnerable so the round keeps going); record plunger burst sizes
  const stats = await page.evaluate(() => { const g = window.__game; g.player.hurt = function () { this.hits0 = (this.hits0 || 0) + 1; };
    const counts = {}, bursts = []; const orig = g.darts.fire.bind(g.darts); g.darts.fire = (p, d, s, o, k) => { if (o === 'enemy') counts[k] = (counts[k] || 0) + 1; return orig(p, d, s, o, k); };
    const seen = new Set();
    for (let i = 0; i < 60 * 25; i++) { g.step(1 / 60); g.ui.tick(1 / 60); for (const s of g.students) { if (s.state === 'shoot' && s.burstKind === 'plunger' && !seen.has(s.id + ':' + s.age.toFixed(0))) { seen.add(s.id + ':' + s.age.toFixed(0)); } } }
    // burst sizes: sample by re-rolling the decision 200 times
    const sizes = new Set(); for (let i = 0; i < 200; i++) { const n = window.__cfgTOILET ? 0 : 0; }
    return { counts, hitsTaken: g.player.hits0 || 0, timeLeft: +g.timeLeft.toFixed(1), alive: g.students.filter(s => s.alive).length }; });
  console.log('25 s of crew fire', JSON.stringify(stats));
  // burst size: force a cleaner into shoot and read shotsLeft right after the roll
  const bursts = await page.evaluate(() => { const g = window.__game, s = g.students.find(s => s.alive); const out = []; for (let i = 0; i < 40; i++) { s.state = 'peek'; s.timer = 0; s.crouch = 0; s.canSee = () => true; g.shootersBusy = () => false; s.update(1 / 60); if (s.state === 'shoot') out.push([s.burstKind, s.shotsLeft]); s.state = 'hide'; s.timer = 9; } return out; });
  const pl = bursts.filter(b => b[0] === 'plunger').map(b => b[1]), wa = bursts.filter(b => b[0] === 'water').map(b => b[1]);
  console.log('bursts: plunger sizes', [...new Set(pl)].sort().join(','), 'water sizes', [...new Set(wa)].join(','), 'water share', (wa.length / bursts.length).toFixed(2));
  // water hit -> slowed for 5 s: measure walking distance per second
  const wet = await page.evaluate(() => { const g = window.__game, V = g.player.pos.constructor; g.students.forEach(s => { s.update = () => {}; });
    const walk = (secs) => { const a = g.player.pos.clone(); g.player.keys = { KeyW: true }; for (let i = 0; i < secs * 60; i++) { g.player.update(1 / 60); } g.player.keys = {}; return +g.player.pos.distanceTo(a).toFixed(2); };
    g.player.pos.set(0, 0, 2); g.player.yaw = 0; const dry = walk(0.5);
    g.player.pos.set(0, 0, 2); const from = new V(0, 1.1, 0.4); g.darts.fire(from, new V(0, 0, 1), 4, 'enemy', 'water'); for (let i = 0; i < 30; i++) g.step(1 / 60);
    const wet0 = +g.player.wet.toFixed(1), overlay = document.getElementById('wet').classList.contains('on');
    g.player.pos.set(0, 0, 2); const slow = walk(0.5);
    for (let i = 0; i < 60 * 5; i++) g.player.update(1 / 60); const after = +g.player.wet.toFixed(1), overlayAfter = document.getElementById('wet').classList.contains('on');
    return { dry, wet0, overlay, slow, after, overlayAfter }; });
  console.log('water', JSON.stringify(wet));
  // crew refill: knock out two, wait
  const refill = await page.evaluate(() => { const g = window.__game; let n = 0; for (const s of g.students) { if (s.alive && n < 2) { s.hp = 1; s.hit(); n++; } } const a0 = g.students.filter(s => s.alive).length + g.spawnQueue.length; for (let i = 0; i < 60 * 8; i++) g.step(1 / 60); return { after: a0, later: g.students.filter(s => s.alive).length + g.spawnQueue.length }; });
  console.log('refill', JSON.stringify(refill));
  // cans: stand 3 m in front of each can (side cans: from the aisle), crosshair on it, pull the trigger
  const win = await page.evaluate(() => { const g = window.__game, V = g.player.pos.constructor; const log = [];
    for (let i = 0; i < g.world.cans.length && g.state === 'playing'; i++) { const c = g.world.cans[i]; const side = c.x > 4; const px = side ? c.x - 3 : c.x, pz = side ? c.z : c.z + 3;
      g.player.pos.set(px, 0, pz); g.player.yaw = side ? -Math.PI / 2 : 0; g.player.pitch = Math.atan2(c.y - 1.25, 3); g.player.update(1 / 60);
      let shots = 0; while (g.world.cans[i].alive && shots < 4 && g.state === 'playing') { g.player.fireCd = 0; g.player.ammo = 15; g.player.tryFire(); shots++; for (let k = 0; k < 30; k++) g.step(1 / 60); }
      log.push([i, shots, !g.world.cans[i].alive]); }
    return { log, state: g.state, left: g.cansLeft(), hud: document.getElementById('wave').textContent, label: document.getElementById('wave').previousElementSibling.textContent, title: g.overInfo && g.overInfo.title, sub: g.overInfo && g.overInfo.sub }; });
  console.log('cans', JSON.stringify(win));
  await page.evaluate(() => { const g = window.__game; g.player.pos.set(0, 0, -4.0); g.player.yaw = 0; g.player.pitch = -0.02; g.player.update(1 / 60); g.renderer.render(g.scene, g.camera); }); await page.screenshot({ path: 'toilet-win.png' });
  // timeout: a fresh round with 1 s left
  const lose = await page.evaluate(() => { const g = window.__game; g.toMenu(); g.start(); g.timeLeft = 1.0; for (let i = 0; i < 90; i++) g.step(1 / 60); return { state: g.state, title: document.getElementById('over-title').textContent, hidden: document.getElementById('over').hidden }; });
  console.log('timeout', JSON.stringify(lose));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
