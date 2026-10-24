// Touch help: magnet + friction near a kid, bigger hit circle for a touch shooter, extra heart, kinder enemies, gyro, roster icon
const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const run = async (ctxOpts, label) => {
    const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); page.on('pageerror', e => errors.push(label + ' ' + e.message));
    await page.goto('http://localhost:8766/index.html?map=classroom', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    const r = await page.evaluate(() => {
      const g = window.__game, V = g.player.pos.constructor; g.renderer.setAnimationLoop(null); g.start(); g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = [];
      const out = { touch: g.touch, maxHp: g.player.maxHp, hp: g.player.hp };
      // a kid 5 m ahead, crosshair 4 degrees to the right of her head
      g.spawnQueue = [{ door: { x: 1.2, z: -2.0 } }]; g.spawnTimer = 0; g.step(1 / 60); const s = g.students[0]; s.path = []; s.state = 'hide'; s.timer = 99; s.group.position.set(0.9, 0, -2.0); s.crouch = 0; s.group.scale.y = 1;
      const p = g.player; p.pos.set(0.9, 0, 3.0); p.keys = {}; p.update(1 / 60);
      const eye = p.eyePos(), head = new V(0.9, 0.95, -2.0), d = head.clone().sub(eye); const yawTo = Math.atan2(-d.x, -d.z), pitchTo = Math.atan2(d.y, Math.hypot(d.x, d.z));
      p.yaw = yawTo + 0.07; p.pitch = pitchTo; p.update(1 / 60);
      const yaw0 = p.yaw; for (let i = 0; i < 30; i++) g.step(1 / 60);
      out.magnet = { offBefore: +(yaw0 - yawTo).toFixed(3), offAfter: +(p.yaw - yawTo).toFixed(3), friction: g.aimFriction };
      // hit circle: aim 0.42 m beside the kid's centre at 5 m; a desktop dart misses, a touch dart (×1.3 = 0.47) hits
      p.yaw = Math.atan2(-(0.9 + 0.40 - eye.x), -(-2.0 - eye.z)); p.pitch = Math.atan2(0.8 - eye.y, 5); p.update(1 / 60);
      const hp0 = s.hp; p.ammo = 15; p.fireCd = 0; p.tryFire(); g.touch = false; g.aimFriction = 1; // freeze the magnet while the dart flies
      for (let i = 0; i < 40; i++) { g.darts.update(1 / 60, (d, prev) => g.dartHook ? g.dartHook(d, prev) : false); }
      out.wideHit = null; // computed below through the real hook path instead
      return out;
    });
    // the hit-circle check through the real step (the magnet is disabled by moving the crosshair far after firing)
    const r2 = await page.evaluate(() => {
      const g = window.__game, V = g.player.pos.constructor, p = g.player, s = g.students[0]; g.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ? g.touchCtl.on : false;
      s.hp = 3; s.state = 'hide'; s.timer = 99; s.group.position.set(0.9, 0, -2.0); g.darts.clear();
      const eye = p.eyePos(); p.yaw = Math.atan2(-(0.9 + 0.40 - eye.x), -(-2.0 - eye.z)); p.pitch = Math.atan2(0.8 - eye.y, 5); p.update(1 / 60);
      const hp0 = s.hp; p.ammo = 15; p.fireCd = 0; p.tryFire();
      for (let i = 0; i < 40; i++) g.step(1 / 60);
      // enemy spread multiplier through fireAt
      let spreadSeen = null; const of = g.darts.fire.bind(g.darts); g.darts.fire = (pos, dir, sp, o, k) => { spreadSeen = sp; return of(pos, dir, sp, o, k); }; s.state = 'shoot'; s.shotsLeft = 1; s.shotTimer = 0; s.shotsFired = 1; s.fireAt(p); g.darts.fire = of;
      return { hitAt040: s.hp < hp0, enemyDartSpeed: spreadSeen };
    });
    await ctx.close(); return { ...r, ...r2 };
  };
  console.log('desktop', JSON.stringify(await run({ viewport: { width: 1000, height: 600 } }, 'desktop')));
  console.log('touch  ', JSON.stringify(await run({ ...devices['Pixel 5 landscape'] }, 'touch')));
  // gyro: a synthetic devicemotion turns the view when enabled
  const ctx = await browser.newContext({ ...devices['Pixel 5 landscape'] }); const page = await ctx.newPage(); page.on('pageerror', e => errors.push('gyro ' + e.message));
  await page.goto('http://localhost:8766/index.html?map=classroom', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  console.log('gyro:', await page.evaluate(() => { const g = window.__game; g.renderer.setAnimationLoop(null); g.start(); const btn = document.getElementById('tc-gyro'); const y0 = g.player.yaw; g.touchCtl.gyro = true; g.touchCtl.lastMotion = performance.now() - 16;
    const ev = new Event('devicemotion'); ev.rotationRate = { alpha: 0, beta: 90, gamma: 0 }; window.dispatchEvent(ev); return { btn: !!btn, turned: +(g.player.yaw - y0).toFixed(3), saved: localStorage.getItem('cnw-gyro') }; }));
  console.log('ERRORS:', errors.length ? errors : 'none'); await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
