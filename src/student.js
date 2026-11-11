import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, SIEGE, TOILET, MP, rand, pick, clamp } from './config.js';
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
    // 守校門：隔壁學校的惡霸，深色衣服加紅頭巾；入口（校門／爬牆／水溝蓋）跟著 variant 一起同步給隊友
    if (!opts.v && game.toilet) { v.cleaner = true; v.shirt = '#5d8ad6'; } // 搶廁所：清潔隊員，白圍裙藍帽子
    if (!opts.v && game.siege) { v.bully = true; v.shirt = leader ? '#8a2a2a' : pick(['#2b2622', '#5a1e1e', '#3a3a5a', '#4a4a4a']); if (leader) v.hair = 2; }
    // 三種行為不一樣的同學（主機擲骰，跟著 variant 同步）：shield 舉著墊板慢慢逼近、正面打不穿；rusher 衝過來搶一把子彈就跑；lobber 丟會越過課桌的水球
    if (!opts.v && !leader && game.rollKind) { const k = game.rollKind(); if (k) v.kind = k; }
    const entry = opts.entry || (v.entry ? { kind: v.entry, index: v.di } : null);
    if (entry && !v.entry) { v.entry = entry.kind; v.di = entry.index; }
    super(game.scene, () => Draw.kid(v, 'normal'), 0.9, 1.35);
    this.game = game; this.v = v; this.world = game.world;
    this.leader = leader; this.kind = v.kind || null; this.loot = 0; this.pathT = 0;
    this.hp = (game.diff ? game.diff.enemyHp : CFG.enemy.hp) + (leader ? CFG.leader.hpBonus : 0) + (game.siege ? SIEGE.hpBonus : 0) + (game.extraPlayers ? Math.floor(game.extraPlayers() / MP.hpEvery) : 0); this.state = 'enter'; this.timer = 0; this.path = []; this.crouch = 0; this.alive = true;
    this.group.position.set(spawn.x, game.world.heightAt(spawn.x, spawn.z), spawn.z);
    this.entry = entry;
    if (entry && entry.kind === 'wall') this.group.position.y += 1.35; // on top of the fence, about to drop
    if (entry && entry.kind === 'drain') { this.group.position.y -= 1.45; game.world.popDrain(entry.index); } // under the lid, about to climb out
    this.desk = null; this.shotsLeft = 0; this.shotTimer = 0; this.speedMul = rand(0.85, 1.15);
    this.id = opts.id ?? game.nextId(); this.texState = 'normal'; this.remote = !!opts.remote; this.age = 0; this.shotsFired = 0;
    this.team(0xd8432b);
    // the "!" that warns you she is about to fire
    if (!Student.alertTex) Student.alertTex = Draw.tex(Draw.alertIcon());
    this.alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: Student.alertTex, transparent: true, depthTest: false })); this.alert.scale.set(0.28, 0.42, 1); this.alert.position.set(0, 1.75, 0); this.alert.visible = false; this.group.add(this.alert);
    if (this.kind) { const [tagText, bg] = { shield: ['墊板', '#5d564f'], rusher: ['搶子彈', '#f28a1a'], lobber: ['水球', '#2f9fd1'] }[this.kind]; Student.tags = Student.tags || {}; if (!Student.tags[tagText]) Student.tags[tagText] = Draw.tex(Draw.nameTag(tagText, bg, '#ffffff')); this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: Student.tags[tagText], transparent: true, depthTest: false })); this.tag.scale.set(0.56, 0.175, 1); this.tag.position.set(0, 1.55, 0); this.group.add(this.tag); if (!this.remote && !opts.remote && game.onKindSeen) game.onKindSeen(this.kind); }
    if (leader) { const tagText = v.bully ? '老大' : '班長'; Student.tags = Student.tags || {}; if (!Student.tags[tagText]) Student.tags[tagText] = Draw.tex(Draw.nameTag(tagText, '#d8432b', '#ffffff')); this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: Student.tags[tagText], transparent: true, depthTest: false })); this.tag.scale.set(0.56, 0.175, 1); this.tag.position.set(0, 1.55, 0); this.group.add(this.tag); }
    if (this.remote) this.state = 'remote'; else if (entry && entry.kind === 'wall') this.state = 'drop'; else if (entry && entry.kind === 'drain') this.state = 'rise'; else this.chooseDesk();
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
    this.setTarget(s.x, s.y, s.z); if (this.alive && !s.a) this.fade(true); this.alive = !!s.a;
    const prev = this.texState; this.setTex(s.st);
    if (prev !== s.st) { if (s.st === 'hurt') { Audio.hitEnemy(); this.yelp(pick(Student.HIT_YELPS)); } else if (s.st === 'out') { Audio.out(); this.yelp(pick(Student.OUT_YELPS), 1.3); } }
    this.group.scale.set(s.sx, s.sy, s.sx); this.remoteRz = s.rz; if (s.f && this.flash <= 0) { this.flash = 0.15; this.stickDart(); } this.alert.visible = !!s.al;
  }
  chooseDesk() {
    // the two that do not hide: back to running (or running away with the loot) / back to walking up behind the board
    if (this.kind === 'rusher') { this.state = this.loot ? 'flee' : 'rush'; this.pathT = 0; this.path = []; this.crouch = 0; return; }
    if (this.kind === 'shield') { this.state = 'advance'; this.pathT = 0; this.path = []; this.crouch = 0; this.timer = rand(2.2, 3.6) * this.game.diff.hideMul; this.setTex('normal'); return; }
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
  // walk along this.path at a speed; false when there is nowhere left to go
  followPath(dt, speed) {
    const p = this.group.position; if (!this.path.length) return false;
    const t = this.path[0], dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz), sp = speed * this.speedMul * dt;
    if (dist < sp || dist < 0.08) { p.x = t.x; p.z = t.z; this.path.shift(); } else { p.x += dx / dist * sp; p.z += dz / dist * sp; }
    p.y = this.world.heightAt(p.x, p.z); return true;
  }
  // the board stops a dart that comes at it from the front while it is up (not while he lowers it to throw, not a sniper band)
  blocks(d) {
    if (this.kind !== 'shield' || this.texState !== 'normal' || (d.dmg || 1) >= 3) return false;
    const fa = this.faceA === undefined ? 0 : this.faceA, fx = Math.sin(fa), fz = Math.cos(fa), vl = Math.hypot(d.vel.x, d.vel.z) || 1; // he turns slowly (see update), so running round him gets past the board
    return (d.vel.x * fx + d.vel.z * fz) / vl < -0.3;
  }
  // a rusher reached someone: a handful of spare darts goes into the sack (nothing to take: a shove that costs a heart)
  steal(pl) {
    const g = this.game, take = Math.min(15, pl.reserve || 0);
    if (take > 0) {
      pl.reserve -= take; this.loot = take;
      if (pl === g.player) { g.ui.ammo(pl.ammo, pl.ammo === 0, pl.reserve); g.message(`被搶了 ${take} 發泡棉彈！`, '在他跑出門以前打倒他，子彈會掉回來', 2.2); }
      else { g.netEvent({ t: 'pickup', n: -take }, pl.slot); g.message(`${pl.skin.name}被搶了 ${take} 發！`, '打倒那個搶子彈的', 2); }
    } else { pl.hurtCd = Math.min(pl.hurtCd || 0, 0); pl.hurt(); this.loot = 0.001; }
    Audio.tattle(); g.netEvent({ t: 'sfx', n: 'tattle' }); this.state = 'flee'; this.path = []; this.fleeSet = false;
  }
  // a water balloon in a high arc onto where the target stands; the ring on the floor says where it lands
  lob(player) {
    const g = this.game, from = this.eye(); from.y += 0.25;
    const off = 0.35 * g.difficultySpread, to = new THREE.Vector3(player.pos.x + rand(-off, off), player.pos.y || 0, player.pos.z + rand(-off, off));
    const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz), T = clamp(dist / 7, 0.7, 1.1), G = 9;
    const vel = new THREE.Vector3(dx / T, (to.y + 0.05 - from.y + 0.5 * G * T * T) / T, dz / T);
    const d = g.darts.fire(from, vel, vel.length(), 'enemy', 'balloon'); d.shooter = this;
    g.spawnWave(to, 1.1, T, 0x6fb7ef); Audio.boing(); g.netEvent({ t: 'sfx', n: 'boing' });
  }
  update(dt) {
    if (this.remote) { this.remoteUpdate(dt, this.game.camera.position, this.alive); if (!this.alive) this.mesh.rotation.z = this.remoteRz || 0; return; }
    const p = this.group.position, player = this.pickTarget();
    let moving = false;
    this.timer -= dt; this.age += dt; this.retargetT = (this.retargetT || 0) - dt;
    if (this.kind === 'shield') { const want = Math.atan2(player.pos.x - p.x, player.pos.z - p.z); if (this.faceA === undefined) this.faceA = want; let da = want - this.faceA; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; this.faceA += clamp(da, -1.6 * dt, 1.6 * dt); }
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
          p.y = this.world.heightAt(p.x, p.z); moving = true;
        } else if (this.state === 'seekCover') { this.state = 'hide'; this.timer = rand(1.2, 2.6) * this.game.diff.hideMul; }
        else { this.chooseDesk(); }
        break;
      }
      case 'drop': { // over the fence: fall to the grass, then look for cover
        const g0 = this.world.heightAt(p.x, p.z); p.y -= 2.8 * dt; this.crouch = Math.min(1, this.crouch + dt * 3);
        if (p.y <= g0) { p.y = g0; this.crouch = 0; this.chooseDesk(); }
        break;
      }
      case 'rise': { // out of the drain: climb up through the opening
        const g0 = this.world.heightAt(p.x, p.z); p.y += 1.7 * dt;
        if (p.y >= g0) { p.y = g0; this.chooseDesk(); }
        break;
      }
      case 'rush': { // straight at the target, no hiding, no shooting
        const tp = player.pos; this.pathT -= dt;
        if (this.pathT <= 0) { this.pathT = 0.4; this.path = this.world.path(p, { x: tp.x, z: tp.z }); }
        moving = this.followPath(dt, CFG.enemy.speed * 1.55);
        if (Math.hypot(tp.x - p.x, tp.z - p.z) < 0.9 && Math.abs((tp.y || 0) - p.y) < 0.8) this.steal(player);
        break;
      }
      case 'flee': { // off to the nearest door with the sack; through it, the darts are gone
        if (!this.fleeSet) { this.fleeSet = true; const L = this.world.layout, door = L.doors.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || { x: p.x, z: p.z }; this.fleeTo = { x: door.x - 0.4, z: door.z }; this.path = this.world.path(p, this.fleeTo); this.fleeT = 9; }
        moving = this.followPath(dt, CFG.enemy.speed * 1.35); this.fleeT -= dt;
        if (!this.path.length || this.fleeT <= 0 || Math.hypot(this.fleeTo.x - p.x, this.fleeTo.z - p.z) < 0.5) { if (this.loot >= 1) this.game.message('搶子彈的跑掉了', `${this.loot} 發被帶走`, 1.6); this.alive = false; this.gone = true; if (this.desk && this.desk.covered === this) this.desk.covered = null; return; }
        break;
      }
      case 'advance': { // behind the board, slowly closing in; every few seconds he lowers it to throw
        const tp = player.pos, dist = Math.hypot(tp.x - p.x, tp.z - p.z); this.pathT -= dt;
        if (dist > 4.2) { if (this.pathT <= 0) { this.pathT = 0.8; this.path = this.world.path(p, { x: tp.x, z: tp.z }); } moving = this.followPath(dt, CFG.enemy.speed * 0.5); }
        if (this.timer <= 0 && dist < 10) { this.state = 'peek'; this.timer = this.game.diff.peekDelay + 0.3; this.alert.visible = true; this.setTex('open'); }
        break;
      }
      case 'hide': {
        if (this.kind === 'shield' || this.kind === 'rusher') { const t0 = this.timer; this.chooseDesk(); if (this.kind === 'shield') this.timer = Math.max(this.timer, t0); break; } // these two never duck: a scare just delays them
        this.crouch = Math.min(1, this.crouch + dt * 5);
        if (this.timer <= 0) { this.state = 'peek'; this.timer = this.game.diff.peekDelay * (this.game.leaderAlive() ? CFG.leader.peekMul : 1); this.alert.visible = true; }
        break;
      }
      case 'peek': {
        this.crouch = Math.max(0, this.crouch - dt * 6);
        if (this.timer <= 0) {
          this.alert.visible = false;
          const sees = this.kind === 'lobber' ? Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 12 : this.canSee(player); // a balloon needs no line of sight
          if (sees && this.game.shootersBusy()) { this.state = 'hide'; this.timer = rand(0.5, 1.2); } // someone else is already firing: wait your turn
          else if (sees) { if (Math.random() < 0.12) this.yelp(pick(Student.TAUNTS), 0.8); this.state = 'shoot'; this.shotsLeft = 1 + Math.floor(Math.random() * (this.game.diff.burstMax + (this.leader ? 1 : 0))); this.shotsFired = 0; this.shotTimer = 0.15;
            if (this.kind === 'lobber') this.shotsLeft = 1;
            if (this.v.cleaner) { this.burstKind = Math.random() < TOILET.waterChance ? 'water' : 'plunger'; this.shotsLeft = this.burstKind === 'water' ? 1 : TOILET.plungerBurst[0] + Math.floor(Math.random() * (TOILET.plungerBurst[1] - TOILET.plungerBurst[0] + 1)); } // 清潔隊：潑一桶水，或通馬桶連發 3 到 5 支
          }
          else { this.chooseDesk(); }
        }
        break;
      }
      case 'shoot': {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
          if (this.kind === 'lobber') this.lob(player); else this.fireAt(player); this.shotsLeft--; this.shotTimer = this.v.cleaner && this.burstKind === 'plunger' ? TOILET.plungerGap : 0.42;
          if (this.shotsLeft <= 0) { if (this.kind === 'shield' || Math.random() < 0.45) this.chooseDesk(); else { this.state = 'hide'; this.timer = rand(1.4, 2.8) * this.game.diff.hideMul; } }
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
        const t = clamp(this.flyT / 1.3, 0, 1), s = this.flyStart, e = this.leaving ? this.exit : this.desk.seat;
        const ey = this.leaving ? this.exit.y : this.world.heightAt(e.x, e.z);
        p.x = s.x + (e.x - s.x) * t; p.z = s.z + (e.z - s.z) * t; p.y = s.y + (ey - s.y) * t + Math.sin(t * Math.PI) * 2.2;
        this.mesh.rotation.z = t * Math.PI * 2;
        if (t >= 1 && this.leaving) { this.gone = true; return; }
        if (t >= 1) { this.state = 'sitting'; p.y = ey; this.mesh.rotation.z = 0; this.group.scale.set(0.85, 0.72, 0.85); if (this.tag) this.tag.visible = true; }
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
  eye() { return new THREE.Vector3(this.group.position.x, this.group.position.y + 1.1 * this.group.scale.y, this.group.position.z); }
  canSee(player) {
    const from = this.eye(), to = player.eyePos();
    if (from.distanceTo(to) > 11) return false;
    if (this.game.inZone(from, 'stink') || this.game.inZone(to, 'stink') || this.game.inZone(from, 'dust') || this.game.inZone(to, 'dust')) return false;
    return !this.world.segmentBlocked(from, to);
  }
  fireAt(player) {
    const from = this.eye(); from.y -= 0.15;
    const target = player.eyePos(); target.y -= 0.25;
    const dir = target.clone().sub(from); const dist = dir.length();
    const kind = this.v.cleaner ? (this.burstKind || 'plunger') : 'dart';
    const speed = (kind === 'water' ? TOILET.waterSpeed : (this.game.diff.dartSpeed || CFG.enemy.dartSpeed)) * (player.touch ? CFG.assist.enemyDartMul : 1);
    dir.y += dist * dist * (kind === 'water' ? 9 : CFG.gun.gravity) / (2 * speed * speed);
    const spread = CFG.enemy.spread * this.game.difficultySpread * (this.shotsFired === 0 ? this.game.diff.firstShotMul : 1) * (this.leader ? 0.6 : 1) * (this.game.panicT > 0 ? CFG.leader.panicSpreadMul : 1) * (player.touch ? CFG.assist.enemySpreadMul : 1); this.shotsFired++;
    dir.normalize().add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))).normalize();
    // move dart start a little toward the target so it clears own body/desk
    from.addScaledVector(dir, 0.5);
    const d = this.game.darts.fire(from, dir, speed, 'enemy', kind); d.shooter = this;
    if (kind === 'water') Audio.boing(); else Audio.enemyPew();
  }
  hit(dmg = 1) {
    if (!this.alive) return false;
    this.hp -= dmg; this.flash = 0.15; Audio.hitEnemy(); this.stickDart(this.hitY);
    this.game.addScore(CFG.score.hit); this.game.hitmark();
    if (this.hp <= 0) { this.yelp(pick(Student.OUT_YELPS), 1.3); this.knockOut(); return true; }
    this.yelp(pick(Student.HIT_YELPS));
    this.setTex('hurt'); this.alert.visible = false;
    this.state = 'hurt'; this.timer = 0.7;
    // stumble back away from player
    const pp = this.pickTarget().pos, dx = this.group.position.x - pp.x, dz = this.group.position.z - pp.z, l = Math.hypot(dx, dz) || 1;
    const np = this.group.position.clone(); np.x += dx / l * 0.35; np.z += dz / l * 0.35;
    if (Math.abs(this.world.heightAt(np.x, np.z) - np.y) < 0.45) { this.world.collideCircle(np, 0.2); this.group.position.x = np.x; this.group.position.z = np.z; this.group.position.y = this.world.heightAt(np.x, np.z); }
    return false;
  }
  knockOut() {
    this.alive = false; Audio.out(); this.alert.visible = false; this.fade(true);
    for (let i = 0; i < 3; i++) this.game.spawnDebris(new THREE.Vector3(this.group.position.x, this.group.position.y + 0.8, this.group.position.z), 0xfbf6e6, [0.09, 0.012, 0.07], new THREE.Vector3(rand(-1.5, 1.5), rand(2, 3.5), rand(-1.5, 1.5)), 1.4); // paper scraps
    this.game.darts.drop(this.group.position, (this.leader ? CFG.leader.drop : CFG.gun.dropOnKnockout) + (this.loot >= 1 ? this.loot : 0));
    if (this.loot >= 1) { this.game.message('搶走的子彈掉出來了！', `${this.loot} 發，走過去撿`, 1.8); this.loot = 0; }
    if (this.tag) this.tag.visible = false;
    if (this.leader) { // the wave leader is sent to the office instead of a seat: she leaves through the nearest door
      this.game.onLeaderDown(this);
      const L = this.world.layout, p = this.group.position, door = L.doors.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      this.leaving = true; this.exit = { x: door.x + 0.9, z: door.z, y: door.floor || 0 };
      if (this.desk && this.desk.covered === this) this.desk.covered = null;
      this.setTex('out'); this.state = 'flyOut'; this.flyT = 0; this.flyStart = this.group.position.clone(); this.crouch = 0; this.group.scale.y = 1;
      return;
    }
    if (!this.desk) { this.desk = this.world.desks.find(d => !d.occupant) || this.world.desks[0]; }
    if (this.desk.occupant !== this) { const free = this.world.desks.find(d => !d.occupant); if (free) { this.desk.covered = this.desk.covered === this ? null : this.desk.covered; this.desk = free; } }
    this.desk.occupant = this; this.desk.covered = this.desk.covered === this ? null : this.desk.covered;
    this.setTex('out');
    this.state = 'flyOut'; this.flyT = 0; this.flyStart = this.group.position.clone(); this.crouch = 0; this.group.scale.y = 1;
  }
  dispose() { if (this.desk) { if (this.desk.covered === this) this.desk.covered = null; if (this.desk.occupant === this) this.desk.occupant = null; } super.dispose(); }
}
Student.HIT_YELPS = ['哎唷！', '好痛！', '喂！', '犯規啦！', '啊啊啊'];
Student.OUT_YELPS = ['我要告訴老師！', '嗚嗚嗚', '不玩了啦', '媽——', '記住你了'];
Student.TAUNTS = ['看招！', '嘿嘿', '接好！', '別跑！'];
