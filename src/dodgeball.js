import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';

export class Dodgeball {
  constructor(game, opts = {}) {
    this.game = game; this.world = game.world; this.r = CFG.ball.radius; this.remote = !!opts.remote;
    const geo = new THREE.SphereGeometry(this.r, 18, 14);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: Draw.tex(Draw.ballTex()), gradientMap: this.world.gradient }));
    this.mesh.castShadow = true; this.start = opts.start || this.randomSpot(); this.mesh.position.set(this.start.x, this.r, this.start.z);
    game.scene.add(this.mesh);
    this.vel = new THREE.Vector3(); this.lastHitBy = null; this.bounceCd = 0; this.hitCd = 0;
  }
  launch(dir, owner) {
    this.vel.copy(dir).setY(0).normalize().multiplyScalar(CFG.ball.launch); this.vel.y = 2.2;
    this.lastHitBy = owner; this.hitCd = 0; Audio.boing(); this.game.netEvent({ t: 'sfx', n: 'boing' });
  }
  serialize() {
    const p = this.mesh.position, v = this.vel;
    return { sx: +this.start.x.toFixed(2), sz: +this.start.z.toFixed(2), x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2) };
  }
  applyState(s) {
    const was = this.vel.length();
    this.mesh.position.set(s.x, s.y, s.z); this.vel.set(s.vx, s.vy, s.vz);
    if (this.vel.length() - was > 5) Audio.boing();
  }
  update(dt) {
    const p = this.mesh.position, v = this.vel, r = this.r;
    if (this.remote) { p.addScaledVector(v, dt); this.mesh.rotation.x += v.z / r * dt; this.mesh.rotation.z -= v.x / r * dt; return; }
    this.bounceCd -= dt; this.hitCd -= dt;
    const speed = Math.hypot(v.x, v.z);
    if (speed < 0.05 && p.y <= r + 0.005 && Math.abs(v.y) < 0.2) { v.set(0, 0, 0); p.y = r; return; }
    v.y -= 9.8 * dt; p.addScaledVector(v, dt);
    this.mesh.rotation.x += v.z / r * dt; this.mesh.rotation.z -= v.x / r * dt;
    if (p.y < r) { p.y = r; if (v.y < -0.5) { v.y = -v.y * 0.5; v.x *= 0.85; v.z *= 0.85; if (this.bounceCd <= 0) { Audio.bounce(); this.bounceCd = 0.2; } } else v.y = 0; }
    if (p.y <= r + 0.01) { const f = Math.max(0, 1 - 1.6 * dt); v.x *= f; v.z *= f; }
    const W = this.world.room.w / 2 - r, D = this.world.room.d / 2 - r;
    if (p.x < -W) { p.x = -W; v.x = Math.abs(v.x) * 0.7; } if (p.x > W) { p.x = W; v.x = -Math.abs(v.x) * 0.7; }
    if (p.z < -D) { p.z = -D; v.z = Math.abs(v.z) * 0.7; } if (p.z > D) { p.z = D; v.z = -Math.abs(v.z) * 0.7; }
    for (const b of this.world.boxes) {
      if (p.y - r > b.h) continue;
      const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) {
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d; p.x += nx * (r - d); p.z += nz * (r - d);
        const vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= 1.7 * vn * nx; v.z -= 1.7 * vn * nz; if (this.bounceCd <= 0 && speed > 1) { Audio.bounce(); this.bounceCd = 0.2; } }
      }
    }
    const sp = Math.hypot(v.x, v.z), g = this.game;
    if (sp > CFG.ball.hurtSpeed && this.hitCd <= 0) {
      for (const s of g.students) {
        if (!s.alive) continue;
        if (Math.hypot(s.group.position.x - p.x, s.group.position.z - p.z) < 0.5 && p.y < 1.4 * s.group.scale.y) {
          s.hp = 1; s.hit(); g.kills++; g.addScore(this.lastHitBy === 'player' ? 300 : 100); v.multiplyScalar(0.35); this.hitCd = 0.4;
          g.message(this.lastHitBy === 'player' ? '躲避球一擊出局！' : '流彈把躲避球打飛了', this.lastHitBy === 'player' ? '+300' : '同學被自己人的球打到', 1.5);
          return;
        }
      }
      for (const pl of g.activeTargets()) {
        const pp = pl.pos;
        if (g.state === 'playing' && Math.hypot(pp.x - p.x, pp.z - p.z) < 0.5 && p.y < pl.eye + 0.2 && this.lastHitBy !== 'player') {
          pl.hurt(); v.multiplyScalar(0.35); this.hitCd = 0.6; g.message('被躲避球打到了！', '', 1.2); break;
        }
      }
      if (g.bully && g.bully.awake() && Math.hypot(g.bully.group.position.x - p.x, g.bully.group.position.z - p.z) < 0.7) { g.bully.poke(this.lastHitBy === 'player' ? 'player' : 'enemy', null, this.lastWho); v.multiplyScalar(0.3); }
    }
  }
  testDart(d) {
    if (d.mesh.position.distanceTo(this.mesh.position) < this.r + 0.08) { this.lastWho = d.who; this.launch(d.vel, d.owner); return true; }
    return false;
  }
  randomSpot() {
    // somewhere in an aisle, not next to the player's start
    const L = this.world.layout, st = L.start;
    for (let i = 0; i < 40; i++) { const x = rand(-L.w / 2 + 2, L.w / 2 - 2), z = rand(-L.d / 2 + 1.5, L.d / 2 - 1.5); const c = this.world.cellOf(x, z); if (this.world.free(c.gx, c.gz) && Math.hypot(x - st.x, z - st.z) > 3) return { x, z }; }
    return { x: CFG.ball.start.x, z: CFG.ball.start.z };
  }
  reset() { this.mesh.position.set(this.start.x, this.r, this.start.z); this.vel.set(0, 0, 0); this.lastHitBy = null; }
  dispose() { this.game.scene.remove(this.mesh); }
}
