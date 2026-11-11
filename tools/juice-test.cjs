// the funny feedback: a yelp bubble and a dart stuck on a hit kid, paper scraps on a knockout, the combo popup and bonus,
// slow motion when the last kid of a wave drops, the teacher's wig, and the same bubbles on a guest's screen
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } }); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?id=TEST&map=classroom', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const r = await page.evaluate(() => { const g = window.__game, V = g.player.pos.constructor, out = {}; g.renderer.setAnimationLoop(null); g.setDifficulty('normal'); g.start(); g.player.hurt = function () {}; g.openOffer = () => {};
    const waveNext = g.startWave.bind(g); g.startWave = () => {}; g.startBoss = () => {}; g.wave = 1;
    g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = [];
    const mk = (x, z, hp = 2) => { g.spawnQueue.push({ door: { x: x + 0.3, z } }); g.spawnTimer = 0; g.step(1 / 60); const s = g.students[g.students.length - 1]; s.update = function (dt) { this.tick(dt, false); }; s.group.position.set(x, 0, z); s.hp = hp; g.spawnQueue = []; return s; };
    const shoot = (x, z) => { const d = g.darts.fire(new V(x, 1, z + 2), new V(0, 0, -1), 32, 'player'); d.who = 'host'; for (let i = 0; i < 12; i++) g.step(1 / 60); };
    const a = mk(-2, 0), b = mk(0, 0), c = mk(2, 0);
    shoot(-2, 0); out.hit = { yelp: !!(a.yelpSprite && a.yelpSprite.visible), stuck: a.stuck ? a.stuck.length : 0, hp: a.hp };
    const deb0 = g.debris.length, sc0 = g.score; shoot(-2, 0); out.knock = { alive: a.alive, scraps: g.debris.length - deb0, combo: document.getElementById('combo').textContent };
    const sc1 = g.score; b.hp = 1; shoot(0, 0); out.combo2 = { text: document.getElementById('combo').textContent, on: document.getElementById('combo').classList.contains('on'), bonus: g.score - sc1 - 50 - 300, slow: g.slowT > 0 };
    c.hp = 1; shoot(2, 0); out.combo3 = { text: document.getElementById('combo').textContent, lastSlow: +g.slowT.toFixed(2), worldSlow: g.worldSlow() };
    for (let i = 0; i < 60 * 5; i++) g.step(1 / 60); const d2 = mk(0, 0, 1); mk(2, 0, 1); shoot(0, 0); out.comboResets = document.getElementById('combo').textContent; // more than four seconds later: back to one, no new popup
    return out; });
  console.log(JSON.stringify(r));
  await page.evaluate(() => { const g = window.__game; g.renderer.render(g.scene, g.camera); }); await page.screenshot({ path: 'juice.png' });
  // the wig
  const w = await page.evaluate(() => { const g = window.__game; g.students.forEach(s => s.dispose()); g.students = []; g.bossPhase = true; g.spawnTeacher(window.__teachers[0]); const t = g.teachers[0]; const n0 = g.debris.length; t.defeat(); return { debris: g.debris.length - n0, defeated: t.defeated }; });
  console.log('wig', JSON.stringify(w));
  // a guest sees the yelp and the stuck dart too
  const mk2 = async (q) => { const p = await browser.newPage({ viewport: { width: 800, height: 450 } }); p.on('pageerror', e => errors.push(q + ' ' + e.message)); await p.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.__game, null, { timeout: 30000 }); await p.evaluate(() => { window.__game.renderer.setAnimationLoop(null); }); return p; };
  const host = await mk2('role=host'), guest = await mk2('role=guest&slot=g1');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const gq = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), gq); };
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { await host.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); await guest.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); } };
  await relay(); await host.click('#btn-start'); await tick(70);
  const hit = await host.evaluate(() => { const g = window.__game, s = g.students.find(s => s.alive); if (!s) return null; g.lastShooter = 'g1'; s.hp = 5; s.hit(); g.lastShooter = null; g.onKnock('g1'); g.onKnock('g1'); return s.id; });
  await tick(2);
  const gv = await guest.evaluate((id) => { const g = window.__game, s = g.students.find(s => s.id === id); return s ? { yelp: !!(s.yelpSprite && s.yelpSprite.visible), stuck: s.stuck ? s.stuck.length : 0, combo: document.getElementById('combo').textContent } : null; }, hit);
  console.log('guest view', JSON.stringify({ hit, gv }));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
