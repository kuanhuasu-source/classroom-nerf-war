// 守校門 mode: yard forced, three entrances, unlimited ammo, gang bosses on waves 3/6/9, the king on 10, win after ten waves
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?mode=siege&map=classroom', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); });
  await page.screenshot({ path: 'siege-menu.png' });
  await page.evaluate(() => { const g = window.__game; g.start(); g.player.hurt = function () { this.hp = Math.max(1, this.hp); }; });
  const sim = (s) => page.evaluate((s) => { const g = window.__game; for (let i = 0; i < Math.round(s * 60); i++) { if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } g.step(1 / 60); g.ui.tick(1 / 60); } }, s);
  const snap = () => page.evaluate(() => { const g = window.__game; return { state: g.state, wave: g.wave, waveHud: document.getElementById('wave').textContent, reserveHud: document.getElementById('reserve').textContent, map: g.world.layout.id, siege: g.world.siege, drains: g.world.drains.length, students: g.students.filter(s => s.alive).map(s => [s.state, s.entry && s.entry.kind, +s.group.position.y.toFixed(2)]), teachers: g.teachers.map(t => [t.def.id, t.defeated]), reserve: g.player.reserve, bossDue: +g.bossDue.toFixed(1) }; });
  console.log('start', JSON.stringify(await snap()));
  // sample every frame while wave 1 spawns: how high do wall / drain entrants start, and do they end on the ground?
  const ys = await page.evaluate(() => { const g = window.__game, acc = {}; for (let i = 0; i < 60 * 9.2; i++) { g.step(1 / 60); g.ui.tick(1 / 60); for (const s of g.students) { const k = s.entry && s.entry.kind; if (!k) continue; const a = acc[k] = acc[k] || { min: 9, max: -9, states: new Set() }; const y = s.group.position.y; a.min = Math.min(a.min, y); a.max = Math.max(a.max, y); a.states.add(s.state); } } for (const k in acc) acc[k].states = [...acc[k].states]; return acc; });
  console.log('entry heights', JSON.stringify(ys));
  const s1 = await snap(); console.log('wave1', JSON.stringify(s1));
  const kinds = new Set(s1.students.map(s => s[1]));
  await page.evaluate(() => { const g = window.__game; g.renderer.render(g.scene, g.camera); }); await page.screenshot({ path: 'siege-wave1.png' });
  await sim(4);
  const s2 = await snap(); console.log('wave1 settled', JSON.stringify(s2)); s2.students.forEach(s => kinds.add(s[1]));
  // shoot a lot: reserve must stay full
  await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 40; i++) { g.player.fireCd = 0; g.player.tryFire(); g.step(1 / 60); } });
  console.log('after 40 shots', JSON.stringify({ ammo: await page.evaluate(() => [window.__game.player.ammo, window.__game.player.reserve, document.getElementById('reserve').textContent]) }));
  // clear waves by knocking everyone out; watch the bosses
  const log = [];
  let erasers = 0;
  for (let round = 0; round < 400; round++) {
    const r = await page.evaluate(() => { const g = window.__game;
      g.students.forEach(s => { if (s.alive && s.state !== 'drop' && s.state !== 'rise') { s.hp = 1; s.hit(); } });
      for (const t of g.teachers) if (!t.defeated && t.state !== 'enter' && t.age === undefined) { /* nothing */ }
      let er = 0; for (let i = 0; i < 60; i++) { if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } g.step(1 / 60); g.ui.tick(1 / 60); er += g.darts.list.filter(d => d.kind === 'eraser' && !d.stuck && d.owner === 'teacher' && d.life > 3.95).length; }
      // bosses: once the boss has walked in, knock its weak points out over a few rounds
      const t = g.teachers.find(t => !t.defeated);
      if (t && g.teacherHitAt === undefined) g.teacherHitAt = g.wave;
      if (t && t.state !== 'enter') { const k = Object.keys(t.wp).find(k => t.wp[k].hp > 0); if (k) t.hitWeak(k); }
      return { wave: g.wave, state: g.state, teachers: g.teachers.map(t => [t.def.id, t.defeated]), alive: g.students.filter(s => s.alive).length, q: g.spawnQueue.length, er, title: document.getElementById('over-title').textContent };
    });
    erasers += r.er;
    if (r.teachers.length && (!log.length || log[log.length - 1].w !== r.wave || JSON.stringify(log[log.length - 1].t) !== JSON.stringify(r.teachers))) log.push({ w: r.wave, t: r.teachers, er: erasers });
    if (r.state !== 'playing') { console.log('end', JSON.stringify(r), 'rounds', round); break; }
  }
  console.log('boss log', JSON.stringify(log));
  console.log('entries seen', [...kinds].join(','), '| erasers-in-flight samples', erasers);
  await page.evaluate(() => { const g = window.__game; g.renderer.render(g.scene, g.camera); }); await page.screenshot({ path: 'siege-end.png' });
  console.log(JSON.stringify(await snap()));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
