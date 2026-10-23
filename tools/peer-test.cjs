const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mk = async (name) => {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(name + ' ' + m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push(name + ' pageerror: ' + e.message));
    await page.goto('http://localhost:8766/index.html?peer=local', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); });
    return page;
  };
  const stat = (p) => p.evaluate(() => document.getElementById('lobby-status').textContent);
  const host = await mk('host');
  await host.click('#btn-host');
  await host.waitForFunction(() => document.getElementById('lobby-status').textContent.includes('房間開好了'), null, { timeout: 15000 });
  const code = await host.evaluate(() => document.getElementById('lobby-code').textContent);
  console.log('room code', code, '| host status:', await stat(host));
  let guest = await mk('guest');
  await guest.click('#btn-join-open'); await guest.fill('#join-code', code.toLowerCase()); await guest.click('#btn-join');
  await guest.waitForFunction(() => document.getElementById('lobby-status').textContent.includes('連上了'), null, { timeout: 20000 });
  await host.waitForFunction(() => !document.getElementById('btn-begin').hidden, null, { timeout: 10000 });
  console.log('guest status:', await stat(guest), '| host status:', await stat(host));
  await host.click('#btn-begin');
  await guest.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 10000 });
  console.log('guest state:', await guest.evaluate(() => window.__game.state), '| guest role:', await guest.evaluate(() => window.__game.role), '| host role:', await host.evaluate(() => window.__game.role));
  // run both for ~6 s of game time with real delivery in between
  for (let i = 0; i < 60; i++) {
    await host.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) { g.step(1 / 60); g.ui.tick(1 / 60); } });
    await guest.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) { g.step(1 / 60); g.ui.tick(1 / 60); } });
    await host.waitForTimeout(25);
  }
  const hs = await host.evaluate(() => JSON.stringify({ students: window.__game.students.map(s => [s.id, +s.group.position.x.toFixed(1), +s.group.position.z.toFixed(1)]), darts: window.__game.darts.list.length, guestSeen: window.__game.remote.group.visible }));
  const gs = await guest.evaluate(() => JSON.stringify({ students: window.__game.students.map(s => [s.id, +s.group.position.x.toFixed(1), +s.group.position.z.toFixed(1)]), darts: window.__game.darts.list.length, hostSeen: !!window.__game.hostFigure && window.__game.hostFigure.group.visible, hud: document.getElementById('left').textContent }));
  console.log('HOST ', hs); console.log('GUEST', gs);
  await guest.evaluate(() => { const g = window.__game, p = g.player; p.pitch = -0.3; p.update(1 / 60); p.fireCd = 0; p.tryFire(); });
  await host.waitForTimeout(300);
  console.log('host darts by who:', await host.evaluate(() => JSON.stringify(window.__game.darts.list.map(d => d.who + '/' + d.owner).filter(x => x.startsWith('guest')))));
  // disconnect and reconnect the guest with the same code
  await guest.close();
  await host.waitForFunction(() => document.getElementById('lobby-status').textContent.includes('斷線'), null, { timeout: 15000 });
  console.log('host after guest left:', await stat(host));
  guest = await mk('guest2');
  await guest.click('#btn-join-open'); await guest.fill('#join-code', code); await guest.click('#btn-join');
  await guest.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 20000 });
  console.log('reconnected guest state:', await guest.evaluate(() => window.__game.state), '| host status:', await stat(host));
  for (let i = 0; i < 20; i++) { await host.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); await guest.evaluate(() => { const g = window.__game; for (let k = 0; k < 6; k++) g.step(1 / 60); }); await host.waitForTimeout(25); }
  console.log('reconnected guest students:', await guest.evaluate(() => window.__game.students.length), '| host students:', await host.evaluate(() => window.__game.students.length));
  // host leaves -> guest gets the message
  await host.close();
  await guest.waitForFunction(() => document.getElementById('msg').textContent.includes('房主離開'), null, { timeout: 15000 }).then(() => console.log('guest saw host leave: yes')).catch(() => console.log('guest saw host leave: NO'));
  console.log('ERRORS:', errors.filter(e => !/favicon/.test(e)).join('\n') || 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
