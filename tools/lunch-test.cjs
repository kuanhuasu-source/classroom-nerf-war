// 午餐大作戰 over the fake link: drive out with scripted steering, load, swap, drive back as the guest, win with stars
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (q, role) => { const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); page.on('pageerror', e => errors.push(role + ' pageerror: ' + e.message)); await page.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 }); await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); }); return page; };
  const host = await mk('role=host&mode=lunch', 'host'), guest = await mk('role=guest&slot=g1', 'guest');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const g = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), g); };
  const H = (fn, a) => host.evaluate(fn, a), G = (fn, a) => guest.evaluate(fn, a);
  // a scripted shooter: whoever rides the cart fires at the nearest visible kid (host-side darts tagged with the shooter's slot)
  const shooterBot = () => { const g = window.__game, L = g.lunchMode; if (!L || g.state !== 'playing') return; window.__botT = (window.__botT || 0) + 0.1; if (window.__botT < 0.3) return; window.__botT = 0;
    const slot = L.shooterSlot(), from = L.cart.pose('shooter'); from.y += 1.2; const V = g.player.pos.constructor;
    let best = null, bd = 13; for (const k of L.kids) { if (!k.alive || !k.group.visible) continue; const to = new V(k.group.position.x, k.group.position.y + 0.8, k.group.position.z); const d = from.distanceTo(to); if (d < bd && !g.world.segmentBlocked(from, to)) { bd = d; best = to; } }
    if (!best) return; const dir = best.clone().sub(from); dir.y += bd * bd * 6 / (2 * 32 * 32); dir.normalize(); const d = g.darts.fire(from, dir, 32, 'player'); d.who = slot; window.__botShots = (window.__botShots || 0) + 1; };
  const tick = async () => { await H((fnText) => { const g = window.__game; eval(fnText)(); for (let k = 0; k < 6; k++) g.step(1 / 60); }, '(' + shooterBot.toString() + ')'); await relay(); await G(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); };
  const cartState = () => H(() => { const g = window.__game, L = g.lunchMode, c = L.cart; return { x: +c.pos.x.toFixed(2), z: +c.pos.z.toFixed(2), h: +c.heading.toFixed(2), v: +c.v.toFixed(2), loaded: c.loaded, soup: Math.round(c.soup), phase: L.phase, driver: L.driver, loadT: +L.loadT.toFixed(1), time: +L.timeLeft.toFixed(0), kids: L.kids.length, vis: L.kids.filter(k => k.group.visible && k.alive).length, grab: L.kids.filter(k => k.kind === 'grab').length, state: g.state }; });
  // scripted steering: whoever drives presses keys computed from the cart's heading error toward a waypoint
  const setKeys = async (who, keys) => { const fn = (keys) => { const g = window.__game; g.player.keys = {}; for (const k of keys) g.player.keys[k] = true; }; if (who === 'host') await H(fn, keys); else await G(fn, keys); };
  const driveTo = async (tx, tz, maxSec, stop = false) => {
    for (let i = 0; i < maxSec * 10; i++) {
      const c = await cartState(); if (c.state !== 'playing') return c;
      const dx = tx - c.x, dz = tz - c.z, dist = Math.hypot(dx, dz);
      if (dist < 1.0 && (!stop || Math.abs(c.v) < 0.15)) { await setKeys(c.driver, []); return c; }
      let err = Math.atan2(dz, dx) - c.h; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
      const keys = []; if (err > 0.08) keys.push('KeyD'); else if (err < -0.08) keys.push('KeyA');
      const braking = stop && dist < 2.5; if (braking) { if (c.v > 0.4) keys.push('KeyS'); } else if (Math.abs(err) < 1.1 || dist > 3) keys.push('KeyW');
      await setKeys(c.driver, keys); await tick();
    }
    return await cartState();
  };
  await relay(); await host.click('#btn-start'); await relay(); for (let i = 0; i < 10; i++) await tick();
  console.log('start host', JSON.stringify(await cartState()));
  console.log('start guest', JSON.stringify(await G(() => { const g = window.__game, L = g.lunchMode; return { map: g.world.layout.id, has: !!L, driver: L && L.driver, role: document.getElementById('wave').textContent, label: document.getElementById('wave').previousElementSibling.textContent, timer: document.getElementById('time').textContent, pos: [+g.player.pos.x.toFixed(1), +g.player.pos.y.toFixed(2), +g.player.pos.z.toFixed(1)], kids: L ? L.kids.length : -1 }; })));
  // both players never run out of hearts for the drive (we are testing the cart, not the aim)
  await H(() => { const g = window.__game; g.player.hurt = function () { this.hits0 = (this.hits0 || 0) + 1; }; for (const r of g.remoteList()) r.hurt = function () { this.hits0 = (this.hits0 || 0) + 1; }; });
  await H(() => { const g = window.__game, o = g.onSpill.bind(g); window.__spill = {}; g.onSpill = (n, why) => { window.__spill[why] = +((window.__spill[why] || 0) + n).toFixed(1); return o(n, why); }; });
  let enemyShots = 0; await H(() => { const g = window.__game; const o = g.darts.fire.bind(g.darts); g.darts.fire = (p, d, s, ow, k) => { if (ow === 'enemy') window.__enemyShots = (window.__enemyShots || 0) + 1; return o(p, d, s, ow, k); }; });
  // horn test on the way: driver presses F once near the first door
  await driveTo(-6, -11, 20); await H(() => window.__game.horn()); console.log('horn cd after press', await H(() => +window.__game.lunchMode.hornCd.toFixed(1)));
  let c = await driveTo(7, -11.2, 25); console.log('segment A end', JSON.stringify(c), '| enemy shots so far', await H(() => window.__enemyShots || 0));
  c = await driveTo(12, -9, 15); console.log('corner', JSON.stringify(c));
  c = await driveTo(12, 10.6, 30, true); console.log('kitchen arrive', JSON.stringify(c));
  for (let i = 0; i < 160; i++) { await setKeys('host', []); await tick(); const s = await cartState(); if (s.phase === 'back') { console.log('loaded after', (i / 10).toFixed(1), 's', JSON.stringify(s)); break; } if (i % 40 === 39) console.log('loading...', JSON.stringify(s)); }
  console.log('after swap: host reserve', await H(() => window.__game.player.reserve), '| guest reserve', await G(() => window.__game.player.reserve), '| guest role hud', await G(() => document.getElementById('wave').textContent), '| host role hud', await H(() => document.getElementById('wave').textContent));
  // the guest now drives back: through the corner, then along A to home
  c = await driveTo(12, -9.5, 40); console.log('back at corner', JSON.stringify(c));
  c = await driveTo(8.5, -11, 15); console.log('turned into A', JSON.stringify(c));
  c = await driveTo(-11.5, -11, 50); console.log('home', JSON.stringify(c));
  for (let i = 0; i < 30 && (await cartState()).state === 'playing'; i++) await tick();
  console.log('end', JSON.stringify(await H(() => { const g = window.__game; return { state: g.state, title: g.overInfo && g.overInfo.title, sub: g.overInfo && g.overInfo.sub, score: g.score, soupHud: document.getElementById('soup').textContent, stWave: document.getElementById('st-wave').textContent }; })), '| guest over', await G(() => [window.__game.state, window.__game.pendingOver && window.__game.pendingOver.title]));
  console.log('buckets knocked', await H(() => window.__game.world.buckets.map(b => b.knocked ? 1 : 0).join('')), '| guest buckets', await G(() => window.__game.world.buckets.map(b => b.knocked ? 1 : 0).join('')), '| hits taken host/guest', await H(() => [window.__game.player.hits0 || 0, window.__game.remoteList()[0].hits0 || 0]), '| enemy shots', await H(() => window.__enemyShots || 0), '| bot shots', await H(() => window.__botShots || 0), '| kills', await H(() => window.__game.lunchMode.kills), '| spill by cause', JSON.stringify(await H(() => window.__spill)));
  await H(() => { const g = window.__game; g.renderer.render(g.scene, g.camera); }); await host.screenshot({ path: 'lunch-host.png' }); await G(() => { const g = window.__game; g.renderer.render(g.scene, g.camera); }); await guest.screenshot({ path: 'lunch-guest.png' });
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
