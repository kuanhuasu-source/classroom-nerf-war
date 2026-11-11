// the three special kids: when they may appear, the shield (blocks from the front, open while throwing, a sniper band goes through, slow to turn),
// the rusher (steals spare darts, drops them when knocked out, or gets away), the lobber (a balloon over the desks, the ring, the splash)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } }); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?id=TEST&map=classroom', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const r = await page.evaluate(() => { const g = window.__game, V = g.player.pos.constructor, out = {}; g.renderer.setAnimationLoop(null); g.setDifficulty('normal'); g.start();
    const roll = (wave, level, n = 3000) => { g.wave = wave; g.level = level; const c = {}; for (let i = 0; i < n; i++) { const k = g.rollKind() || 'none'; c[k] = (c[k] || 0) + 1; } return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v / n * 100)])); };
    out.roll = { w1: roll(1, 'normal'), w4: roll(4, 'normal'), easyW2: roll(2, 'easy'), easyW3: roll(3, 'easy') }; g.level = 'normal'; g.wave = 2;
    const clearKids = () => { g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = []; g.nextWavePending = false; g.waveTimer = 1e9; g.darts.clear(); };
    const mk = (kind, x, z) => { const o = g.rollKind; g.rollKind = () => kind; g.spawnQueue.push({ door: { x: x + 0.3, z } }); g.spawnTimer = 0; g.step(1 / 60); g.rollKind = o; const s = g.students[g.students.length - 1]; s.group.position.set(x, 0, z); g.spawnQueue = []; return s; };
    const put = (x, z, yaw = 0) => { g.player.pos.set(x, 0, z); g.player.yaw = yaw; g.player.pitch = 0; g.player.keys = {}; };
    const dart = (from, to, dmg) => { const d = g.darts.fire(new V(...from), new V(to[0] - from[0], to[1] - from[1], to[2] - from[2]), 32, 'player'); d.who = 'host'; if (dmg) d.dmg = dmg; return d; };
    g.player.hurt = function () { this.hits0 = (this.hits0 || 0) + 1; };
    g.openOffer = () => {}; g.startWave = () => {}; g.startBoss = () => {}; // the test clears the room again and again: no upgrade cards, no next wave
    // ---- shield ----
    clearKids(); put(0, 4); let s = mk('shield', 0, -1); s.speedMul = 1; out.shield = { kind: s.kind, state: s.state, variant: s.serialize(true)[11].kind, tag: !!s.tag };
    for (let i = 0; i < 30; i++) g.step(1 / 60); // he turns to face the player first
    const hp0 = s.hp; dart([0, 1, 3], [0, 1, -1]); for (let i = 0; i < 30; i++) g.step(1 / 60); out.shield.frontBlocked = s.hp === hp0;
    dart([0, 1, -4], [0, 1, s.group.position.z]); for (let i = 0; i < 30; i++) g.step(1 / 60); out.shield.backHits = hp0 - s.hp; // from behind
    const z0 = s.group.position.z; s.state = 'advance'; s.setTex('normal'); s.timer = 99; for (let i = 0; i < 120; i++) g.step(1 / 60); out.shield.walked = +(s.group.position.z - z0).toFixed(2);
    s.timer = 0; let saw = []; for (let i = 0; i < 200; i++) { g.step(1 / 60); if (saw[saw.length - 1] !== s.state) saw.push(s.state); } out.shield.states = saw.slice(0, 5);
    s.state = 'advance'; s.setTex('open'); const hp1 = s.hp; dart([0, 1, 3.5], [0, 1, s.group.position.z]); for (let i = 0; i < 20; i++) g.step(1 / 60); out.shield.openHits = hp1 - s.hp;
    clearKids(); put(0, 4); s = mk('shield', 0, 0); for (let i = 0; i < 30; i++) g.step(1 / 60); s.hp = 3; dart([0, 1, 3.5], [0, 1, 0], 3); for (let i = 0; i < 20; i++) g.step(1 / 60); out.shield.sniperThrough = !s.alive;
    // ---- rusher ----
    clearKids(); put(-4, 3); g.player.reserve = 40; s = mk('rusher', 3, -2); s.speedMul = 1; let t = 0; while (t < 8 && s.state === 'rush') { g.step(1 / 60); t += 1 / 60; }
    out.rusher = { reachedIn: +t.toFixed(1), state: s.state, reserve: g.player.reserve, loot: s.loot };
    const lying0 = g.darts.list.filter(d => d.stuck).length; s.hp = 1; g.lastShooter = 'host'; s.hit(); g.lastShooter = null; out.rusher.dropped = g.darts.list.filter(d => d.stuck).length - lying0;
    clearKids(); put(-4, 3); g.player.reserve = 40; s = mk('rusher', 3, -2); s.speedMul = 1; t = 0; while (t < 20 && !s.gone) { g.step(1 / 60); t += 1 / 60; } out.rusher.escape = { gone: !!s.gone, reserve: g.player.reserve, left: g.students.length };
    // ---- lobber ----
    clearKids(); put(-3, 3); g.player.hits0 = 0; s = mk('lobber', 4, -3); const n0 = g.darts.list.length; s.lob(g.player); const b = g.darts.list[g.darts.list.length - 1]; out.lobber = { kind: b.kind, rings: g.rings.length };
    let top = 0; t = 0; while (t < 2 && g.darts.list.includes(b)) { g.step(1 / 60); t += 1 / 60; top = Math.max(top, b.mesh.position.y); } out.lobber.flight = +t.toFixed(2); out.lobber.apex = +top.toFixed(2); out.lobber.hitStanding = g.player.hits0;
    g.player.hits0 = 0; s.lob(g.player); put(1.5, 3); for (let i = 0; i < 90; i++) g.step(1 / 60); out.lobber.hitAfterMoving = g.player.hits0;
    // drawings for every kind and state
    out.draw = ['shield', 'rusher', 'lobber'].map(k => ['normal', 'open', 'hurt', 'out'].map(st => { const c = window.__draw.kid({ skin: '#f6d6b8', shirt: '#9fd3f2', hair: 0, hairColor: '#2b2622', kind: k }, st); return c.width; }).join());
    return out; });
  console.log(JSON.stringify(r, null, 1));
  // a look at the three
  await page.evaluate(() => { const g = window.__game; g.students.forEach(s => s.dispose()); g.students = []; g.darts.clear(); g.wave = 3;
    ['shield', 'rusher', 'lobber'].forEach((k, i) => { const o = g.rollKind; g.rollKind = () => k; g.spawnQueue.push({ door: { x: 0, z: 0 } }); g.spawnTimer = 0; g.step(1 / 60); g.rollKind = o; const s = g.students[g.students.length - 1]; s.update = function () { this.face(g.camera.position); }; s.group.position.set(-1.4 + i * 1.4, 0, 0.6); g.spawnQueue = []; });
    g.player.pos.set(0, 0, 3.4); g.player.yaw = 0; g.player.pitch = -0.05; for (let i = 0; i < 5; i++) g.step(1 / 60); g.ui.message('', '', 0.01); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'kinds.png' });
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
