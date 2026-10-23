const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?map=classroom&teacher=math', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  console.log(JSON.stringify(await page.evaluate(() => { const g = window.__game; g.renderer.setAnimationLoop(null); g.start(); g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = []; g.bossPhase = true; g.wave = 6; g.spawnTeacher(); g.player.hurt = () => {};
    const t = g.teachers[0]; for (let i = 0; i < 60 * 4; i++) g.step(1 / 60); // walked in
    const count = () => g.darts.list.filter(d => d.kind === 'eraser').length;
    g.darts.clear(); const out = {};
    const hitAt = (label) => { const key = Object.keys(t.wp).find(k => t.wp[k].hp > 0); const before = count(); t.hitWeak(key); const sp = t.special && t.special.kind; let frames = -1; for (let i = 0; i < 60 && frames < 0; i++) { g.step(1 / 60); if (count() > before) frames = i; } out[label] = { special: sp, thrownAfterMs: frames >= 0 ? Math.round(frames * 1000 / 60) : null, msg: document.getElementById('msg').textContent.slice(0, 12) }; };
    hitAt('firstHit');
    hitAt('secondHitRightAway'); // inside the 2.5 s cooldown: no second eraser
    for (let i = 0; i < 60 * 3; i++) g.step(1 / 60); g.darts.clear();
    hitAt('hitAfterCooldown');
    return out; })));
  console.log('ERRORS:', errors.length ? errors : 'none'); await browser.close();
})();
