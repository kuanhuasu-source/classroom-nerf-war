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
  const stepBoth = async (secs) => { for (let i = 0; i < Math.round(secs * 10); i++) { await host.evaluate(() => { const g = window.__game; if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } for (let k = 0; k < 6; k++) { g.step(1 / 60); g.ui.tick(1 / 60); } }); await relay(); await guest.evaluate(() => { const g = window.__game; if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } for (let k = 0; k < 6; k++) { g.step(1 / 60); g.ui.tick(1 / 60); } }); await relay(); } };
  const H = (fn, a) => host.evaluate(fn, a), G = (fn, a) => guest.evaluate(fn, a);
  await relay(); await host.click('#btn-start'); await relay();
  await stepBoth(3);
  console.log('coop:', await H(() => window.__game.coop), '| wave1 count:', await H(() => window.__game.students.length + window.__game.spawnQueue.length), '| guest playing:', await G(() => window.__game.state));
  // 1. enemies target the closer player: put the guest near the door column and the host far away
  await G(() => { const g = window.__game; g.player.pos.set(2.6, 0, 0.5); g.player.update(1 / 60); });
  await H(() => { const g = window.__game; g.player.pos.set(-5, 0, 3.7); });
  await stepBoth(6);
  console.log('targets picked by students:', await H(() => JSON.stringify(window.__game.students.map(s => s.pickTarget() === window.__game.remote ? 'guest' : 'host'))), '| guest hp (host view):', await H(() => window.__game.remote.hp), '| guest hp (guest view):', await G(() => window.__game.player.hp));
  // 2. guest goes down -> sits; host walks over and presses E
  await H(() => { const g = window.__game; for (let i = 0; i < 6; i++) { g.remote.hurtCd = 0; g.remote.invuln = 0; g.remote.hurt(); } });
  await stepBoth(0.5);
  console.log('guest sitting? host view:', await H(() => JSON.stringify({ sit: window.__game.remote.sitting, seat: window.__game.remote.seat })), '| guest view:', await G(() => JSON.stringify({ sit: window.__game.player.sitting, pos: window.__game.player.pos.toArray().map(v => +v.toFixed(1)), gun: window.__game.player.gun.visible, hp: window.__game.player.hp })));
  await H(() => { const g = window.__game; g.player.pos.set(g.remote.pos.x + 0.6, 0, g.remote.pos.z); g.tryRevive(); });
  await stepBoth(0.5);
  console.log('after host revive: host view hp', await H(() => [window.__game.remote.hp, window.__game.remote.sitting]), '| guest view', await G(() => [window.__game.player.hp, window.__game.player.sitting, document.getElementById('hud-hp').textContent]), '| stats', await H(() => JSON.stringify(window.__game.stats.host)));
  // 3. host goes down, guest rescues
  await H(() => { const g = window.__game; for (let i = 0; i < 6; i++) { g.player.hurtCd = 0; g.player.invuln = 0; g.player.hurt(); } });
  await stepBoth(0.5);
  console.log('host down:', await H(() => JSON.stringify({ sit: window.__game.player.sitting, state: window.__game.state })), '| guest sees host sitting:', await G(() => window.__game.hostFigure.sitting));
  await G(() => { const g = window.__game, h = g.hostFigure.group.position; g.player.pos.set(h.x + 0.5, 0, h.z); g.player.update(1 / 60); });
  await stepBoth(0.3);
  await G(() => window.__game.tryRevive()); await relay(); await stepBoth(0.3);
  console.log('after guest revive: host', await H(() => [window.__game.player.hp, window.__game.player.sitting]), '| stats guest', await H(() => JSON.stringify(window.__game.stats.g1)));
  // 4. emotes both ways
  await G(() => window.__game.emote(1)); await relay(); await stepBoth(0.2);
  console.log('host sees guest emote bubble:', await H(() => !!window.__game.remote.bubble), '| msg:', await H(() => document.getElementById('msg').textContent));
  await H(() => window.__game.emote(3)); await stepBoth(0.3);
  console.log('guest sees host emote bubble:', await G(() => !!window.__game.hostFigure.bubble), '| msg:', await G(() => document.getElementById('msg').textContent));
  // 5. guest picks up darts and milk judged by host
  const resBefore = await G(() => window.__game.player.reserve);
  await H(() => { const g = window.__game; g.remote.setTarget(0.4, 0, 0.55); g.remote.group.position.set(0.4, 0, 0.55); g.darts.drop(g.remote.pos, 4); }); // an open aisle, not a chair
  await stepBoth(0.4);
  await H(() => { const g = window.__game; g.remote.hp = 3; g.spawnMilk(); const m = g.milks[g.milks.length - 1]; g.remote.clearHist(); g.remote.setTarget(m.mesh.position.x, 0, m.mesh.position.z + 0.3); g.remote.group.position.set(m.mesh.position.x, 0, m.mesh.position.z + 0.3); });
  await stepBoth(0.5);
  console.log('guest reserve', resBefore, '->', await G(() => window.__game.player.reserve), '| guest hp after milk:', await G(() => window.__game.player.hp), '| host remote hp:', await H(() => window.__game.remote.hp));
  // 6. both down -> over with stats on both screens
  await H(() => { const g = window.__game; g.player.invuln = 0; g.remote.invuln = 0; for (let i = 0; i < 6; i++) { g.player.hurtCd = 0; g.player.hurt(); g.remote.hurtCd = 0; g.remote.hurt(); } });
  await stepBoth(0.5); await guest.waitForTimeout(300);
  console.log('over host:', await H(() => [window.__game.state, document.getElementById('over-title').textContent, document.getElementById('st-kills').textContent]), '| over guest:', await G(() => [window.__game.state, document.getElementById('over').hidden, document.getElementById('over-title').textContent, document.getElementById('st-kills').textContent]));
  console.log('ERRORS:', errors.join('\n') || 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
