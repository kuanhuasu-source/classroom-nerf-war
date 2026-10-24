// siege over the fake link: the guest gets the yard with gate/drains, the ∞ ammo HUD, the 1/10 wave label and the gang boss
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (q, role) => { const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); page.on('pageerror', e => errors.push(role + ' pageerror: ' + e.message)); await page.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 }); await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); }); return page; };
  const host = await mk('role=host&mode=siege', 'host'), guest = await mk('role=guest&slot=g1', 'guest');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const g = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), g); };
  const stepBoth = async (secs, hostExtra) => { for (let i = 0; i < Math.round(secs * 10); i++) { await host.evaluate((x) => { const g = window.__game; if (x) eval(x); for (let k = 0; k < 6; k++) { if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } g.step(1 / 60); } }, hostExtra || ''); await relay(); await guest.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); } };
  await relay(); await host.click('#btn-start'); await relay();
  await stepBoth(6);
  const G = (fn) => guest.evaluate(fn), H = (fn) => host.evaluate(fn);
  console.log('guest view', JSON.stringify(await G(() => { const g = window.__game; return { map: g.world.layout.id, siege: g.world.siege, drains: g.world.drains.length, reserveHud: document.getElementById('reserve').textContent, waveHud: document.getElementById('wave').textContent, students: g.students.length, bully: g.students.filter(s => s.v && s.v.bully).length }; })), '| host students', await H(() => window.__game.students.length));
  // push through to the wave-3 boss: host knocks everyone out each tick
  const kill = "g.students.forEach(s => { if (s.alive && s.state !== 'drop' && s.state !== 'rise') { s.hp = 1; s.hit(); } }); const t = g.teachers.find(t => !t.defeated); if (t && t.state !== 'enter') { const k = Object.keys(t.wp).find(k => t.wp[k].hp > 0); if (k) t.hitWeak(k); }";
  let seen = null, gone = false;
  for (let i = 0; i < 90 && !gone; i++) { await stepBoth(1, kill); const gt = await G(() => window.__game.teachers.map(t => [t.def.id, t.defeated])); const hw = await H(() => window.__game.wave); if (gt.length && !seen) seen = { wave: hw, guestTeachers: gt }; if (seen && !gt.length && hw > seen.wave) gone = true; }
  console.log('guest saw boss', JSON.stringify(seen), '| boss gone on guest after wave advanced:', gone, '| host wave', await H(() => window.__game.wave), '| guest wave hud', await G(() => document.getElementById('wave').textContent));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
