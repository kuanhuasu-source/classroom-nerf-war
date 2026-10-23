// A competent-but-not-superhuman bot, injected into the page. Returns per-wave timings.
(level, map, seconds, accuracyJitter) => {
  const g = window.__game; g.setDifficulty(level); g.mapChoice = map; g.start();
  const p = g.player, L = g.world.layout;
  let hurts = 0; p.hurt = function () { if (this.hurtCd > 0 || this.invuln > 0 || this.sitting) return; hurts++; this.hurtCd = 0.7; this.hp--; g.ui.hp(this.hp, this.maxHp); if (this.hp <= 0) g.onPlayerDown(this); };
  // home: a desk two rows from the front, on the player's side
  const home = g.world.desks.slice().sort((a, b) => Math.hypot(a.x - L.start.x, a.z - L.start.z) - Math.hypot(b.x - L.start.x, b.z - L.start.z))[2];
  const homePos = { x: home.x, z: home.z + home.d / 2 + 0.45 };
  p.pos.set(homePos.x, 0, homePos.z); g.world.collideCircle(p.pos, 0.28);
  const V = p.pos.constructor; const prevPos = new Map();
  const waves = []; let cur = null, t = 0, fireT = 0, duckT = 0, lastWave = 0, goal = null;
  const prio = ['twin', 'rapid', 'mag', 'spring', 'heart', 'recycle', 'bag', 'reload', 'goggles', 'magnet'];
  const pickBest = () => { const btns = [...document.querySelectorAll('#upgrade-cards button')]; if (!btns.length) return; const ids = btns.map(b => b.dataset.id); const best = prio.find(id => ids.includes(id)) || ids[0]; g.pickUpgrade(best); };
  while (t < seconds && (g.state === 'playing' || g.state === 'upgrade' || g.state === 'won')) {
    if (g.state === 'upgrade' || g.ui.offerOpen) { pickBest(); continue; }
    if (g.state === 'won') break;
    if (g.wave !== lastWave) { if (cur) { cur.end = t; cur.hurts = hurts - cur.hurtsAt; cur.hp = p.hp; cur.ammo = p.ammo + p.reserve; } lastWave = g.wave; cur = { wave: g.wave, start: t, hurtsAt: hurts }; waves.push(cur); }
    const eye = p.eyePos();
    // threats and targets
    let target = null, bestScore = -1, shooters = 0;
    for (const s of g.students) {
      if (!s.alive) continue;
      const se = s.eye(); const vis = !g.world.segmentBlocked(eye, se);
      if (vis && s.state === 'shoot') shooters++;
      if (!vis || s.group.scale.y < 0.75 || s.state === 'hurt') continue;
      const d = eye.distanceTo(se); const score = (s.leader ? 3 : 1) + 1 / d;
      if (score > bestScore) { bestScore = score; target = s; }
    }
    let aim = null;
    if (target) { const pos = target.group.position; const prev = prevPos.get(target.id) || pos.clone(); const vel = pos.clone().sub(prev).multiplyScalar(60); const dist = eye.distanceTo(pos), flight = dist / 32; aim = pos.clone().addScaledVector(vel, flight); aim.y = 0.78 * target.group.scale.y + dist * dist * 0.0029; }
    else if (g.teacher && !g.teacher.defeated) { const t2 = g.teacher; const k = Object.keys(t2.wp).find(k => t2.wp[k].hp > 0); if (k) { t2.group.updateMatrixWorld(true); const w = t2.wpWorld(k); if (!g.world.segmentBlocked(eye, w)) aim = w; } }
    for (const s of g.students) prevPos.set(s.id, s.group.position.clone());
    // scavenge when dry and quiet
    const dry = p.reserve + p.ammo < 30, veryDry = p.reserve + p.ammo < 10;
    const quiet = !g.students.some(s => s.alive);
    if ((veryDry || (dry && quiet)) && !goal) { let best = null, bd = 1e9; for (const d of g.darts.list) if (d.stuck && d.kind === 'dart') { const dd = Math.hypot(d.mesh.position.x - p.pos.x, d.mesh.position.z - p.pos.z); if (dd < bd) { bd = dd; best = d.mesh.position.clone(); } } if (best) goal = best; }
    const ammoBox = g.milks.find(m => m.kind === 'ammo'); if (dry && ammoBox && !goal) goal = ammoBox.mesh.position.clone();
    const milk = g.milks.find(m => m.kind !== 'ammo'); if (p.hp <= 2 && milk && !goal) goal = milk.mesh.position.clone();
    if (goal) { const dx = goal.x - p.pos.x, dz = goal.z - p.pos.z, dist = Math.hypot(dx, dz); if (dist < 0.4) { goal = null; if (p.reserve < 40) { let best = null, bd = 1e9; for (const d of g.darts.list) if (d.stuck && d.kind === 'dart') { const dd = Math.hypot(d.mesh.position.x - p.pos.x, d.mesh.position.z - p.pos.z); if (dd > 0.3 && dd < bd) { bd = dd; best = d.mesh.position.clone(); } } if (best && bd < 6) goal = best; } } else { p.pos.x += dx / dist * 3.2 / 60; p.pos.z += dz / dist * 3.2 / 60; g.world.collideCircle(p.pos, 0.28); } }
    else if (Math.hypot(homePos.x - p.pos.x, homePos.z - p.pos.z) > 0.3) { const dx = homePos.x - p.pos.x, dz = homePos.z - p.pos.z, dist = Math.hypot(dx, dz); p.pos.x += dx / dist * 3.2 / 60; p.pos.z += dz / dist * 3.2 / 60; g.world.collideCircle(p.pos, 0.28); }
    // duck when two or more are firing at us, otherwise stand and shoot
    if (shooters >= 1) duckT = 0.4; duckT -= 1 / 60; // someone is firing: duck, then pop back up
    p.keys['ControlLeft'] = duckT > 0 && !goal;
    if (aim && duckT <= 0 && !p.sitting) {
      const d = aim.clone().sub(p.eyePos()); p.yaw = Math.atan2(-d.x, -d.z) + (Math.random() - 0.5) * accuracyJitter; p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) + (Math.random() - 0.5) * accuracyJitter;
      fireT -= 1 / 60; if (fireT <= 0) { p.tryFire(); fireT = 0.2; }
    }
    g.step(1 / 60); g.ui.tick(1 / 60); t += 1 / 60;
  }
  if (cur && !cur.end) { cur.end = t; cur.hurts = hurts - cur.hurtsAt; cur.hp = p.hp; cur.ammo = p.ammo + p.reserve; }
  return { result: g.state, reached: g.teacher ? '老師' : 'w' + g.wave, hurts, kills: g.kills, acc: p.shots ? Math.round(p.hits / p.shots * 100) : 0, upgrades: p.up.taken, ammo: [p.ammo, p.reserve], waves: waves.map(w => ({ w: w.wave, secs: +(w.end - w.start).toFixed(0), hurts: w.hurts, hp: w.hp, ammo: w.ammo })) };
}
