import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';
import { PaperFigure } from './paperfigure.js';

// ============================================================
//  Student AI
// ============================================================
export class Student extends PaperFigure {
  constructor(game, spawn, opts = {}) {
    const leader = !!(opts.leader || (opts.v && opts.v.leader));
    const v = opts.v || (leader ? { ...Draw.kidVariant(), hair: 1, shirt: '#ffffff', leader: true } : Draw.kidVariant());
    super(game.scene, () => Draw.kid(v, 'normal'), 0.9, 1.35);
    this.game = game; this.v = v; this.world = game.world;
    this.leader = leader;
    this.hp = (game.diff ? game.diff.enemyHp : CFG.enemy.hp) + (leader ? CFG.leader.hpBonus : 0); this.state = 'enter'; this.timer = 0; this.path = []; this.crouch = 0; this.alive = true;
    this.group.position.set(spawn.x, 0, spawn.z);
    this.desk = null; this.shotsLeft = 0; this.shotTimer = 0; this.speedMul = rand(0.85, 1.15);
    this.id = opts.id ?? game.nextId(); this.texState = 'normal'; this.remote = !!opts.remote; this.age = 0; this.shotsFired = 0;
    // the "!" that warns you she is about to fire
    if (!Student.alertTex) Student.alertTex = Draw.tex(Draw.alertIcon());
    this.alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: Student.alertTex, transparent: true, depthTest: false })); this.alert.scale.set(0.28, 0.42, 1); this.alert.position.set(0, 1.75, 0); this.alert.visible = false; this.group.add(this.alert);
    if (leader) { if (!Student.leaderTag) Student.leaderTag = Draw.tex(Draw.nameTag('班長', '#d8432b', '#ffffff')); this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: Student.leaderTag, transparent: true, depthTest: false })); this.tag.scale.set(0.56, 0.175, 1); this.tag.position.set(0, 1.55, 0); this.group.add(this.tag); }
    if (this.remote) this.state = 'remote'; else this.chooseDesk();
  }
  setTex(st) { if (this.texState === st) return; this.texState = st; this.setTexture(Draw.kid(this.v, st)); }
  // [id, x, y, z, sx, sy, rz, texState, alive, flash, variant?] — the variant rides along only when needed
  serialize(withVariant) {
    const p = this.group.position;
    const a = [this.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +this.group.scale.x.toFixed(2), +this.group.scale.y.toFixed(2), +this.mesh.rotation.z.toFixed(2), this.texState, this.alive ? 1 : 0, this.flash > 0 ? 1 : 0];
    a.push(this.alert.visible ? 1 : 0);
    if (withVariant || this.age < 1.2) a.push(this.v);
    return a;
  }
  static unpack(a) { return { id: a[0], x: a[1], y: a[2], z: a[3], sx: a[4], sy: a[5], rz: a[6], st: a[7], a: a[8], f: a[9], al: a[10], v: a[11] }; }
  applyState(s) {
    this.setTarget(s.x, s.y, s.z); this.alive = !!s.a;
    const prev = this.texState; this.setTex(s.st);
    if (prev !== s.st) { if (s.st === 'hurt') Audio.hitEnemy(); else if (s.st === 'out') Audio.out(); }
    this.group.scale.set(s.sx, s.sy, s.sx); this.remoteRz = s.rz; if (s.f && this.flash <= 0) this.flash = 0.15; this.alert.visible = !!s.al;
  }
  chooseDesk() {
    if (this.desk) this.desk.covered = null;
    const d = this.world.freeDesk(this.group.position);
    if (!d) { this.state = 'wander'; this.timer = 1; return; }
    this.desk = d; d.covered = this;
    if (!d.occupant) d.occupant = this; // this becomes "my seat" when out
    // cover point: the side of the desk facing away from player
    const pp = this.pickTarget().pos;
    let ox = d.x - pp.x, oz = d.z - pp.z; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
    const target = { x: d.x + ox * ((d.w || 0.62) / 2 + 0.32), z: d.z + oz * ((d.d || 0.46) / 2 + 0.32) };
    this.path = this.world.path(this.group.position, target);
    this.state = 'seekCover';
  }
  // the closest player we can see; falls back to the closest one
  // co-op: each kid keeps a target for 1.5 to 3 seconds, then draws again. Closer and visible players are
  // more likely, and a player who already has many kids on them is less likely, so fire gets spread between the two.
  pickTarget() {
    const list = this.game.activeTargets(); if (list.length === 1) return list[0];
    if (this.target && this.retargetT > 0 && list.includes(this.target)) return this.target;
    this.retargetT = rand(1.5, 3);
    const from = this.eye(), counts = new Map();
    for (const o of this.game.students) if (o.alive && o !== this && o.target) counts.set(o.target, (counts.get(o.target) || 0) + 1);
    let total = 0;
    const w = list.map(t => { const d = from.distanceTo(t.eyePos()), vis = !this.world.segmentBlocked(from, t.eyePos()); const x = (vis ? 2 : 0.5) * 6 / (d + 2) / (1 + 0.6 * (counts.get(t) || 0)); total += x; return x; });
    let r = Math.random() * total; this.target = list[list.length - 1];
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) { this.target = list[i]; break; } }
    return this.target;
  }
  update(dt) {
    if (this.remote) { this.remoteUpdate(dt, this.game.camera.position, this.alive); if (!this.alive) this.mesh.rotation.z = this.remoteRz || 0; return; }
    const p = this.group.position, player = this.pickTarget();
    let moving = false;
    this.timer -= dt; this.age += dt; this.retargetT = (this.retargetT || 0) - dt;
    switch (this.state) {
      case 'enter':
      case 'seekCover':
      case 'wander': {
        if (this.state === 'wander' && this.timer <= 0) { this.chooseDesk(); break; }
        if (this.path.length) {
          const t = this.path[0], dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz);
          const sp = CFG.enemy.speed * this.speedMul * dt;
          if (dist < sp || dist < 0.08) { p.x = t.x; p.z = t.z; this.path.shift(); }
          else { p.x += dx / dist * sp; p.z += dz / dist * sp; }
          moving = true;
        } else if (this.state === 'seekCover') { this.state = 'hide'; this.timer = rand(1.2, 2.6) * this.game.diff.hideMul; }
        else { this.chooseDesk(); }
        break;
      }
      case 'hide': {
        this.crouch = Math.min(1, this.crouch + dt * 5);
        if (this.timer <= 0) { this.state = 'peek'; this.timer = this.game.diff.peekDelay * (this.game.leaderAlive() ? CFG.leader.peekMul : 1); this.alert.visible = true; }
        break;
      }
      case 'peek': {
        this.crouch = Math.max(0, this.crouch - dt * 6);
        if (this.timer <= 0) {
          this.alert.visible = false;
          if (this.canSee(player) && this.game.shootersBusy()) { this.state = 'hide'; this.timer = rand(0.5, 1.2); } // someone else is already firing: wait your turn
          else if (this.canSee(player)) { this.state = 'shoot'; this.shotsLeft = 1 + Math.floor(Math.random() * (this.game.diff.burstMax + (this.leader ? 1 : 0))); this.shotsFired = 0; this.shotTimer = 0.15; }
          else { this.chooseDesk(); }
        }
        break;
      }
      case 'shoot': {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
          this.fireAt(player); this.shotsLeft--; this.shotTimer = 0.42;
          if (this.shotsLeft <= 0) { if (Math.random() < 0.45) this.chooseDesk(); else { this.state = 'hide'; this.timer = rand(1.4, 2.8) * this.game.diff.hideMul; } }
        }
        break;
      }
      case 'hurt': {
        this.crouch = Math.min(1, this.crouch + dt * 6);
        if (this.timer <= 0) { this.setTex('normal'); this.chooseDesk(); }
        break;
      }
      case 'flyOut': {
        this.flyT += dt;
        const t = clamp(this.flyT / 1.3, 0, 1), s = this.flyStart, e = this.desk.seat;
        p.x = s.x + (e.x - s.x) * t; p.z = s.z + (e.z - s.z) * t; p.y = Math.sin(t * Math.PI) * 2.2;
        this.mesh.rotation.z = t * Math.PI * 2;
        if (t >= 1) { this.state = 'sitting'; p.y = 0; this.mesh.rotation.z = 0; this.group.scale.set(0.85, 0.72, 0.85); if (this.tag) this.tag.visible = true; }
        return;
      }
      case 'sitting': return;
    }
    // apply crouch scale (paper shrinks below desk height)
    const sy = 1 - this.crouch * 0.55;
    this.group.scale.y += (sy - this.group.scale.y) * Math.min(1, dt * 12);
    this.face(this.game.camera.position);
    this.tick(dt, moving);
  }
  eye() { return new THREE.Vector3(this.group.position.x, 1.1 * this.group.scale.y, this.group.position.z); }
  canSee(player) {
    const from = this.eye(), to = player.eyePos();
    if (from.distanceTo(to) > 11) return false;
    if (this.game.inZone(from, 'stink') || this.game.inZone(to, 'stink')) return false;
    return !this.world.segmentBlocked(from, to);
  }
  fireAt(player) {
    const from = this.eye(); from.y -= 0.15;
    const target = player.eyePos(); target.y -= 0.25;
    const dir = target.clone().sub(from); const dist = dir.length();
    const speed = this.game.diff.dartSpeed || CFG.enemy.dartSpeed;
    dir.y += dist * dist * CFG.gun.gravity / (2 * speed * speed);
    const spread = CFG.enemy.spread * this.game.difficultySpread * (this.shotsFired === 0 ? this.game.diff.firstShotMul : 1) * (this.leader ? 0.6 : 1) * (this.game.panicT > 0 ? CFG.leader.panicSpreadMul : 1); this.shotsFired++;
    dir.normalize().add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))).normalize();
    // move dart start a little toward the target so it clears own body/desk
    from.addScaledVector(dir, 0.5);
    const d = this.game.darts.fire(from, dir, speed, 'enemy'); d.shooter = this;
    Audio.enemyPew();
  }
  hit() {
    if (!this.alive) return false;
    this.hp--; this.flash = 0.15; Audio.hitEnemy();
    this.game.addScore(CFG.score.hit); this.game.hitmark();
    if (this.hp <= 0) { this.knockOut(); return true; }
    this.setTex('hurt'); this.alert.visible = false;
    this.state = 'hurt'; this.timer = 0.7;
    // stumble back away from player
    const pp = this.pickTarget().pos, dx = this.group.position.x - pp.x, dz = this.group.position.z - pp.z, l = Math.hypot(dx, dz) || 1;
    const np = this.group.position.clone(); np.x += dx / l * 0.35; np.z += dz / l * 0.35;
    this.world.collideCircle(np, 0.2); this.group.position.x = np.x; this.group.position.z = np.z;
    return false;
  }
  knockOut() {
    this.alive = false; Audio.out(); this.alert.visible = false;
    this.game.darts.drop(this.group.position, this.leader ? CFG.leader.drop : CFG.gun.dropOnKnockout);
    if (this.tag) this.tag.visible = false;
    if (this.leader) this.game.onLeaderDown(this);
    if (!this.desk) { this.desk = this.world.desks.find(d => !d.occupant) || this.world.desks[0]; }
    if (this.desk.occupant !== this) { const free = this.world.desks.find(d => !d.occupant); if (free) { this.desk.covered = this.desk.covered === this ? null : this.desk.covered; this.desk = free; } }
    this.desk.occupant = this; this.desk.covered = this.desk.covered === this ? null : this.desk.covered;
    this.setTex('out');
    this.state = 'flyOut'; this.flyT = 0; this.flyStart = this.group.position.clone(); this.crouch = 0; this.group.scale.y = 1;
  }
  dispose() { if (this.desk) { if (this.desk.covered === this) this.desk.covered = null; if (this.desk.occupant === this) this.desk.occupant = null; } super.dispose(); }
}
