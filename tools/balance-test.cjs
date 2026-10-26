const { chromium } = require('playwright'); const fs = require('fs');
const botSrc = fs.readFileSync(process.argv[2] + '/bot.js', 'utf8');
(async () => {
  const level = process.argv[3] || 'normal', runs = +(process.argv[4] || 3), jitter = +(process.argv[5] || 0.03);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?id=TEST&map=' + (process.env.MAP || 'classroom') + (process.env.TEACHER ? '&teacher=' + process.env.TEACHER : ''), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.5); window.__game.renderer.setAnimationLoop(null); });
  await page.click('#btn-start');
  const all = [];
  for (let i = 0; i < runs; i++) {
    const r = await page.evaluate(`(${botSrc})('${level}', 'classroom', 420, ${jitter})`);
    all.push(r);
    console.log(level, JSON.stringify({ result: r.result, reached: r.reached, hurts: r.hurts, acc: r.acc + '%', ammo: r.ammo, waves: r.waves.map(w => w.w + ':' + w.secs + 's/' + w.hurts + 'h/hp' + w.hp + '/a' + w.ammo).join(' ') }));
  }
  // per-wave averages
  const byWave = {}; for (const r of all) for (const w of r.waves) { if (!w.secs) continue; (byWave[w.w] = byWave[w.w] || []).push(w.secs); }
  console.log('avg secs per wave:', Object.entries(byWave).map(([w, a]) => w + ':' + Math.round(a.reduce((x, y) => x + y, 0) / a.length)).join(' '));
  console.log('ERRORS:', errors.join(' | ') || 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
