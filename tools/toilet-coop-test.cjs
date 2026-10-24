// toilet mode over the fake link: guest gets the toilet, 3 hp, the countdown, and a wet event when water hits them
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (q, role) => { const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); page.on('pageerror', e => errors.push(role + ' pageerror: ' + e.message)); await page.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 }); await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); }); return page; };
  const host = await mk('role=host&mode=toilet', 'host'), guest = await mk('role=guest&slot=g1', 'guest');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const g = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), g); };
  const stepBoth = async (secs) => { for (let i = 0; i < Math.round(secs * 10); i++) { await host.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); await relay(); await guest.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); } };
  await relay(); await host.click('#btn-start'); await relay();
  await stepBoth(3);
  const G = (fn) => guest.evaluate(fn), H = (fn) => host.evaluate(fn);
  console.log('guest view', JSON.stringify(await G(() => { const g = window.__game; return { map: g.world.layout.id, hp: [g.player.hp, g.player.maxHp], timerHidden: document.getElementById('hud-time').hidden, time: document.getElementById('time').textContent, cleaners: g.students.filter(s => s.v && s.v.cleaner).length, label: document.getElementById('left').previousElementSibling.textContent }; })), '| host', JSON.stringify(await H(() => { const g = window.__game; return { time: +g.timeLeft.toFixed(0), remoteHp: g.remoteList().map(r => [r.hp, r.maxHp]) }; })));
  // host throws water at the guest's position
  // the guest walks away from the host first, so the water can only hit the guest
  await G(() => { const g = window.__game; g.player.pos.set(-0.5, 0, 3.0); g.player.update(1 / 60); });
  await stepBoth(1.5);
  console.log('positions', JSON.stringify(await H(() => { const g = window.__game, r = g.remoteList()[0]; return { remote: [+r.pos.x.toFixed(2), +r.pos.y.toFixed(2), +r.pos.z.toFixed(2), r.eye, r.sitting, r.offline], host: [+g.player.pos.x.toFixed(2), +g.player.pos.z.toFixed(2)], targets: g.activeTargets().length }; })));
  await H(() => { const g = window.__game, V = g.player.pos.constructor, r = g.remoteList()[0]; const from = new V(r.pos.x, r.pos.y + 0.9, r.pos.z + 0.6); g.darts.fire(from, new V(0, 0, -1), 3, 'enemy', 'water'); g.wetEvents = 0; const ne = g.netEvent.bind(g); g.netEvent = (e, to) => { if (e.t === 'wet') g.wetEvents++; return ne(e, to); }; });
  await stepBoth(1.5);
  console.log('after water: guest wet', await G(() => +window.__game.player.wet.toFixed(1)), '| overlay', await G(() => document.getElementById('wet').classList.contains('on')), '| host-side remote wet', await H(() => window.__game.remoteList()[0].wet), '| wet events sent', await H(() => window.__game.wetEvents), '| water darts left', await H(() => window.__game.darts.list.filter(d => d.kind === 'water').length));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
