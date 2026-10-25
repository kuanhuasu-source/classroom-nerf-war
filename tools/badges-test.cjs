// badges: a win draws one, the card flips and can be worn; worn badges change hp/mag/rate/multi/regen; merge; a guest's badge reaches the host
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?map=classroom', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('cnw-badges'); window.__badges.data = null; window.__game.renderer.setAnimationLoop(null); });
  // roll odds sanity
  console.log('odds sample', JSON.stringify(await page.evaluate(() => { const B = window.__badges; const out = {}; for (const lv of ['easy', 'exam']) { const c = [0, 0, 0, 0]; for (let i = 0; i < 2000; i++) { const b = B.roll(lv, true, false); c[b.tier]++; } out[lv] = c.map(n => Math.round(n / 20)); } let none = 0; for (let i = 0; i < 1000; i++) if (!B.roll('normal', false, false)) none++; out.lossNoDraw = Math.round(none / 10); return out; })));
  // win a quick round and see the draw card
  await page.evaluate(() => { const g = window.__game; g.setDifficulty('easy'); g.start(); g.player.hurt = function () {}; g.diff = { ...g.diff, waves: [2] };
    for (let i = 0; i < 400 && g.state === 'playing'; i++) { g.students.forEach(s => { if (s.alive) { s.hp = 1; s.hit(); } }); const t = g.teachers.find(t => !t.defeated); if (t && t.state !== 'enter') { const k = Object.keys(t.wp).find(k => t.wp[k].hp > 0); if (k) t.hitWeak(k); } for (let k = 0; k < 60; k++) { if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } g.step(1 / 60); } } });
  await page.waitForTimeout(3500);
  const d = await page.evaluate(() => { const g = window.__game; return { state: g.state, drawn: g.drawnBadge && [g.drawnBadge.type, g.drawnBadge.tier, g.drawnBadge.val], drawVisible: !document.getElementById('badge-draw').hidden, stored: window.__badges.load().list.length }; });
  console.log('after win', JSON.stringify(d));
  await page.click('#badge-card'); await page.waitForTimeout(700); await page.screenshot({ path: 'badge-draw.png' });
  console.log('card open', await page.evaluate(() => [document.getElementById('badge-card').classList.contains('open'), document.getElementById('btn-badge-wear').hidden, document.getElementById('badge-card-name').textContent]));
  await page.click('#btn-badge-wear');
  console.log('worn', JSON.stringify(await page.evaluate(() => window.__badges.worn().map(b => [b.type, b.tier]))));
  // deterministic effects: wear a legendary of each kind in turn and start a round
  const fx = await page.evaluate(() => { const g = window.__game, B = window.__badges; const out = {};
    const wearOnly = (type, tier, val) => { const d = B.load(); d.list = d.list.filter(b => b.src !== 'test'); d.worn = []; const b = { id: 'T' + type, type, tier, val, ts: Date.now(), src: 'test' }; d.list.push(b); d.worn = [b.id]; B.save(); };
    g.toMenu(); wearOnly('hp', 3, 2); g.start(); out.hp = [g.player.maxHp, g.player.hp, document.getElementById('hud-badge').textContent];
    g.toMenu(); wearOnly('mag', 3, 9); g.start(); out.mag = g.player.magSize();
    g.toMenu(); wearOnly('rate', 3, 0.22); g.start(); g.player.fireCd = 0; g.player.tryFire(); out.rate = +g.player.fireCd.toFixed(3);
    g.toMenu(); wearOnly('multi', 3, 2); g.start(); const n0 = g.darts.list.length; g.player.fireCd = 0; g.player.tryFire(); out.multi = [g.darts.list.length - n0, g.player.ammo];
    // a volley of three on one kid counts once; on two kids side by side it can count on each
    g.toMenu(); wearOnly('multi', 3, 2); g.start(); g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = [];
    { const S = g.students; const mk = (x, z) => { const q = g.spawnQueue; q.push({ door: { x: x + 0.3, z } }); g.spawnTimer = 0; g.step(1 / 60); const s = g.students[g.students.length - 1]; s.update = () => {}; s.group.position.set(x, 0, z); s.hp = 5; return s; };
      g.player.pos.set(0, 0, 4); g.player.yaw = 0; g.player.pitch = 0; g.player.update(1 / 60); const one = mk(0, 1.0); g.player.fireCd = 0; g.player.tryFire(); for (let i = 0; i < 40; i++) g.step(1 / 60);
      out.volleyOne = 5 - one.hp; }
    g.toMenu(); wearOnly('regenAmmo', 3, 12); g.start(); g.player.reserve = 10; for (let i = 0; i < 60 * 13; i++) g.player.update(1 / 60); out.regenAmmo = g.player.reserve;
    g.toMenu(); wearOnly('regenHp', 3, 20); g.start(); g.player.hp = 2; for (let i = 0; i < 60 * 21; i++) g.player.update(1 / 60); out.regenHp = g.player.hp;
    g.toMenu(); wearOnly('speed', 3, 0.12); g.start(); g.player.keys = { KeyW: true }; const a = g.player.pos.clone(); for (let i = 0; i < 60; i++) g.player.update(1 / 60); out.speed = +g.player.pos.distanceTo(a).toFixed(2); g.player.keys = {};
    // merge: three common hp badges become one 精良
    g.toMenu(); const d = B.load(); d.list = []; d.worn = []; for (let i = 0; i < 3; i++) d.list.push({ id: 'm' + i, type: 'hp', tier: 0, val: 1, ts: i, src: 'test' }); B.save(); out.merged = [B.merge(), B.load().list.map(b => [b.type, b.tier])];
    // cap: 41st badge drops the oldest lowest
    const d2 = B.load(); d2.list = []; for (let i = 0; i < 40; i++) d2.list.push({ id: 'c' + i, type: 'mag', tier: i === 0 ? 0 : 1, val: 2, ts: i, src: 'test' }); B.save(); const dropped = B.add(B.make(2, 'test')); out.cap = [B.load().list.length, dropped && dropped.id];
    return out; });
  console.log('effects', JSON.stringify(fx));
  // guest badge reaches the host over the fake link
  const host = await browser.newPage({ viewport: { width: 900, height: 500 } }), guest = await browser.newPage({ viewport: { width: 900, height: 500 } });
  for (const pg of [host, guest]) pg.on('pageerror', e => errors.push('link: ' + e.message));
  await guest.goto('http://localhost:8766/index.html?role=guest&slot=g1', { waitUntil: 'domcontentloaded' });
  await guest.evaluate(() => { localStorage.setItem('cnw-badges', JSON.stringify({ list: [{ id: 'g', type: 'hp', tier: 3, val: 2, ts: 1 }], worn: ['g'], seq: 1 })); location.reload(); });
  await guest.waitForFunction(() => window.__game, null, { timeout: 30000 }); await host.goto('http://localhost:8766/index.html?role=host&map=classroom', { waitUntil: 'networkidle' }); await host.waitForFunction(() => window.__game, null, { timeout: 30000 });
  for (const pg of [host, guest]) await pg.evaluate(() => window.__game.renderer.setAnimationLoop(null));
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const g = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), g); };
  await relay(); await host.click('#btn-start'); await relay();
  for (let i = 0; i < 5; i++) { await host.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); await guest.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); }
  console.log('guest badge on host', JSON.stringify(await host.evaluate(() => { const r = window.__game.remoteList()[0]; return { badge: r && r.badge, maxHp: r && r.maxHp, hp: r && r.hp }; })), '| guest own maxHp', await guest.evaluate(() => [window.__game.player.maxHp, window.__game.level]));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
