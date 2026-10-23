const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (role) => {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(role + ' ' + m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push(role + ' pageerror: ' + e.message));
    await page.goto('http://localhost:8766/index.html?role=' + role + (process.env.MAP ? '&map=' + process.env.MAP : '') + (process.env.TEACHER ? '&teacher=' + process.env.TEACHER : ''), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); });
    return page;
  };
  const host = await mk('host'), guest = await mk('guest');
  let bytes = 0, msgs = 0;
  const relay = async () => {
    const h = await host.evaluate(() => window.__transport.drain());
    const g = await guest.evaluate(() => window.__transport.drain());
    for (const m of h) bytes += m.str.length; msgs += h.length;
    await guest.evaluate((list) => list.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h);
    await host.evaluate((list) => list.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), g);
  };
  const stepBoth = async (secs) => {
    const ticks = Math.round(secs * 10);
    for (let i = 0; i < ticks; i++) {
      await host.evaluate(() => { const g = window.__game; if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } for (let k = 0; k < 6; k++) { g.step(1 / 60); g.ui.tick(1 / 60); } });
      await relay();
      await guest.evaluate(() => { const g = window.__game; if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } for (let k = 0; k < 6; k++) { g.step(1 / 60); g.ui.tick(1 / 60); } });
      await relay();
    }
  };
  const snapOf = (page) => page.evaluate(() => { const g = window.__game; return { state: g.state, wave: g.wave, score: g.score, students: g.students.map(s => [s.id, +s.group.position.x.toFixed(1), +s.group.position.z.toFixed(1), s.texState, s.alive ? 1 : 0]), darts: g.darts.list.length, teacher: !!g.teacher, bully: g.bully ? [g.bully.di, g.bully.state] : null, ball: g.ball ? g.ball.mesh.position.toArray().map(v => +v.toFixed(1)) : null, monitor: g.monitor ? [+g.monitor.group.position.x.toFixed(1), g.monitor.state, g.monitor.strokes] : null, items: g.items.map(i => [i.id, i.buff.id, i.mi]), milks: g.milks.length, hud: { wave: document.getElementById('wave').textContent, score: document.getElementById('score').textContent, left: document.getElementById('left').textContent, hp: document.getElementById('hud-hp').textContent } }; });
  // host starts; the guest should flip to playing via the 'start' event
  await relay(); await host.click('#btn-start'); await relay();
  console.log('guest state after start:', await guest.evaluate(() => window.__game.state), '| host features:', await host.evaluate(() => JSON.stringify(window.__game.features)));
  await host.evaluate(() => { const g = window.__game; g.player.hurt = function () { this.hp = 5; }; });
  await stepBoth(8);
  const h1 = await snapOf(host), g1 = await snapOf(guest);
  console.log('HOST ', JSON.stringify(h1));
  console.log('GUEST', JSON.stringify(g1));
  // guest fires toward the first student
  await guest.evaluate(() => { const g = window.__game, p = g.player; const s = g.students[0]; if (!s) return; const t = s.group.position.clone().setY(0.8); p.pos.set(t.x, 0, t.z + 2.5); g.world.collideCircle(p.pos, 0.28); const from = p.eyePos(); const d = t.clone().sub(from); p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); p.update(1 / 60); p.fireCd = 0; p.tryFire(); });
  await relay();
  console.log('host darts by who:', await host.evaluate(() => JSON.stringify(window.__game.darts.list.map(d => d.who + '/' + d.owner))), '| host sees guest at', await host.evaluate(() => window.__game.remote.group.visible ? window.__game.remote.group.position.toArray().map(v => +v.toFixed(1)) : 'hidden'));
  await stepBoth(1);
  console.log('after guest shot: host score', await host.evaluate(() => window.__game.score), 'guest score hud', await guest.evaluate(() => document.getElementById('score').textContent), 'guest ammo', await guest.evaluate(() => window.__game.player.ammo));
  // fast-forward on host to the boss and knock a weak point off; guest should mirror
  for (let i = 0; i < 220; i++) { await host.evaluate(() => { const g = window.__game; g.students.forEach(s => { if (s.alive) { s.hp = 1; s.hit(); g.kills++; } }); }); await stepBoth(1); const t = await host.evaluate(() => !!window.__game.teacher); if (t) break; if (i % 40 === 39) console.log('  progress', i, await host.evaluate(() => JSON.stringify({ state: window.__game.state, wave: window.__game.wave, boss: window.__game.bossPhase, bt: window.__game.bossTimer }))); }
  console.log('reached', await host.evaluate(() => JSON.stringify({ teacher: !!window.__game.teacher, wave: window.__game.wave, state: window.__game.state })));
  await stepBoth(2);
  await host.evaluate(() => { const g = window.__game; if (g.teacher) for (let i = 0; i < 4; i++) g.teacher.hitWeak(Object.keys(g.teacher.wp)[0]); });
  await stepBoth(1);
  console.log('teacher host:', await host.evaluate(() => JSON.stringify(window.__game.teacher && { x: +window.__game.teacher.group.position.x.toFixed(1), kind: window.__game.teacher.def.id, wp: window.__game.teacher.wp[Object.keys(window.__game.teacher.wp)[0]].hp, fl: window.__game.teacher.flags })));
  console.log('teacher guest:', await guest.evaluate(() => JSON.stringify(window.__game.teacher && { x: +window.__game.teacher.group.position.x.toFixed(1), kind: window.__game.teacher.def.id, wp: window.__game.teacher.wp[Object.keys(window.__game.teacher.wp)[0]].hp, fl: window.__game.teacher.flags, hud: document.getElementById('hud-boss').textContent.replace(/\s+/g, ' ').trim().slice(0, 40), bosses: window.__game.teachers.length, bossOn: document.getElementById('hud-boss').className })));
  // win on host -> guest shows over screen
  await host.evaluate(() => { const g = window.__game; for (const t of g.teachers) for (const k of Object.keys(t.wp)) while (t.wp[k].hp > 0 && !t.defeated) t.hitWeak(k); });
  await stepBoth(1); await guest.waitForTimeout(3600);
  console.log('end states host/guest:', await host.evaluate(() => window.__game.state), await guest.evaluate(() => window.__game.state), 'guest over hidden:', await guest.evaluate(() => document.getElementById('over').hidden), await guest.evaluate(() => document.getElementById('over-title').textContent));
  // screenshot: guest looking at the host's figure
  await host.evaluate(() => { const g = window.__game; g.start(); }); await relay(); await stepBoth(6);
  await guest.evaluate(() => { const g = window.__game, p = g.player, h = g.hostFigure; p.pos.set(h.group.position.x + 0.3, 0, h.group.position.z + 2.6); g.world.collideCircle(p.pos, 0.28); const d = h.group.position.clone().setY(0.8).sub(p.eyePos()); p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); p.update(1 / 60); g.ui.msgTimer = 0; document.getElementById('msg').classList.remove('show'); g.renderer.render(g.scene, g.camera); });
  await guest.screenshot({ path: process.argv[2] + '/guest.png' });
  await host.evaluate(() => { const g = window.__game; g.renderer.render(g.scene, g.camera); });
  await host.screenshot({ path: process.argv[2] + '/host.png' });
  console.log('snapshot traffic: msgs', msgs, 'avg bytes', Math.round(bytes / Math.max(1, msgs)));
  console.log('ERRORS:', errors.join('\n') || 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
