// 對打 over the fake link (host + two guests): refused alone, everyone spread out with three hearts and no badges, darts hurt other players
// but not the shooter, a knockout scores and respawns far away, the scoreboard, first to eight wins for one player only, the clock, records
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (role, slot) => { const page = await browser.newPage({ viewport: { width: 800, height: 450 } }); page.on('pageerror', e => errors.push(role + (slot || '') + ' pageerror: ' + e.message));
    await page.goto('http://localhost:8766/index.html?role=' + role + (slot ? '&slot=' + slot : '') + '&map=classroom&mode=duel', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.5); window.__game.renderer.setAnimationLoop(null); }); return page; };
  // alone: no duel
  const solo = await mk('host'); await solo.click('#btn-start'); console.log('alone', JSON.stringify(await solo.evaluate(() => ({ state: window.__game.state, msg: document.getElementById('msg').textContent.slice(0, 20) })))); await solo.close();
  const host = await mk('host'); const guests = { g1: await mk('guest', 'g1'), g2: await mk('guest', 'g2') };
  // g1 wears a legendary heart badge: it must not count here
  await guests.g1.evaluate(() => { localStorage.setItem('cnw-:badges', JSON.stringify({ list: [{ id: 'g', type: 'hp', tier: 3, val: 2, ts: 1 }], worn: ['g'], seq: 1 })); window.__badges.data = null; window.__game.sendHello(); });
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain());
    for (const pg of Object.values(guests)) { await pg.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); const g = await pg.evaluate(() => window.__transport.drain()); await host.evaluate((l) => l.forEach(s => { window.__transport.receive(s.str, s.from); }), g); } };
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { await host.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); for (const pg of Object.values(guests)) await pg.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); } };
  await relay(); await relay(); await host.click('#btn-start'); await tick(8);
  const st = await host.evaluate(() => { const g = window.__game; const ps = g.players().map(p => [+p.pos.x.toFixed(1), +p.pos.z.toFixed(1)]); const dmin = Math.min(...ps.flatMap((a, i) => ps.slice(i + 1).map(b => Math.hypot(a[0] - b[0], a[1] - b[1])))); return { duel: g.duel, state: g.state, hp: g.players().map(p => [p.hp, p.maxHp]), minApart: +dmin.toFixed(1), kids: g.students.length, board: document.getElementById('hud-duel').textContent, label: document.getElementById('wave').textContent, time: document.getElementById('time').textContent, hostBadge: g.player.badge.hp }; });
  const gst = await guests.g1.evaluate(() => { const g = window.__game; return { duel: g.duel, hp: [g.player.hp, g.player.maxHp], badgeHp: g.player.badge.hp, board: document.getElementById('hud-duel').textContent, ring: g.hostFigure && g.hostFigure.ringMesh.material.color.getHexString(), time: document.getElementById('time').textContent }; });
  console.log('start', JSON.stringify({ host: st, g1: gst }));
  // the host shoots g1 three times (letting the flinch time pass): hearts go down, then a knockout, a point, a respawn far away
  const shoot = (who, target) => host.evaluate(({ who, target }) => { const g = window.__game, V = g.player.pos.constructor, t = target === 'host' ? g.player : g.remotes.get(target); const l = Math.hypot(t.pos.x, t.pos.z) || 1, ux = -t.pos.x / l, uz = -t.pos.z / l; const from = new V(t.pos.x + ux * 1.2, t.pos.y + 0.9, t.pos.z + uz * 1.2); const d = g.darts.fire(from, new V(-ux, 0, -uz), 30, 'player'); /* from the room's side of the target, so the dart does not start inside a wall */ d.who = who; d.volley = who + Math.random(); for (let i = 0; i < 8; i++) g.step(1 / 60); t.hurtCd = 0; return [t.hp, !!t.sitting]; }, { who, target });
  const h1 = await shoot('host', 'g1'), h2 = await shoot('host', 'g1'); const before = await host.evaluate(() => { const r = window.__game.remotes.get('g1'); return [+r.pos.x.toFixed(1), +r.pos.z.toFixed(1)]; });
  const h3 = await shoot('host', 'g1'); await tick(3);
  const ko = await host.evaluate(() => { const g = window.__game, r = g.remotes.get('g1'); return { score: g.duelScore, sitting: r.sitting, seat: r.seat && [+r.seat.x.toFixed(1), +r.seat.z.toFixed(1)], board: document.getElementById('hud-duel').textContent, combo: document.getElementById('combo').textContent }; });
  const gko = await guests.g1.evaluate(() => { const g = window.__game; return { sitting: g.player.sitting, pos: [+g.player.pos.x.toFixed(1), +g.player.pos.z.toFixed(1)], board: document.getElementById('hud-duel').textContent }; });
  await tick(34); const up = await guests.g1.evaluate(() => { const g = window.__game; return { sitting: g.player.sitting, hp: g.player.hp, pos: [+g.player.pos.x.toFixed(1), +g.player.pos.z.toFixed(1)] }; });
  console.log('knockout', JSON.stringify({ hits: [h1, h2, h3], before, ko, guest: gko, respawned: up }));
  // a dart never hurts its own shooter; g2 can hurt the host
  const self = await shoot('host', 'host'), byG2 = await shoot('g2', 'host'); console.log('self / by g2', JSON.stringify({ self, byG2 }));
  // g2 races to eight: only g2 wins
  await tick(20); /* let g1's respawn protection run out */ await host.evaluate(() => { const g = window.__game; g.duelScore.g2 = 7; });
  const race = [await shoot('g2', 'g1'), await shoot('g2', 'g1'), await shoot('g2', 'g1')]; console.log('race', JSON.stringify(race), JSON.stringify(await host.evaluate(() => { const g = window.__game, r = g.remotes.get('g1'); return { score: g.duelScore, state: g.state, r: [r.hp, r.sitting, +r.invuln.toFixed(2), +r.pos.x.toFixed(1), +r.pos.z.toFixed(1)] }; }))); await tick(4); await new Promise(r => setTimeout(r, 300)); await tick(2);
  const end = async (pg) => pg.evaluate(() => { const g = window.__game; return { state: g.state, title: document.getElementById('over-title').textContent, sub: document.getElementById('over-sub').textContent, over: !document.getElementById('over').hidden, sticker: window.__ach.has('duel_win'), recent: (window.__records.load().recent[0] || {}).mode + ':' + (window.__records.load().recent[0] || {}).win + ':' + (window.__records.load().recent[0] || {}).points }; });
  console.log('end host', JSON.stringify(await end(host))); console.log('end g1', JSON.stringify(await end(guests.g1))); console.log('end g2', JSON.stringify(await end(guests.g2)));
  // the clock: a fresh round, time runs out, the leader wins
  await host.evaluate(() => { const g = window.__game; g.toMenu(); }); for (const pg of Object.values(guests)) await pg.evaluate(() => window.__game.toMenu()); await relay();
  await host.evaluate(() => window.__game.start()); await tick(6); await host.evaluate(() => { const g = window.__game; g.duelScore.g1 = 3; g.duelScore.host = 1; g.timeLeft = 0.2; }); await tick(4);
  console.log('time up', JSON.stringify(await host.evaluate(() => ({ state: window.__game.state, title: document.getElementById('over-title').textContent }))), JSON.stringify(await guests.g1.evaluate(() => ({ state: window.__game.state, won: window.__records.load().recent[0].win }))));
  console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
