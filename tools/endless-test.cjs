// 無限下課: waves grow and get harder, a teacher after every fifth wave and the run goes on, milestone badges (5/10/…/30 with the exclusive one),
// stickers and the title, the result screen and the record, and a guest getting their own milestone reward
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } }); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?id=TEST&map=classroom', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const r = await page.evaluate(() => { const g = window.__game, out = {}; g.renderer.setAnimationLoop(null);
    localStorage.setItem('cnw-TEST:story', JSON.stringify({ stars: { mon: 1 } })); window.__progress.data = null;
    g.mode = 'endless'; g.mapChoice = 'classroom'; g.start(); g.player.hurt = function () {}; g.pause = () => {};
    out.start = { endless: g.endless, label: document.getElementById('wave').textContent, diff: [g.diff.maxShooters, g.diff.enemyHp] };
    const log = [], bosses = [], sizes = {}; let lastWave = 0, guard = 0;
    // play it on fast forward: every kid drops as soon as it is in, every teacher loses its weak points, upgrade cards take the first
    while (g.endlessCleared < 31 && g.state !== 'over' && guard++ < 40000) {
      if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); }
      if (g.wave !== lastWave) { lastWave = g.wave; sizes[g.wave] = g.waveCount; if ([1, 5, 9, 13, 21, 31].includes(g.wave)) log.push([g.wave, document.getElementById('wave').textContent, g.waveCount, g.diff.maxShooters, g.diff.enemyHp, +g.difficultySpread.toFixed(2), +g.diff.spawnGap.toFixed(2)]); }
      g.spawnTimer = 0; g.students.forEach(s => { if (s.alive) { s.hp = 1; g.lastShooter = 'host'; s.hit(); g.lastShooter = null; } });
      for (const t of g.teachers) if (!t.defeated && t.state !== 'enter') { if (!bosses.some(b => b[0] === g.wave)) bosses.push([g.wave, g.bossName, t.wpMax]); const k = Object.keys(t.wp).find(k => t.wp[k].hp > 0); if (k) t.hitWeak(k); }
      if (g.waveTimer > 0.3) g.waveTimer = 0.3; if (g.bossTimer > 0.3) g.bossTimer = 0.3; if (g.offerTimer > 0.05) g.offerTimer = 0.05;
      for (let k = 0; k < 6; k++) g.step(1 / 60);
    }
    out.waves = log; out.bosses = bosses; out.sizeW14 = sizes[14]; out.cleared = g.endlessCleared; out.guard = guard;
    const B = window.__badges.load().list; out.loot = g.endlessLoot; out.badgeTiers = B.filter(b => b.src === 'endless').map(b => [b.type === 'award' ? 'award' : 'x', b.tier]);
    out.stickers = ['endless10', 'endless20', 'endless30'].map(id => window.__ach.has(id)); out.awardFx = window.__badges.effects([B.find(b => b.type === 'award')]);
    // 2000 ordinary draws never give the exclusive one
    let aw = 0; for (let i = 0; i < 2000; i++) { const b = window.__badges.roll('exam', true, false); if (b.type === 'award') aw++; } out.awardFromRoll = aw;
    // now lose
    g.player.hurt = Object.getPrototypeOf(g.player).hurt; g.player.hp = 1; g.player.hurtCd = 0; g.player.invuln = 0; g.player.hurt();
    return out; });
  console.log(JSON.stringify(r));
  await page.waitForTimeout(400);
  const over = await page.evaluate(() => { const g = window.__game, rec = JSON.parse(localStorage.getItem('cnw-TEST:records')); return { state: g.state, title: document.getElementById('over-title').textContent, sub: document.getElementById('over-sub').textContent.slice(0, 60), stWave: document.getElementById('st-wave').textContent, drawn: g.drawnBadge && g.drawnBadge.tier, best: rec.best, recent: rec.recent[0], title2: window.__records.title() }; });
  console.log('over', JSON.stringify(over));
  await page.evaluate(() => { window.__game.toMenu(); document.getElementById('btn-records').click(); });
  console.log('home', JSON.stringify(await page.evaluate(() => ({ rank: document.getElementById('id-rank').textContent, recName: document.getElementById('rec-name').textContent, best: [...document.querySelectorAll('#rec-best .rec-row')].map(r => r.textContent), recent0: document.querySelector('#rec-recent .rec-row').textContent, modeBtn: !!document.querySelector('.seg-btn[data-mode="endless"]') }))));
  // co-op: the guest gets its own milestone badge
  const mk2 = async (q) => { const p = await browser.newPage({ viewport: { width: 800, height: 450 } }); p.on('pageerror', e => errors.push(q + ' ' + e.message)); await p.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.__game, null, { timeout: 30000 }); await p.evaluate(() => { window.__game.renderer.setAnimationLoop(null); }); return p; };
  const host = await mk2('role=host&mode=endless'), guest = await mk2('role=guest&slot=g1');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const gq = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), gq); };
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { await host.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); await guest.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); } };
  await relay(); await host.click('#btn-start'); await tick(5);
  const g0 = await guest.evaluate(() => ({ endless: window.__game.endless, label: document.getElementById('wave').textContent }));
  await host.evaluate(() => { const g = window.__game; g.endlessCleared = 5; g.endlessMilestone(5); }); await tick(2);
  const gm = await guest.evaluate(() => ({ cleared: window.__game.endlessCleared, loot: window.__game.endlessLoot, badges: window.__badges.load().list.length }));
  const hm = await host.evaluate(() => ({ loot: window.__game.endlessLoot.length, badges: window.__badges.load().list.length }));
  console.log('coop', JSON.stringify({ guestStart: g0, guest: gm, host: hm }));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
