// Network smoothness: preview darts, interpolation buffer, split lanes, stale drop, stats + ping
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (role) => {
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(role + ' ' + m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push(role + ' pageerror: ' + e.message));
    await page.goto('http://localhost:8766/index.html?role=' + role + '&map=classroom', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.5); window.__game.renderer.setAnimationLoop(null); });
    return page;
  };
  const host = await mk('host'), guest = await mk('guest');
  let lanes = { fast: 0, ctl: 0, deltas: 0 };
  const relay = async (hold = null) => {
    const h = await host.evaluate(() => window.__transport.drain());
    for (const m of h) { if (m.fast) lanes.fast++; else lanes.ctl++; if (m.str.includes('"t":"delta"')) lanes.deltas++; }
    const deliver = hold ? h.filter(m => !hold(m)) : h;
    await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), deliver);
    const g = await guest.evaluate(() => window.__transport.drain());
    await host.evaluate((l) => l.forEach(s => { const t = window.__transport; t.receive(s.str, s.from); }), g);
    return h.filter(m => hold && hold(m));
  };
  const H = (fn, a) => host.evaluate(fn, a), G = (fn, a) => guest.evaluate(fn, a);
  const stepBoth = async (secs) => { for (let i = 0; i < Math.round(secs * 10); i++) { await H(() => { const g = window.__game; for (let k = 0; k < 6; k++) { g.step(1 / 60); g.ui.tick(1 / 60); } }); await relay(); await G(() => { const g = window.__game; for (let k = 0; k < 6; k++) { g.step(1 / 60); g.ui.tick(1 / 60); } }); await relay(); } };
  await relay(); await host.click('#btn-start'); await relay(); await stepBoth(1.5);
  // 1. preview dart: visible on the guest the moment the trigger is pulled, before any snapshot
  await G(() => { const p = window.__game.player; p.pos.set(-3, 0, 2.5); p.yaw = 0; p.pitch = 0; p.update(1 / 60); p.tryFire(); });
  console.log('preview at once:', await G(() => window.__game.darts.list.filter(d => d.preview).map(d => [d.who, d.preview, d.hostId, d.mesh.visible])));
  await relay(); await H(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); await relay(); await G(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); });
  console.log('host copy hidden behind preview:', await G(() => { const g = window.__game; const pre = g.darts.list.find(d => d.preview); const hostCopy = pre && g.darts.byId.get(pre.hostId); return [pre && pre.hostId > 0, hostCopy ? hostCopy.mesh.visible : 'none', hostCopy ? hostCopy.hiddenByPreview : null]; }), '| host dart pv:', await H(() => window.__game.darts.list.filter(d => d.owner === 'player').map(d => [d.who, d.pv])));
  await stepBoth(2.5);
  console.log('after landing: previews left', await G(() => window.__game.darts.list.filter(d => d.preview).length), '| resting visible copies:', await G(() => window.__game.darts.list.filter(d => d.stuck && d.owner === 'player' && d.mesh.visible).length), '| host resting:', await H(() => window.__game.darts.list.filter(d => d.stuck && d.owner === 'player').length));
  // 2. lanes: snapshots on the fast lane, deltas on the ordered lane only when needed
  console.log('lanes so far:', lanes);
  // 3. interpolation buffer: students on the guest keep stamped samples and the net clock is synced
  console.log('hist/clock:', await G(() => { const g = window.__game, s = g.students[0]; return [s ? (s.hist || []).length : 'no students', g.net.offset !== null, +g.net.delay.toFixed(0), g.net.lastSeq > 0]; }));
  // 4. a stale snapshot (older seq) is dropped, a message event still arrives through the delta lane
  const old = await G(() => { const g = window.__game; return g.net.lastSeq; });
  await G((seq) => { const g = window.__game; g.onNet(JSON.stringify({ t: 'snap', seq: seq - 3, ts: 1, st: 'playing', wave: 1, score: 0, kills: 0, boss: 0, left: 0, host: { x: 0, z: 0, yaw: 0, eye: 1.25, c: 0, hp: 5, sit: 0 }, pl: {}, students: [], tc: [], items: [], props: [], milks: [], dm: [] }), 'host'); }, old);
  console.log('stale dropped:', await G(() => [window.__game.net.stale, window.__game.pending.length]));
  await H(() => window.__game.message('測試訊息', '經由 delta', 1)); await relay(); await stepBoth(0.2);
  console.log('event via delta:', await G(() => document.getElementById('msg').textContent.includes('測試訊息')), '| deltas sent:', lanes.deltas);
  // 5. ping / pong and the panel
  await stepBoth(2.2);
  console.log('rtt measured:', await G(() => window.__game.net.rtt >= 0 && window.__game.net.rtt < 5000), '| host sees guest rtt:', await H(() => Object.keys(window.__game.net.peers)), '| panel:', await G(() => { const g = window.__game; g.net.tick(1.1); return g.net.guestText().slice(0, 30); }));
  console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
