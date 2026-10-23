// Co-op round 2: starters, live upgrade panel (no pause, 10 s), per-player buffs, reconnect restore
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (role) => {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(role + ' ' + m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push(role + ' pageerror: ' + e.message));
    await page.goto('http://localhost:8766/index.html?role=' + role, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); });
    return page;
  };
  const host = await mk('host'), guest = await mk('guest');
  const relay = async () => {
    const h = await host.evaluate(() => window.__transport.drain()); const g = await guest.evaluate(() => window.__transport.drain());
    await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), g);
  };
  const H = (fn, a) => host.evaluate(fn, a), G = (fn, a) => guest.evaluate(fn, a);
  const stepBoth = async (secs) => { for (let i = 0; i < Math.round(secs * 10); i++) { await H(() => { const g = window.__game; for (let k = 0; k < 6; k++) { g.step(1 / 60); g.tickLiveOffer(1 / 60); g.ui.tick(1 / 60); } }); await relay(); await G(() => { const g = window.__game; for (let k = 0; k < 6; k++) { g.step(1 / 60); g.tickLiveOffer(1 / 60); g.ui.tick(1 / 60); } }); await relay(); } };
  await relay(); await host.click('#btn-start'); await relay(); await stepBoth(1);
  // 6. asymmetric starters
  console.log('starters host/guest:', JSON.stringify(await H(() => [window.__game.player.up.taken, window.__game.remote.up.taken, window.__game.player.magSize()])), JSON.stringify(await G(() => [window.__game.player.up.taken, window.__game.player.up.pickupMul, document.getElementById('hud-up').textContent.trim()])));
  // 1. live offer: no pause, both see cards, 10 s auto-pick
  await H(() => window.__game.openOffer()); await relay(); await stepBoth(0.2);
  console.log('offer open host/guest:', await H(() => [window.__game.state, window.__game.ui.offerOpen, !!(window.__game.offer && window.__game.offer.live), document.getElementById('upgrade').classList.contains('compact'), document.getElementById('upgrade-note').textContent]), await G(() => [window.__game.state, window.__game.ui.offerOpen, document.querySelectorAll('#upgrade-cards button').length]));
  // students keep moving while the panel is up
  const before = await H(() => window.__game.students.map(s => s.group.position.x + s.group.position.z).reduce((a, b) => a + b, 0));
  await stepBoth(5);
  const after = await H(() => window.__game.students.map(s => s.group.position.x + s.group.position.z).reduce((a, b) => a + b, 0));
  console.log('world kept moving during offer:', before !== after, '| note at 5s:', await H(() => document.getElementById('upgrade-note').textContent), '| guest note:', await G(() => document.getElementById('upgrade-note').textContent));
  await stepBoth(5.5);
  console.log('after 10 s: host', await H(() => [window.__game.ui.offerOpen, !!window.__game.offer, Object.keys(window.__game.player.up.taken).length, window.__game.state]), 'guest', await G(() => [window.__game.ui.offerOpen, Object.keys(window.__game.player.up.taken).length]), 'host sees guest picks:', await H(() => Object.keys(window.__game.remote.up.taken).length));
  // 5. per-player buffs: a guest dart hits an item -> only the guest gets the buff; double score per owner
  await H(() => { const g = window.__game; g.applyBuff({ id: 'double', name: '金色星星', effect: '分數加倍', dur: 10 }, 'guest'); g.score = 0; g.addScore(100, 'guest'); g.addScore(100, 'host'); }); await relay(); await stepBoth(0.2);
  console.log('buff host/remote:', await H(() => [window.__game.myBuff && window.__game.myBuff.id, window.__game.remoteBuff && window.__game.remoteBuff.id, window.__game.score, document.getElementById('hud-buff').hidden]), '| guest sees own buff:', await G(() => [window.__game.myBuff && window.__game.myBuff.id, document.getElementById('hud-buff').textContent.trim()]));
  await H(() => { const g = window.__game; g.applyBuff({ id: 'slow', name: '時鐘', effect: '慢動作', dur: 5 }, 'guest'); });
  console.log('slow shared:', await H(() => [window.__game.worldSlow(), window.__game.hasBuff('slow'), window.__game.hasBuff('slow', 'guest')]));
  await stepBoth(11);
  console.log('buffs expired:', await H(() => [window.__game.myBuff, window.__game.remoteBuff]), await G(() => [window.__game.myBuff, document.getElementById('hud-buff').hidden]));
  // 2. reconnect restore: host remembers the guest's upgrades/ammo/hp
  await H(() => { const g = window.__game; g.remote.up.taken = { magnet: 1, rapid: 1, heart: 1 }; g.remote.ammo = 7; g.remote.reserve = 33; g.remote.hp = 3; g.remote.maxHp = 6; g.onNet(JSON.stringify({ t: 'hello', pid: 'test-g1' }), 'g1'); }); await relay(); await stepBoth(0.3);
  console.log('guest after restore:', JSON.stringify(await G(() => { const p = window.__game.player; return [p.up.taken, p.ammo, p.reserve, p.hp, p.maxHp, p.up.fireMul, document.getElementById('hud-up').textContent.trim(), window.__game.state]; })));
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
