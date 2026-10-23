const { chromium } = require('playwright'); const fs = require('fs');
const bot = fs.readFileSync(process.argv[2] + '/coop-bot.js', 'utf8');
(async () => {
  const level = process.argv[3] || 'normal', runs = +(process.argv[4] || 2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mk = async (role) => { const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); page.on('pageerror', e => console.log(role, 'pageerror', e.message)); await page.goto('http://localhost:8766/index.html?role=' + role + '&map=classroom', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 }); await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.5); window.__game.renderer.setAnimationLoop(null); }); await page.evaluate(bot); await page.evaluate(() => { const g = window.__game, op = g.pause.bind(g); g.pause = function () { if (this.state === 'playing') console.log('PAUSE', new Error().stack.split('\n').slice(1, 4).join(' / ')); op(); }; }); page.on('console', m => { if (m.text().startsWith('PAUSE')) console.log(role, m.text()); }); return page; };
  const host = await mk('host'), guest = await mk('guest');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const g = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => window.__transport.receive(s)), h); await host.evaluate((l) => l.forEach(s => window.__transport.receive(s)), g); };
  for (let run = 0; run < runs; run++) {
    await host.evaluate((level) => { window.__game.setDifficulty(level); window.__game.start(); }, level); await relay();
    await host.evaluate(() => window.__bot.init('host')); await guest.evaluate(() => window.__bot.init('guest'));
    let hs, gs; const t0 = Date.now();
    for (let i = 0; i < 4200; i++) { // 420 s of game time, 0.1 s per iteration
      hs = await host.evaluate(() => window.__bot.tick(6)); await relay();
      gs = await guest.evaluate(() => window.__bot.tick(6)); await relay();
      if (hs.state === 'won' || hs.state === 'over') break;
    }
    console.log(level, JSON.stringify({ result: hs.state, reached: hs.teacher ? '老師' : 'w' + hs.wave, host: { hurts: hs.hurts, acc: hs.acc + '%', ammo: hs.ammo }, guest: { hurts: gs.hurts, acc: gs.acc + '%', ammo: gs.ammo }, waves: hs.waves.map(w => w.w + ':' + w.secs + 's/hp' + w.hp).join(' ') }), 'wall', Math.round((Date.now() - t0) / 1000) + 's');
  }
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
