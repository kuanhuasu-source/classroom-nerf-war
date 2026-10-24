const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8766/index.html?map=yard', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); window.__game.start(); });
  const E = (fn, a) => page.evaluate(fn, a);
  console.log('layout:', await E(() => [window.__game.world.layout.id, window.__game.world.desks.length, window.__game.world.boxes.length, window.__game.world.animated.length]));
  console.log('heights tower/steps-mid/slide-mid/flag/ground:', await E(() => { const w = window.__game.world; return [w.heightAt(-4, -2), +w.heightAt(-5.3, -2).toFixed(2), +w.heightAt(-1.8, -2).toFixed(2), w.heightAt(7.5, -6.3), w.heightAt(0, 0)]; }));
  console.log('paths start->tower / start->flag / start->far gate:', await E(() => { const w = window.__game.world, s = w.layout.start; return [w.path(s, { x: -4, z: -2 }).length, w.path(s, { x: 7.5, z: -6.3 }).length, w.path(s, { x: 9.2, z: -3.5 }).length]; }));
  console.log('climb the steps, then down the slide:', await E(() => { const w = window.__game.world, p = new (window.__game.player.pos.constructor)(-6.2, 0, -2); for (let i = 0; i < 60; i++) w.walk(p, 0.05, 0, 0.28); const top = [+p.x.toFixed(2), +p.y.toFixed(2)]; for (let i = 0; i < 100; i++) w.walk(p, 0.05, 0, 0.28); return { top, bottom: [+p.x.toFixed(2), +p.y.toFixed(2)] }; }));
  console.log('pond blocks walking:', await E(() => { const w = window.__game.world, p = new (window.__game.player.pos.constructor)(0.5, 0, 6.0); for (let i = 0; i < 80; i++) w.walk(p, 0, -0.05, 0.28); return [+p.z.toFixed(2), w.free(...Object.values(w.cellOf(0.5, 3.5)))]; }));
  console.log('tower edge is a drop (stays on top):', await E(() => { const w = window.__game.world, p = new (window.__game.player.pos.constructor)(-4, 1.6, -2); for (let i = 0; i < 40; i++) w.walk(p, 0, 0.05, 0.28); return [+p.z.toFixed(2), +p.y.toFixed(2)]; }));
  const r = await E(() => { const g = window.__game; for (let i = 0; i < 60 * 25; i++) g.step(1 / 60); return { students: g.students.map(s => [s.state, +s.group.position.y.toFixed(1)]), state: g.state, sky: '#' + g.scene.background.getHexString() }; });
  console.log('after 25 s:', JSON.stringify(r));
  // the chocolate before the boss
  console.log('choco:', await E(() => new Promise(res => { const g = window.__game; g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = []; g.wave = 6; g.player.hp = 1; g.player.reserve = 30; g.startBoss(); setTimeout(() => res([g.player.hp, g.player.reserve, document.getElementById('msg').textContent.slice(0, 14)]), 1700); })));
  await E(() => { const g = window.__game; const p = g.player; p.pos.set(-8.4, 0, 5.0); p.yaw = -0.9; p.pitch = 0.04; p.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'yard-start.png' });
  await E(() => { const g = window.__game; const p = g.player; p.pos.set(-4, 1.6, -2); p.yaw = -2.2; p.pitch = -0.25; p.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'yard-tower.png' });
  await E(() => { const g = window.__game; const p = g.player; p.pos.set(3.5, 0, 7.2); p.yaw = 0.3; p.pitch = 0.0; p.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'yard-pond.png' });
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
