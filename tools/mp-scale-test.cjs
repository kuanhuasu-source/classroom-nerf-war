// multiplayer scaling: with one guest the waves are bigger, more kids fire at once, spawns are quicker, the boss has more weak-point hp
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (q, role) => { const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); page.on('pageerror', e => errors.push(role + ' pageerror: ' + e.message)); await page.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 }); await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); }); return page; };
  // solo reference
  const solo = await mk('map=classroom', 'solo'); await solo.evaluate(() => { const g = window.__game; g.setDifficulty('exam'); g.start(); for (let i = 0; i < 60 * 5.5; i++) g.step(1 / 60); });
  const s1 = await solo.evaluate(() => { const g = window.__game; return { wave1: g.waveCount, gap: +(g.diff.spawnGap / (1 + 0)).toFixed(2), spread: +g.difficultySpread.toFixed(2), hp: g.students[0] && g.students[0].hp, extra: g.extraPlayers() }; });
  const host = await mk('role=host&map=classroom', 'host'), guest = await mk('role=guest&slot=g1', 'guest');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const g = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), g); };
  await relay(); await host.evaluate(() => window.__game.setDifficulty('exam')); await host.click('#btn-start'); await relay();
  await host.evaluate(() => { const g = window.__game; for (let i = 0; i < 60 * 5.5; i++) g.step(1 / 60); });
  const s2 = await host.evaluate(() => { const g = window.__game; return { wave1: g.waveCount, spread: +g.difficultySpread.toFixed(2), hp: g.students[0] && g.students[0].hp, extra: g.extraPlayers(), coop: g.coop }; });
  // boss weak-point hp and throw interval with one guest
  const boss = await host.evaluate(() => { const g = window.__game; g.students.forEach(s => { if (s.alive) { s.hp = 1; s.hit(); } }); g.spawnQueue = []; g.spawnTeacher(window.__bosses[0]); const t = g.teachers[0]; return { wpMax: t.wpMax, wpHp: Object.values(t.wp)[0].hp, kids: g.students.filter(s => s.alive).length }; });
  console.log('solo 會考 wave1', JSON.stringify(s1)); console.log('two players 會考 wave1', JSON.stringify(s2)); console.log('boss with guest', JSON.stringify(boss));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
