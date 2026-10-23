// Four kids in one room over the fake link: slots, roster, scaling, drawing each other, shouts, revives, per-slot buffs, offers, reconnect, a fifth is refused
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (role, slot) => {
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(role + slot + ' ' + m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push(role + slot + ' pageerror: ' + e.message));
    await page.goto('http://localhost:8766/index.html?role=' + role + (slot ? '&slot=' + slot : '') + '&map=hall', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.5); window.__game.renderer.setAnimationLoop(null); });
    return page;
  };
  const host = await mk('host'); const guests = { g1: await mk('guest', 'g1'), g2: await mk('guest', 'g2'), g3: await mk('guest', 'g3') };
  const relay = async () => {
    const h = await host.evaluate(() => window.__transport.drain());
    for (const [slot, pg] of Object.entries(guests)) {
      await pg.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h);
      const g = await pg.evaluate(() => window.__transport.drain());
      await host.evaluate((l) => l.forEach(s => { const t = window.__transport; t.receive(s.str, s.from); }), g);
    }
  };
  const stepAll = async (secs) => { for (let i = 0; i < Math.round(secs * 10); i++) { await host.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) { g.step(1 / 60); g.tickLiveOffer(1 / 60); g.ui.tick(1 / 60); } }); await relay(); for (const pg of Object.values(guests)) await pg.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) { g.step(1 / 60); g.tickLiveOffer(1 / 60); g.ui.tick(1 / 60); } }); await relay(); } };
  const H = (fn, a) => host.evaluate(fn, a), G = (slot, fn, a) => guests[slot].evaluate(fn, a);
  await relay(); await relay();
  console.log('slots:', await G('g1', () => window.__game.mySlot), await G('g2', () => window.__game.mySlot), await G('g3', () => window.__game.mySlot), '| roster:', await H(() => window.__game.lobbyNames()));
  // a fifth kid is refused
  await H(() => window.__game.onNet(JSON.stringify({ t: 'hello', pid: 'test-extra' }), 'extra'));
  console.log('fifth refused:', await H(() => window.__transport.drain().filter(m => m.to === 'extra').map(m => JSON.parse(m.str).t)));
  await host.click('#btn-start'); await relay(); await stepAll(2);
  console.log('coop:', await H(() => [window.__game.coop, window.__game.players().length, window.__game.waveCount, Object.keys(window.__game.stats)]), '| guests playing:', await G('g1', () => window.__game.state), await G('g2', () => window.__game.state), await G('g3', () => window.__game.state));
  console.log('starters:', await H(() => Object.keys(window.__game.player.up.taken)), await G('g1', () => Object.keys(window.__game.player.up.taken)), await G('g2', () => Object.keys(window.__game.player.up.taken)), await G('g3', () => Object.keys(window.__game.player.up.taken)));
  console.log('g1 sees:', await G('g1', () => [!!window.__game.hostFigure, [...window.__game.others.keys()], [...window.__game.others.values()].map(o => o.skin.name + ':' + o.group.visible)]));
  // guest darts carry their slot
  await G('g2', () => { const p = window.__game.player; p.yaw = 0; p.pitch = 0; p.tryFire(); }); await relay(); await stepAll(0.2);
  console.log('g2 dart who:', await H(() => window.__game.darts.list.filter(d => d.owner === 'player').map(d => d.who)));
  // shout from g2 reaches host, g1 and g3
  await G('g2', () => window.__game.emote(1)); await relay(); await stepAll(0.3);
  console.log('shout seen by host/g1/g3:', await H(() => !!window.__game.remoteBySlot('g2').bubble), await G('g1', () => !!window.__game.others.get('g2').bubble), await G('g3', () => !!window.__game.others.get('g2').bubble), '| g2 own bubble none:', await G('g2', () => document.getElementById('msg').textContent.includes('阿強')));
  // g1 goes down, g3 walks over and revives
  await H(() => { const g = window.__game, r1 = g.remoteBySlot('g1'); r1.hp = 1; r1.hurtCd = 0; r1.hurt(); });
  await relay(); await stepAll(0.3);
  const seat = await H(() => { const r = window.__game.remoteBySlot('g1'); return [r.sitting, +r.pos.x.toFixed(2), +r.pos.z.toFixed(2)]; });
  console.log('g1 down:', seat, '| g1 self sitting:', await G('g1', () => window.__game.player.sitting), '| g3 sees g1 sitting:', await G('g3', () => window.__game.others.get('g1').sitting));
  await G('g3', (s) => { const g = window.__game; g.player.pos.set(s[1] + 0.5, g.player.pos.y, s[2]); g.player.update(1 / 60); }, seat); await relay(); await stepAll(0.3);
  await G('g3', () => window.__game.tryRevive()); await relay(); await stepAll(0.3);
  console.log('after g3 revive: g1 sitting', await H(() => [window.__game.remoteBySlot('g1').sitting, window.__game.remoteBySlot('g1').hp, window.__game.stats.g3.revives]), '| g1 self:', await G('g1', () => [window.__game.player.sitting, window.__game.player.hp]));
  // a buff for g3 only
  await H(() => { const g = window.__game; g.applyBuff({ id: 'double', name: '金色星星', effect: '分數加倍', dur: 8 }, 'g3'); }); await relay(); await stepAll(0.2);
  console.log('buff g3 only:', await G('g3', () => window.__game.myBuff && window.__game.myBuff.id), await G('g1', () => window.__game.myBuff), await H(() => [window.__game.myBuff, Object.keys(window.__game.buffs)]));
  // offers go to everyone and close once all picked
  await H(() => window.__game.openOffer()); await relay(); await stepAll(0.2);
  console.log('offers open:', await H(() => Object.keys(window.__game.offer.picked)), await G('g1', () => window.__game.ui.offerOpen), await G('g2', () => window.__game.ui.offerOpen), await G('g3', () => window.__game.ui.offerOpen));
  for (const pg of [host, ...Object.values(guests)]) await pg.evaluate(() => { const b = document.querySelector('#upgrade-cards button'); if (b) window.__game.pickUpgrade(b.dataset.id); });
  await relay(); await stepAll(0.3);
  console.log('all picked -> closed:', await H(() => [window.__game.offer, Object.keys(window.__game.remoteBySlot('g2').up.taken)]));
  // g2 drops and comes back: same slot, upgrades restored
  await H(() => window.__game.onPeerClosed('g2')); await G('g2', () => { window.__game.player.up.taken = {}; });
  console.log('g2 offline:', await H(() => [window.__game.remoteBySlot('g2').offline, window.__game.players().length]));
  await H(() => window.__game.onNet(JSON.stringify({ t: 'hello', pid: 'test-g2' }), 'g2')); await relay(); await stepAll(0.3);
  console.log('g2 back:', await H(() => [window.__game.remoteBySlot('g2').offline, window.__game.players().length, window.__game.conns.get('g2')]), '| g2 restored:', await G('g2', () => [window.__game.mySlot, Object.keys(window.__game.player.up.taken), window.__game.state]));
  // everyone down ends the round with four columns of stats
  await H(() => { const g = window.__game; for (const r of g.remotes.values()) { r.hp = 1; r.hurtCd = 0; r.invuln = 0; r.hurt(); } g.player.hp = 1; g.player.hurtCd = 0; g.player.invuln = 0; g.player.hurt(); }); await relay(); await stepAll(0.3);
  console.log('over:', await H(() => [window.__game.state, document.getElementById('over-title').textContent, document.getElementById('st-kills').textContent]), '| g3 over:', await G('g3', () => [window.__game.state, document.getElementById('st-kills').textContent]));
  console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
