const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { const n = document.getElementById('news'); if (n) n.hidden = true; }); // the what's-new card would sit over the menu buttons
  await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); });
  const ev = (fn, a) => page.evaluate(fn, a);
  const sim = (secs) => ev((secs) => { const g = window.__game; for (let i = 0; i < secs * 60; i++) { g.step(1 / 60); g.ui.tick(1 / 60); } }, secs);
  await page.click('#btn-start');
  for (const id of ['math', 'pe', 'music', 'science']) {
    await ev((id) => { const g = window.__game; g.start(); g.player.hurt = function () { this.hp = 5; window.__hurts = (window.__hurts || 0) + 1; }; window.__hurts = 0; g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = []; g.bossPhase = true; g.wave = 4; g.nextWavePending = false; g.player.pos.set(0.3, 0, 1.4); g.player.yaw = 0; g.player.pitch = 0.05; g.spawnTeacher(window.__teachers.find(t => t.id === id)); window.__kinds = {}; const of = g.darts.fire.bind(g.darts); g.darts.fire = (p, d, s, o, k) => { if (o === 'teacher') window.__kinds[k] = (window.__kinds[k] || 0) + 1; return of(p, d, s, o, k); }; }, id);
    await sim(3);
    await ev(() => { const g = window.__game; g.player.update(1 / 60); g.ui.msgTimer = 0; document.getElementById('msg').classList.remove('show'); g.renderer.render(g.scene, g.camera); });
    await page.screenshot({ path: process.argv[2] + '/teacher-' + id + '.png' });
    await sim(22);
    const r = await ev(() => { const g = window.__game, t = g.teacher; return { kind: t.def.id, pos: t.group.position.toArray().map(v => +v.toFixed(1)), kinds: window.__kinds, hurts: window.__hurts, zones: g.zones.length, special: t.special ? t.special.kind + '/' + t.special.phase : null, hud: [1, 2, 3].map(i => (document.querySelectorAll('#hud-boss .sticker')[i - 1] || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim()), left: document.getElementById('left').textContent }; });
    console.log(JSON.stringify(r));
    // knock out the items one by one and watch the behaviour flags; then win
    await ev(() => { const g = window.__game, t = g.teacher, ks = Object.keys(t.wp); for (let i = 0; i < 3; i++) t.hitWeak(ks[0]); });
    await sim(8);
    const after = await ev(() => { const g = window.__game, t = g.teacher; return { lostFirst: !t.flags[Object.keys(t.wp)[0]], speed: +t.moveSpeed().toFixed(2), kinds: window.__kinds, state: g.state }; });
    await ev(() => { const g = window.__game, t = g.teacher, ks = Object.keys(t.wp); for (const k of ks.slice(1)) for (let i = 0; i < 3; i++) t.hitWeak(k); });
    await sim(0.5);
    console.log('  after first item lost', JSON.stringify(after), '| final state', await ev(() => window.__game.state), await ev(() => document.getElementById('msg').textContent.replace(/\s+/g, ' ')));
    await page.waitForTimeout(3400); await ev(() => { document.getElementById('over').hidden = true; });
  }
  console.log('ERRORS:', errors.join('\n') || 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
