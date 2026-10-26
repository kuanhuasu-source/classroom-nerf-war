// story lunch chapter: how dangerous is the ride back for the shooter? real damage, scripted shooter at a given fire interval (0 = never shoots)
const { chromium } = require('playwright');
const runs = +process.argv[2] || 3, fireEvery = process.argv[3] === undefined ? 0.3 : +process.argv[3];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?id=TEST', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('cnw-TEST:badges'); window.__badges.data = null; window.__game.renderer.setPixelRatio(0.5); window.__game.renderer.setAnimationLoop(null); });
  const out = [];
  for (let r = 0; r < runs; r++) {
    const res = await page.evaluate((fireEvery) => { const g = window.__game; g.pause = () => {}; if (g.state === 'paused') g.resume();
      g.startStory({ id: 'thu', day: '星期四', weather: '☀️', title: '午餐大作戰', mode: 'lunch', level: 'normal', diary: [''], goal: '', hints: {}, end: 'ok' });
      const L = g.lunchMode, c = L.cart, V = g.player.pos.constructor; let enemyShots = 0, hits = 0, downs = 0; const o = g.darts.fire.bind(g.darts); g.darts.fire = (p, d, s, ow, k) => { if (ow === 'enemy' && L.phase === 'back') enemyShots++; return o(p, d, s, ow, k); };
      const oh = g.player.hurt.bind(g.player); g.player.hurt = function () { const hp = this.hp; oh(); if (this.hp < hp && L.phase === 'back') hits++; };
      const osd = g.player.sitDown.bind(g.player); g.player.sitDown = function (s, secs) { if (L.phase === 'back') downs++; osd(s, secs); };
      const steer = (tx, tz, stop) => { const dx = tx - c.pos.x, dz = tz - c.pos.z, dist = Math.hypot(dx, dz); let err = Math.atan2(dz, dx) - c.heading; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI; g.player.keys = {}; if (err > 0.08) g.player.keys.KeyD = true; else if (err < -0.08) g.player.keys.KeyA = true; if (stop && dist < 3) { if (c.v > 0.4) g.player.keys.KeyS = true; } else if (Math.abs(err) < 1.1) g.player.keys.KeyW = true; return dist; };
      const route = [[7, -11.2], [12, -9.2], [12, 10.6]]; let wp = 0, t = 0;
      while (t < 60 && L.phase === 'out') { const last = wp === route.length - 1, d = steer(route[wp][0], route[wp][1], last); if (d < 1.3 && (!last || Math.abs(c.v) < 0.3)) { wp++; if (wp >= route.length) { g.player.keys = {}; break; } } for (let k = 0; k < 6; k++) g.step(1 / 60); t += 0.1; }
      g.player.keys = {}; while (t < 90 && L.phase === 'out' && g.state === 'playing') { for (let k = 0; k < 6; k++) g.step(1 / 60); t += 0.1; }
      const hpAtSwap = g.player.hp, tSwap = t; let st = 0, kidsVisibleMax = 0;
      while (t < 220 && g.state === 'playing') { st += 0.1; if (fireEvery && st >= fireEvery) { st = 0; const from = c.pose('shooter'); from.y += 1.2; let best = null, bd = 12; for (const k of L.kids) { if (!k.alive || !k.group.visible) continue; const to = new V(k.group.position.x, k.group.position.y + 0.8, k.group.position.z); const d = from.distanceTo(to); if (d < bd && !g.world.segmentBlocked(from, to)) { bd = d; best = to; } } if (best) { const dir = best.clone().sub(from); dir.y += bd * bd * 6 / 2048; dir.normalize(); const d = g.darts.fire(from, dir, 32, 'player'); d.who = 'host'; } }
        kidsVisibleMax = Math.max(kidsVisibleMax, L.kids.filter(k => k.alive && k.group.visible && k.kind === 'door' && k.state === 'throw').length);
        for (let k = 0; k < 6; k++) g.step(1 / 60); t += 0.1; }
      return { state: g.state, title: g.overInfo && g.overInfo.title, soup: Math.round(c.soup), stars: g.storyStars, tSwap: +tSwap.toFixed(0), tBack: +(t - tSwap).toFixed(0), hpAtSwap, enemyShots, hits, downs, kills: L.kills, throwersMax: kidsVisibleMax }; }, fireEvery);
    out.push(res); console.log(JSON.stringify(res));
    await page.evaluate(() => { window.__game.toMenu(); });
  }
  console.log('ERRORS:', errors.length ? errors.slice(0, 3) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
