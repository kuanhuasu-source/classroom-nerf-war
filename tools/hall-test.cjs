const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8766/index.html?map=hall', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); window.__game.start(); });
  const E = (fn, a) => page.evaluate(fn, a);
  console.log('layout:', await E(() => [window.__game.world.layout.id, window.__game.world.room.w, window.__game.world.desks.length]));
  console.log('heights stage/balcony/stair-mid/floor/center-steps:', await E(() => { const w = window.__game.world; return [w.heightAt(0, -5.5), w.heightAt(0, 5.5), +w.heightAt(7.3, 2.0).toFixed(2), w.heightAt(0, 0), +w.heightAt(0, -3.6).toFixed(2)]; }));
  console.log('paths start->balcony / start->stage / start->upstairs door:', await E(() => { const w = window.__game.world, s = w.layout.start; return [w.path(s, { x: -1.4, z: 5.0 }).length, w.path(s, { x: 0, z: -5.0 }).length, w.path(s, { x: 7.2, z: 5.5 }).length]; }));
  // walking: up the right staircase, then into the balcony facade from the floor
  console.log('climb right stairs:', await E(() => { const w = window.__game.world, p = new (window.__game.player.pos.constructor)(7.3, 0, -0.6); for (let i = 0; i < 140; i++) w.walk(p, 0, 0.05, 0.28); return [+p.z.toFixed(2), +p.y.toFixed(2)]; }));
  console.log('push into facade from floor (should stay below z=4, y=0):', await E(() => { const w = window.__game.world, p = new (window.__game.player.pos.constructor)(0, 0, 3.0); for (let i = 0; i < 60; i++) w.walk(p, 0, 0.05, 0.28); return [+p.z.toFixed(2), +p.y.toFixed(2)]; }));
  console.log('walk off balcony edge (should stop at rail, y=2.6):', await E(() => { const w = window.__game.world, p = new (window.__game.player.pos.constructor)(0, 2.6, 5.0); for (let i = 0; i < 60; i++) w.walk(p, 0, -0.05, 0.28); return [+p.z.toFixed(2), +p.y.toFixed(2)]; }));
  console.log('stage via centre steps:', await E(() => { const w = window.__game.world, p = new (window.__game.player.pos.constructor)(0, 0, -2.9); for (let i = 0; i < 80; i++) w.walk(p, 0, -0.05, 0.28); return [+p.z.toFixed(2), +p.y.toFixed(2)]; }));
  // line of sight over the rail
  console.log('LOS floor->crouched kid behind rail blocked / standing kid visible:', await E(() => { const w = window.__game.world, V = window.__game.player.pos.constructor; return [w.segmentBlocked(new V(0, 1.25, 0), new V(2, 2.6 + 0.5, 4.6)), w.segmentBlocked(new V(0, 1.25, 0), new V(2, 2.6 + 1.1, 4.6))]; }));
  // darts: from the floor into the facade sticks there; from the balcony down to the floor lands on the floor
  console.log('darts:', await E(() => { const g = window.__game, V = g.player.pos.constructor; g.darts.clear();
    const a = g.darts.fire(new V(0, 1.0, 1.5), new V(0, 0, 1), 32, 'player'); const b = g.darts.fire(new V(0, 3.85, 4.3), new V(0, -0.35, -1).normalize(), 32, 'player');
    for (let i = 0; i < 120; i++) g.darts.update(1 / 60, () => false);
    return { facade: [a.stuck, +a.mesh.position.z.toFixed(2), +a.mesh.position.y.toFixed(2)], down: [b.stuck, +b.mesh.position.z.toFixed(2), +b.mesh.position.y.toFixed(2)] }; }));
  // let the round run: do students use both floors?
  const r = await E(() => { const g = window.__game; g.spawnQueue.length = 0; for (let i = 0; i < 60 * 25; i++) g.step(1 / 60); return { students: g.students.map(s => [s.state, +s.group.position.y.toFixed(1)]), upstairs: g.students.filter(s => s.group.position.y > 2).length, state: g.state }; });
  console.log('after 25 s:', JSON.stringify(r));
  // screenshots: from the start, and from the balcony
  await E(() => { const g = window.__game; const p = g.player; p.pos.set(-5.5, 0, 3.0); p.yaw = -0.6; p.pitch = 0.05; p.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'hall-floor.png' });
  await E(() => { const g = window.__game; const p = g.player; p.pos.set(3.5, 2.6, 5.6); p.yaw = 0.45; p.pitch = -0.25; p.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'hall-balcony.png' });
  await E(() => { const g = window.__game; const p = g.player; p.pos.set(0, 0.9, -4.6); p.yaw = Math.PI; p.pitch = 0.0; p.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'hall-stage.png' });
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
