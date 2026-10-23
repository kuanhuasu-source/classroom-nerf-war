import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';
import { PaperFigure } from './paperfigure.js';

// ============================================================
//  Classroom characters: the sleeping bully, the dodgeball, the class monitor
// ============================================================
export class Bully extends PaperFigure {
  constructor(game, opts = {}) {
    super(game.scene, () => Draw.bully('sleep'), 1.1, 1.6);
    this.remote = !!opts.remote;
    this.game = game; this.world = game.world;
    // a random desk in the back two rows, away from the player's corner
    const L = this.world.layout, st = L.start;
    const back = this.world.desks.filter(d => d.z > L.d * 0.12 && Math.hypot(d.x - st.x, d.z - st.z) > 2.5 && !d.occupant);
    const d = opts.di !== undefined ? this.world.desks[opts.di] : pick(back.length ? back : this.world.desks);
    this.di = this.world.desks.indexOf(d); this.texState = 'sleep'; this.targetSy = 0.58;
    this.desk = d; d.covered = this; d.occupant = this;
    this.group.position.set(d.seat.x, 0, d.seat.z);
    this.state = 'sleep'; this.timer = 0; this.target = null; this.pack = null; this.snoreT = 0; this.deep = 0; this.deepMsgCd = 0;
    this.group.scale.set(1.2, 0.58, 1.2);
    const c = Draw.canvas(128, 96), ctx = c.getContext('2d');
    ctx.fillStyle = '#2b2622'; ctx.font = 'bold 34px "Patrick Hand", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('z', 30, 80); ctx.font = 'bold 44px "Patrick Hand", sans-serif'; ctx.fillText('Z', 64, 62); ctx.font = 'bold 54px "Patrick Hand", sans-serif'; ctx.fillText('Z', 102, 44);
    this.zz = new THREE.Sprite(new THREE.SpriteMaterial({ map: Draw.tex(c), transparent: true, depthTest: false })); this.zz.scale.set(0.5, 0.38, 1); this.zz.position.set(0.3, 1.1, 0); this.group.add(this.zz);
    const c2 = Draw.canvas(128, 96), ctx2 = c2.getContext('2d');
    ctx2.fillStyle = '#d8432b'; ctx2.font = 'bold 72px "Patrick Hand", sans-serif'; ctx2.textAlign = 'center'; ctx2.fillText('!!!', 64, 76);
    this.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: Draw.tex(c2), transparent: true, depthTest: false })); this.bang.scale.set(0.7, 0.5, 1); this.bang.position.set(0, 2.1, 0); this.bang.visible = false; this.group.add(this.bang);
  }
  poke(owner, shooter, who) {
    if (this.state !== 'sleep') return;
    if (this.deep > 0) { if (this.deepMsgCd <= 0 && owner === 'player') { this.deepMsgCd = 4; this.game.message('惡霸睡得太沉了', '打他沒反應', 1.2); } return; }
    const p = (who === 'guest' && this.game.remote ? this.game.remote.pos : this.game.player.pos);
    if (owner === 'player') this.target = new THREE.Vector3(p.x, 0, p.z);
    else if (shooter && shooter.alive) this.target = shooter.group.position.clone().setY(0);
    else { const s = this.game.students.filter(x => x.alive); this.target = s.length ? pick(s).group.position.clone().setY(0) : new THREE.Vector3(p.x, 0, p.z); }
    this.state = 'wake'; this.timer = CFG.bully.windup; this.flash = 0.15;
    this.setTexture(Draw.bully('angry')); this.zz.visible = false; this.bang.visible = true;
    Audio.growl();
    this.game.message(owner === 'player' ? '你吵醒惡霸了！' : '同學吵醒惡霸了！', '他要丟書包了，快跑', 1.6);
  }
  serialize() {
    const k = this.pack;
    return { di: this.di, st: this.state, sy: +this.group.scale.y.toFixed(2), zz: this.zz.visible ? 1 : 0, bg: this.bang.visible ? 1 : 0, f: this.flash > 0 ? 1 : 0,
      pk: k ? [+k.mesh.position.x.toFixed(2), +k.mesh.position.y.toFixed(2), +k.mesh.position.z.toFixed(2), +k.mesh.rotation.x.toFixed(2), +k.mesh.rotation.y.toFixed(2)] : null };
  }
  applyState(s) {
    const tex = s.st === 'sleep' ? 'sleep' : 'angry';
    if (tex !== this.texState) { this.texState = tex; this.setTexture(Draw.bully(tex)); if (tex === 'angry') Audio.growl(); }
    this.state = s.st; this.targetSy = s.sy; this.zz.visible = !!s.zz; this.bang.visible = !!s.bg; if (s.f && this.flash <= 0) this.flash = 0.15;
    if (s.pk) { if (!this.pack) { const m = this.makePack(); m.position.set(s.pk[0], s.pk[1], s.pk[2]); this.game.scene.add(m); this.pack = { mesh: m, vel: new THREE.Vector3(), t: 0, T: 1 }; }
      this.pack.mesh.position.set(s.pk[0], s.pk[1], s.pk[2]); this.pack.mesh.rotation.set(s.pk[3], s.pk[4], 0); }
    else if (this.pack) { this.game.scene.remove(this.pack.mesh); this.pack = null; }
  }
  makePack() {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.18), new THREE.MeshToonMaterial({ color: 0xd8432b, gradientMap: this.world.gradient }));
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), this.world.inkMat)); m.castShadow = true;
    return m;
  }
  update(dt) {
    const p = this.group.position; this.timer -= dt; this.deep = Math.max(0, this.deep - dt); this.deepMsgCd -= dt;
    if (this.remote) {
      this.group.scale.y += (this.targetSy - this.group.scale.y) * Math.min(1, dt * 8);
      if (this.state === 'sleep') { this.snoreT += dt; this.zz.position.y = 1.1 + Math.sin(this.snoreT * 2) * 0.08; this.zz.material.rotation = Math.sin(this.snoreT) * 0.1; }
      else if (this.state === 'wake') this.mesh.rotation.z = Math.sin(performance.now() / 40) * 0.06;
      this.face(this.game.camera.position); this.tick(dt, false); return;
    }
    if (this.state === 'sleep') {
      this.group.scale.y += (0.58 - this.group.scale.y) * Math.min(1, dt * 6);
      this.snoreT += dt; this.zz.position.y = 1.1 + Math.sin(this.snoreT * 2) * 0.08; this.zz.material.rotation = Math.sin(this.snoreT) * 0.1;
      if (this.snoreT > 3.2 && this.game.player.pos.distanceTo(p) < 5) { this.snoreT = 0; Audio.snore(); this.game.netEvent({ t: 'sfx', n: 'snore' }); }
    } else if (this.state === 'wake') {
      this.group.scale.y += (1.05 - this.group.scale.y) * Math.min(1, dt * 10);
      this.mesh.rotation.z = Math.sin(performance.now() / 40) * 0.06;
      if (this.timer <= 0) { this.throwPack(); this.state = 'watch'; this.timer = CFG.bully.grumble; this.bang.visible = false; }
    } else if (this.state === 'watch') {
      if (this.pack) this.updatePack(dt);
      if (this.timer <= 0 && !this.pack) { this.state = 'sleep'; this.deep = CFG.bully.deepSleep; this.setTexture(Draw.bully('sleep')); this.zz.visible = true; this.snoreT = 2.5; this.game.message('惡霸嘟囔著趴回去睡了', '這次睡得很沉', 1.4); }
    }
    this.face(this.game.camera.position);
    this.tick(dt, false);
  }
  throwPack() {
    const from = new THREE.Vector3(this.group.position.x, 1.5, this.group.position.z);
    const to = this.target.clone(); to.y = 0.15;
    const T = Math.max(0.6, Math.min(1.2, from.distanceTo(to) / 7));
    const vel = to.clone().sub(from).divideScalar(T); vel.y += 0.5 * 9.8 * T;
    const m = this.makePack(); m.position.copy(from);
    this.game.scene.add(m);
    this.pack = { mesh: m, vel, t: 0, T };
  }
  updatePack(dt) {
    const k = this.pack; k.t += dt; k.vel.y -= 9.8 * dt; k.mesh.position.addScaledVector(k.vel, dt); k.mesh.rotation.x += 7 * dt; k.mesh.rotation.y += 3 * dt;
    if (k.mesh.position.y <= 0.15 || k.t > k.T + 0.3) { k.mesh.position.y = Math.max(0.15, k.mesh.position.y); this.blast(k.mesh.position); this.game.scene.remove(k.mesh); this.pack = null; }
  }
  blast(at) {
    Audio.blast(); this.game.netEvent({ t: 'sfx', n: 'blast' });
    const R = CFG.bully.blastRadius, g = this.game;
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      g.spawnDebris(at, pick([0xf7a8c4, 0x9fd3f2, 0xb7e3a1, 0xf4e27a, 0xffffff]), [0.2, 0.03, 0.26], new THREE.Vector3(Math.cos(a) * rand(2, 4), rand(3, 5.5), Math.sin(a) * rand(2, 4)), 2.5);
    }
    g.spawnRing(at, R, 0xd8432b);
    for (const pl of g.activeTargets()) if (Math.hypot(pl.pos.x - at.x, pl.pos.z - at.z) < R && g.state === 'playing') { pl.hurtCd = 0; pl.hurt(); g.message('被書包砸到了！', '惡霸的書包有十公斤', 1.6); }
    let n = 0;
    for (const s of g.students) {
      if (!s.alive) continue;
      if (Math.hypot(s.group.position.x - at.x, s.group.position.z - at.z) < R) { s.hp = 1; s.hit(); n++; g.kills++; g.addScore(150); }
    }
    if (n) g.message(`書包砸倒了 ${n} 個同學`, '惡霸不分敵我', 1.6);
    g.darts.drop(at, 3);
  }
  testHit(pos) { if (this.state !== 'sleep') return false; const d = Math.hypot(pos.x - this.group.position.x, pos.z - this.group.position.z); return d < CFG.bully.hitRadius && pos.y > 0.2 && pos.y < 1.1; }
  awake() { return this.state === 'sleep' && this.deep <= 0; }
  dispose() { if (this.pack) this.game.scene.remove(this.pack.mesh); if (this.desk) { this.desk.covered = null; this.desk.occupant = null; } super.dispose(); }
}
