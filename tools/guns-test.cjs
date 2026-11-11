// borrowed guns: the wall item pool, each gun's rhythm and darts (pellets / range, damage and piercing, free rapid fire), the look in hand,
// and a guest's borrowed gun arming the darts the host flies for it
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } }); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?id=TEST&map=classroom', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const r = await page.evaluate(() => { const g = window.__game, V = g.player.pos.constructor, out = {}; g.renderer.setAnimationLoop(null); g.setDifficulty('normal'); g.start(); g.player.hurt = function () {};
    const GUNS = window.__guns, BUFFS = window.__buffs;
    out.pool = BUFFS.map(b => b.id);
    // every icon draws, an item can hang for each
    out.icons = BUFFS.map(b => { const it = new window.__SpecialItem(g, b, g.world.layout.mounts[0]); const ok = !!it.mesh.material.map; it.dispose(); return ok; });
    const clearKids = () => { g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = []; g.nextWavePending = false; g.waveTimer = 1e9; };
    const mk = (x, z, hp = 3) => { g.spawnQueue.push({ door: { x: x + 0.3, z } }); g.spawnTimer = 0; g.step(1 / 60); const s = g.students[g.students.length - 1]; s.update = () => {}; s.group.position.set(x, 0, z); s.hp = hp; g.spawnQueue = []; return s; };
    const aim = (x, z) => { g.player.pos.set(x, 0, z); g.player.yaw = 0; g.player.pitch = 0; g.player.keys = {}; g.player.update(1 / 60); };
    const fly = (n = 50) => { for (let i = 0; i < n; i++) g.step(1 / 60); };
    // shotgun: five pellets for one dart of ammo, slow rhythm, short range; point blank up to three count on one kid
    clearKids(); g.applyBuff(GUNS.shotgun); aim(0, 4); const a0 = g.player.ammo, n0 = g.darts.list.length; const near = mk(0, 2.6, 5);
    g.player.fireCd = 0; g.player.tryFire(); out.shotgun = { darts: g.darts.list.length - n0, ammoUsed: a0 - g.player.ammo, cd: +g.player.fireCd.toFixed(2), look: g.player.gunLookId, life: +Math.max(...g.darts.list.slice(n0).map(d => d.life)).toFixed(2) };
    fly(40); out.shotgun.pointBlankDmg = 5 - near.hp;
    clearKids(); const far = mk(0, -3.4, 5); aim(0, 4.2); g.player.fireCd = 0; g.player.tryFire(); fly(60); out.shotgun.farDmg = 5 - far.hp; // 7.6 m away: most pellets have spread or dropped
    // sniper: one dart knocks out a 3-heart kid and goes on to the one behind
    clearKids(); g.applyBuff(GUNS.sniper); const k1 = mk(0, 1.5, 3), k2 = mk(0, -0.5, 3); aim(0, 4); g.player.update(1 / 60); g.player.fireCd = 0; g.player.tryFire(); fly(40);
    out.sniper = { first: k1.alive, second: k2.alive, cd: +g.player.fireCd.toFixed(2), look: g.player.gunLookId, kills: g.kills };
    // rapid: fast and free
    clearKids(); g.applyBuff(GUNS.rapid); aim(0, 4); const a1 = g.player.ammo; let shots = 0; for (let i = 0; i < 60; i++) { g.player.firing = true; const before = g.player.shots; g.player.update(1 / 60); if (g.player.shots > before) shots++; } g.player.firing = false;
    out.rapid = { shotsIn1s: shots, ammoUsed: a1 - g.player.ammo, look: g.player.gunLookId };
    // the buff runs out: back to the plain blaster
    g.buffs.host.t = 0.01; fly(3); g.player.update(1 / 60); out.after = { buff: g.myBuff, look: g.player.gunLookId };
    return out; });
  console.log(JSON.stringify(r));
  // a guest borrows the sniper: its darts are armed on the host
  const mk2 = async (q) => { const p = await browser.newPage({ viewport: { width: 800, height: 450 } }); p.on('pageerror', e => errors.push(q + ' ' + e.message)); await p.goto('http://localhost:8766/index.html?' + q, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.__game, null, { timeout: 30000 }); await p.evaluate(() => { window.__game.renderer.setAnimationLoop(null); }); return p; };
  const host = await mk2('role=host'), guest = await mk2('role=guest&slot=g1');
  const relay = async () => { const h = await host.evaluate(() => window.__transport.drain()); const gq = await guest.evaluate(() => window.__transport.drain()); await guest.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), h); await host.evaluate((l) => l.forEach(s => { const t = window.__transport; if (!s.to || s.to === t.id) t.receive(s.str, s.from); }), gq); };
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { await host.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); await guest.evaluate(() => { for (let k = 0; k < 6; k++) window.__game.step(1 / 60); }); await relay(); } };
  await relay(); await host.click('#btn-start'); await tick(5);
  await host.evaluate(() => { const g = window.__game; g.applyBuff(window.__guns.sniper, 'g1'); }); await tick(2);
  const gb = await guest.evaluate(() => { const g = window.__game; g.player.fireCd = 0; g.player.tryFire(); return { buff: g.myBuff && g.myBuff.id, look: g.player.gunLookId, cd: +g.player.fireCd.toFixed(2) }; });
  await relay(); const hd = await host.evaluate(() => { const d = window.__game.darts.list.filter(d => d.who === 'g1').pop(); return d ? { dmg: d.dmg, pierce: d.pierce, g: d.g } : null; });
  console.log('guest sniper', JSON.stringify({ guest: gb, hostDart: hd }));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
