// Badge balance: the solo balance bot plays the same map and difficulty with and without worn badges.
// usage: node tools/badge-balance-test.cjs <botdir> <runs> "<map>:<level>:<mode>:<badges>" ...   badges = none | type@tier[,type@tier]
const { chromium } = require('playwright'); const fs = require('fs');
const botSrc = fs.readFileSync(process.argv[2] + '/bot.js', 'utf8');
const VALS = { hp: [1, 1, 2, 2], mag: [2, 4, 6, 9], rate: [0.06, 0.1, 0.15, 0.22], multi: [0, 0, 1, 2], regenHp: [0, 40, 30, 20], regenAmmo: [0, 25, 18, 12], speed: [0, 0.05, 0.08, 0.12] };
(async () => {
  const runs = +(process.argv[3] || 2), configs = process.argv.slice(4);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?map=classroom', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.5); window.__game.renderer.setAnimationLoop(null); });
  for (const cfg of configs) {
    const [map, level, mode, badges] = cfg.split(':');
    const worn = badges === 'none' ? [] : badges.split(',').map((b, i) => { const [type, tier] = b.split('@'); return { id: 'bb' + i, type, tier: +tier, val: VALS[type][+tier], ts: i }; });
    await page.evaluate(({ worn, mode }) => { const g = window.__game; if (g.state !== 'menu') g.toMenu(); localStorage.setItem('cnw-badges', JSON.stringify({ list: worn, worn: worn.map(b => b.id), seq: 9 })); window.__badges.data = null; g.mode = mode || 'class'; g.forceTeacher = null; }, { worn, mode });
    const all = [];
    for (let i = 0; i < runs; i++) {
      const r = await page.evaluate(`(${botSrc})('${level}', '${map}', 420, 0.03)`);
      all.push(r);
      await page.evaluate(() => { const g = window.__game; if (g.state !== 'menu') g.toMenu(); });
    }
    const wins = all.filter(r => r.result === 'won').length, secs = all.map(r => r.waves.reduce((a, w) => a + (w.secs || 0), 0));
    console.log(cfg.padEnd(40), `win ${wins}/${runs}`, '| reached', all.map(r => r.reached).join(','), '| hurts', all.map(r => r.hurts).join(','), '| acc', all.map(r => r.acc + '%').join(','), '| kills', all.map(r => r.kills).join(','), '| secs', secs.join(','));
  }
  console.log('ERRORS:', errors.join(' | ') || 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
