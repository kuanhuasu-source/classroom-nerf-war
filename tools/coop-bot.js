// Tick-based bots for the two-page co-op simulation. window.__bot = { init(role), tick(n) }
window.__bot = (() => {
  const prio = ['twin', 'rapid', 'mag', 'spring', 'heart', 'recycle', 'bag', 'reload', 'goggles', 'magnet'];
  let g, p, home, prevPos, fireT = 0, duckT = 0, goal = null, hurts = 0, role = 'host', waves = [], cur = null, lastWave = 0, t = 0;
  const V = () => p.pos.constructor;
  function init(r, level) {
    g = window.__game; role = r; if (level) g.setDifficulty(level);
    p = g.player; prevPos = new Map(); hurts = 0; waves = []; cur = null; lastWave = 0; t = 0;
    const L = g.world.layout; const sorted = g.world.desks.slice().sort((a, b) => Math.hypot(a.x - L.start.x, a.z - L.start.z) - Math.hypot(b.x - L.start.x, b.z - L.start.z));
    const h = sorted[role === 'host' ? 2 : 4]; home = { x: h.x, z: h.z + h.d / 2 + 0.45 };
    const oh = p.hurt.bind(p); p.hurt = function () { if (this.hurtCd > 0 || this.invuln > 0 || this.sitting) return; hurts++; oh(); };
  }
  function pickBest() { const btns = [...document.querySelectorAll('#upgrade-cards button')]; if (!btns.length) return; const ids = btns.map(b => b.dataset.id); g.pickUpgrade(prio.find(id => ids.includes(id)) || ids[0]); }
  function tick(n) {
    for (let k = 0; k < n; k++) {
      p = g.player;
      if (g.state === 'upgrade' || g.ui.offerOpen) pickBest();
      if (g.state === 'paused') g.resume();
      if (g.state !== 'playing' && g.state !== 'upgrade') { g.step(1 / 60); continue; }
      if (role === 'host' && g.wave !== lastWave) { if (cur) { cur.end = t; cur.hp = p.hp; } lastWave = g.wave; cur = { wave: g.wave, start: t }; waves.push(cur); }
      const eye = p.eyePos();
      let target = null, best = -1, danger = false;
      for (const s of g.students) {
        if (!s.alive) continue;
        const se = s.eye(); const vis = !g.world.segmentBlocked(eye, se);
        if (!vis) continue;
        if (role === 'host' ? s.state === 'shoot' : s.alert.visible) danger = true; // the guest only sees the "!" warning
        if (s.group.scale.y < 0.75 || s.state === 'hurt') continue;
        const d = eye.distanceTo(se); const sc = (s.leader ? 3 : 1) + 1 / d; if (sc > best) { best = sc; target = s; }
      }
      let aim = null;
      if (target) { const pos = target.group.position; const prev = prevPos.get(target.id) || pos.clone(); const vel = pos.clone().sub(prev).multiplyScalar(60); const dist = eye.distanceTo(pos); aim = pos.clone().addScaledVector(vel, dist / 32); aim.y = 0.78 * target.group.scale.y + dist * dist * 0.0029; }
      else if (g.teacher && !g.teacher.defeated) { const t2 = g.teacher; const key = Object.keys(t2.wp).find(k2 => t2.wp[k2].hp > 0); if (key) { t2.group.updateMatrixWorld(true); const w = t2.wpWorld(key); if (!g.world.segmentBlocked(eye, w)) aim = w; } }
      for (const s of g.students) prevPos.set(s.id, s.group.position.clone());
      // teammate down? go revive
      const mate = role === 'host' ? g.remote : g.hostFigure;
      const mateSitting = mate && (role === 'host' ? mate.sitting : mate.sitting);
      if (mateSitting && !p.sitting) { goal = mate.group.position.clone(); if (Math.hypot(goal.x - p.pos.x, goal.z - p.pos.z) < 1.0) { g.tryRevive(); goal = null; } }
      const quiet = !g.students.some(s => s.alive), dry = p.reserve + p.ammo < 30, veryDry = p.reserve + p.ammo < 10;
      if ((veryDry || (dry && quiet)) && !goal) { let bd = 1e9, bp = null; for (const d of g.darts.list) if (d.stuck && d.kind === 'dart') { const dd = Math.hypot(d.mesh.position.x - p.pos.x, d.mesh.position.z - p.pos.z); if (dd < bd) { bd = dd; bp = d.mesh.position.clone(); } } if (bp) goal = bp; }
      const box = g.milks.find(m => m.kind === 'ammo'); if (dry && box && !goal) goal = box.mesh.position.clone();
      const milk = g.milks.find(m => m.kind !== 'ammo'); if (p.hp <= 2 && milk && !goal) goal = milk.mesh.position.clone();
      if (p.sitting) goal = null;
      if (goal) { const dx = goal.x - p.pos.x, dz = goal.z - p.pos.z, dist = Math.hypot(dx, dz); if (dist < 0.4) goal = null; else { p.pos.x += dx / dist * 3.2 / 60; p.pos.z += dz / dist * 3.2 / 60; g.world.collideCircle(p.pos, 0.28); } }
      else if (!p.sitting && Math.hypot(home.x - p.pos.x, home.z - p.pos.z) > 0.3) { const dx = home.x - p.pos.x, dz = home.z - p.pos.z, dist = Math.hypot(dx, dz); p.pos.x += dx / dist * 3.2 / 60; p.pos.z += dz / dist * 3.2 / 60; g.world.collideCircle(p.pos, 0.28); }
      if (danger) duckT = 0.4; duckT -= 1 / 60;
      p.keys['ControlLeft'] = duckT > 0 && !goal;
      if (aim && duckT <= 0 && !p.sitting) { const d = aim.clone().sub(p.eyePos()); p.yaw = Math.atan2(-d.x, -d.z) + (Math.random() - 0.5) * 0.03; p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) + (Math.random() - 0.5) * 0.03; fireT -= 1 / 60; if (fireT <= 0) { p.tryFire(); fireT = 0.2; } }
      g.step(1 / 60); g.ui.tick(1 / 60); t += 1 / 60;
    }
    if (cur && role === 'host') { cur.end = t; cur.hp = p.hp; }
    return { state: g.state, wave: g.wave, hurts, hp: p.hp, sitting: p.sitting, ammo: p.ammo + p.reserve, acc: p.shots ? Math.round(p.hits / p.shots * 100) : 0, waves: waves.map(w => ({ w: w.wave, secs: +(w.end - w.start).toFixed(0), hp: w.hp })), teacher: !!g.teacher, kills: g.kills };
  }
  return { init, tick };
})();
