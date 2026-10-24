// Names and looks: typed on the front page, carried to the host, drawn on everyone's screen; defaults when empty
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (role, slot, profile) => {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 520 } });
    if (profile) await ctx.addInitScript((p) => { localStorage.setItem('cnw-name', p.name); localStorage.setItem('cnw-look', p.look); }, profile);
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(role + (slot || '') + ' ' + e.message));
    await page.goto('http://localhost:8766/index.html?role=' + role + (slot ? '&slot=' + slot : '') + '&map=classroom', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.5); window.__game.renderer.setAnimationLoop(null); });
    return page;
  };
  const host = await mk('host', null, { name: '老師好', look: 'l7' });
  const guests = { g1: await mk('guest', 'g1', { name: '豆豆', look: 'l5' }), g2: await mk('guest', 'g2', null) };
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); for (const [slot, pg] of Object.entries(guests)) { await pg.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); const g = await pg.evaluate(() => window.__transport.drain()); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; t.receive(s.str, s.from); }), g); } };
  const step = async () => { await host.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); await relay(); for (const pg of Object.values(guests)) await pg.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); await relay(); };
  await relay(); await relay();
  console.log('roster:', await host.evaluate(() => window.__game.lobbyNames()), '| welcome names:', await guests.g1.evaluate(() => window.__game.mySkin().name), await guests.g2.evaluate(() => window.__game.mySkin().name));
  await host.click('#btn-start'); await relay(); for (let i = 0; i < 10; i++) await step();
  console.log('host sees:', await host.evaluate(() => [...window.__game.remotes.values()].map(r => [r.slot, r.skin.name, r.skin.v.shirt])));
  console.log('g2 sees host + g1:', await guests.g2.evaluate(() => [[window.__game.hostFigure.skin.name, window.__game.hostFigure.skin.v.shirt], [...window.__game.others.values()].map(o => [o.slot, o.skin.name, o.skin.v.shirt])]));
  console.log('g1 sees g2 default:', await guests.g1.evaluate(() => [...window.__game.others.values()].map(o => [o.slot, o.skin.name, o.skin.v.shirt])));
  await guests.g1.evaluate(() => window.__game.emote(1)); await relay(); await step();
  console.log('emote names host/g2:', await host.evaluate(() => document.getElementById('msg').textContent.slice(0, 8)), await guests.g2.evaluate(() => document.getElementById('msg').textContent.slice(0, 8)));
  await host.evaluate(() => { const g = window.__game; for (const r of g.remotes.values()) { r.hp = 1; r.hurtCd = 0; r.invuln = 0; r.hurt(); } g.player.hp = 1; g.player.hurtCd = 0; g.player.invuln = 0; g.player.hurt(); }); await relay(); await step();
  console.log('over stats:', await host.evaluate(() => document.getElementById('st-kills').textContent));
  // the front page: name box and look buttons exist on the real menu
  const menu = await browser.newPage({ viewport: { width: 1100, height: 700 } }); await menu.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' }); await menu.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await menu.fill('#my-name', '阿寶寶寶寶寶寶寶'); await menu.click('.look-btn[data-look="l6"]');
  console.log('menu:', await menu.evaluate(() => [document.querySelectorAll('.look-btn').length, document.getElementById('my-name').value, window.__game.profile, localStorage.getItem('cnw-look')]));
  await menu.screenshot({ path: 'menu-profile.png' });
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none'); await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
