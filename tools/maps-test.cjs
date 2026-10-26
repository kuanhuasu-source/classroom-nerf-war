const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const map of ['lab', 'music', 'classroom', 'hall', 'yard']) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://localhost:8766/index.html?id=TEST&map=' + map, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setPixelRatio(0.6); window.__game.renderer.setAnimationLoop(null); });
    await page.click('#btn-start');
    const r = await page.evaluate(() => {
      const g = window.__game; g.player.hurt = function () { this.hp = 5; };
      for (let i = 0; i < 60 * 16; i++) { if (g.state === 'upgrade') g.pickUpgrade(document.querySelector('#upgrade-cards button').dataset.id); g.step(1 / 60); }
      const L = g.world.layout;
      const stuckAtDoor = g.students.filter(s => s.alive && Math.abs(s.group.position.x - (L.doors[0].x - 0.3)) < 0.2).length;
      // can every desk cover point be reached from the start?
      let unreachable = []; for (const d of g.world.desks) { const tgt = { x: d.x, z: d.z + d.d / 2 + 0.4 }; const p = g.world.path({ x: L.start.x, z: L.start.z }, tgt); if (!p.length && Math.hypot(tgt.x - L.start.x, tgt.z - L.start.z) > 0.5) unreachable.push([d.x, +tgt.z.toFixed(1)]); }
      return { map: L.id, name: L.name, size: L.w + 'x' + L.d, boxes: g.world.boxes.length, desks: g.world.desks.length, students: g.students.map(s => s.state), stuckAtDoor, unreachable, bully: g.bully ? [+g.bully.group.position.x.toFixed(1), +g.bully.group.position.z.toFixed(1)] : null, ball: !!g.ball, monitor: !!g.monitor, boardStyle: g.world.boardStyle, msg: document.getElementById('msg').textContent.replace(/\s+/g, ' ') };
    });
    console.log(JSON.stringify(r));
    // screenshot from the player's start looking at the room
    await page.evaluate(() => { const g = window.__game, L = g.world.layout; g.player.pos.set(L.start.x, 0, L.start.z); g.player.yaw = -0.7; g.player.pitch = 0.05; g.player.update(1 / 60); g.ui.msgTimer = 0; document.getElementById('msg').classList.remove('show'); g.renderer.render(g.scene, g.camera); });
    await page.waitForTimeout(600); await page.screenshot({ path: process.argv[2] + '/map-' + map + '.png' });
    console.log('  errors:', errors.join(' | ') || 'none');
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
