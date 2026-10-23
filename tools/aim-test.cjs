// Crouched behind a desk, a kid's head visible over it: the dart must get there, not clip the desk
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?map=classroom', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const r = await page.evaluate(() => {
    const g = window.__game, V = g.player.pos.constructor; g.renderer.setAnimationLoop(null); g.start();
    g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = []; g.darts.clear();
    const out = {};
    // a bar the height of a desk top between the player and the kid; the player crouches behind it
    const run = (label, px, pz, kx, kz, crouch, aimY) => {
      g.students.forEach(s => s.dispose()); g.students = []; g.darts.clear();
      const S = g.students; const Student = Object.getPrototypeOf(g).constructor; // not exported: spawn via the game's door path instead
      g.spawnQueue = [{ door: { x: kx + 0.3, z: kz } }]; g.spawnTimer = 0; g.step(1 / 60); const s = g.students[0]; s.path = []; s.state = 'hide'; s.timer = 99; s.group.position.set(kx, 0, kz); s.crouch = 0; s.group.scale.y = 1;
      const p = g.player; p.pos.set(px, 0, pz); p.keys = crouch ? { ControlLeft: true } : {}; for (let i = 0; i < 40; i++) p.update(1 / 60);
      const eye = p.eyePos(), tgt = new V(kx, aimY, kz), d = tgt.clone().sub(eye);
      p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); p.update(1 / 60);
      const visible = !g.world.segmentBlocked(eye, tgt);
      p.ammo = 15; p.fireCd = 0; p.reloading = 0; const shots0 = p.shots; p.tryFire();
      const d0 = g.darts.list.find(d => d.owner === 'player'); const start = d0 ? [+d0.mesh.position.x.toFixed(2), +d0.mesh.position.y.toFixed(2), +d0.mesh.position.z.toFixed(2)] : null;
      const hp0 = s.hp; const trail = []; for (let i = 0; i < 60; i++) { g.step(1 / 60); const d = g.darts.list.find(x => x.owner === 'player'); if (d && i < 8) trail.push([+d.mesh.position.z.toFixed(2), +d.mesh.position.y.toFixed(2), d.stuck ? 's' : 'f']); }
      out[label] = { visible, eyeY: +eye.y.toFixed(2), fired: p.shots - shots0, start, hit: s.hp < hp0 || !s.alive, trail, left: g.darts.list.filter(d => d.owner === 'player').map(d => [+d.mesh.position.z.toFixed(2), +d.mesh.position.y.toFixed(2), d.stuck]) };
    };
    g.world.collide(0.9, 1.5, 1.2, 0.4, 0.72); // the bar, in the aisle between two desk columns
    run('crouched_behind_bar', 0.9, 3.0, 0.9, -0.5, true, 1.1);
    run('standing_behind_bar', 0.9, 3.0, 0.9, -0.5, false, 1.1);
    run('crouched_kid_left', 1.1, 3.0, 0.7, -0.5, true, 1.1); // the old muzzle sat 28 cm to the right of the eye
    return out;
  });
  console.log(JSON.stringify(r, null, 0)); console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
