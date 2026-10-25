import * as THREE from 'three';
import { CFG, rand, pick, clamp, MP } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';
import { PaperFigure } from './paperfigure.js';
import { TEACHERS, BOSSES, COMMITTEE, teacherById } from './teachers.js';

// ============================================================
//  Teacher boss — one of four subjects, each with her own attack, movement and weak points
// ============================================================
export class Teacher extends PaperFigure {
  constructor(game, spawn, opts = {}) {
    const def = opts.def || teacherById(opts.kind) || pick(TEACHERS);
    const flags = { mood: 'angry' }; for (const w of def.wp) flags[w.key] = true;
    super(game.scene, () => Draw.teacher(def, flags), 1.15, 2.3);
    this.game = game; this.def = def; this.flags = flags; this.world = game.world;
    this.group.position.set(spawn.x, game.world.heightAt(spawn.x, spawn.z), spawn.z);
    this.remote = !!opts.remote;
    this.L = this.world.layout;
    const enterTo = def.enterTo ? { x: def.enterTo[0], z: def.enterTo[1] } : { x: 0.9, z: this.L.front };
    this.state = 'enter'; this.timer = 0; this.path = this.remote ? [] : this.world.path(this.group.position, enterTo);
    this.overtime = false; this.alone = false; // committee: colleagues fell
    this.throwTimer = 2.5; this.pauseTimer = 0; this.rage = 0; this.throwIdx = 0; this.glideT = 0; this.special = null;
    this.specials = (def.specials || (def.special ? [{ kind: def.special, every: def.specialEvery }] : [])).map(sp => ({ ...sp, t: sp.every }));
    // the blackboard eraser: every teacher and boss except the exam committee throws one now and then
    this.eraserOk = def.group !== 'committee'; this.eraserT = this.eraserEvery() * rand(0.5, 0.9); this.retaliateT = 0;
    if (def.scale) this.group.scale.setScalar(def.scale);
    this.team(0xd8432b);
    this.defeated = false;
    this.wp = {};
    for (const w of def.wp) this.wp[w.key] = { hp: CFG.teacher.wpHp, local: new THREE.Vector3(...w.local), r: w.r, label: w.label, def: w };
    this.wpMax = opts.wpHp || CFG.teacher.wpHp;
    if (opts.wpHp) for (const k in this.wp) this.wp[k].hp = opts.wpHp;
    // crayon target rings to tell the player where to shoot
    this.rings = {};
    const ringGeo = new THREE.RingGeometry(0.2, 0.25, 24);
    for (const k in this.wp) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xd8432b, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }));
      m.position.copy(this.wp[k].local); m.position.z = 0.02; this.mesh.add(m); this.rings[k] = m;
    }
    this.debris = [];
  }
  has(k) { return this.wp[k] && this.wp[k].hp > 0; }
  // seconds between erasers: bosses throw fewer, the gang king has his own (mad) rate
  eraserEvery() { return (this.def.eraserEvery || CFG.teacher.eraserEvery * (this.def.boss ? 1.4 : 1)) * Math.max(0.5, 1 - MP.bossRate * (this.game.extraPlayers ? this.game.extraPlayers() : 0)); }
  wpWorld(k) { return this.mesh.localToWorld(this.wp[k].local.clone()); }
  hudEntries() { return this.def.wp.map(w => ({ label: w.label, hp: this.wp[w.key].hp })); }
  serialize() {
    const p = this.group.position, wp = {}; for (const k in this.wp) wp[k] = this.wp[k].hp;
    return { k: this.def.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), wm: this.wpMax, wp, fl: this.flags, df: this.defeated ? 1 : 0, f: this.flash > 0 ? 1 : 0, ch: this.special && this.special.kind === 'charge' && this.special.phase === 'go' ? 1 : 0 };
  }
  applyState(s) {
    this.setTarget(s.x, this.world.heightAt(s.x, s.z), s.z); if (s.wm) this.wpMax = s.wm;
    for (const k in s.wp) if (this.wp[k]) this.wp[k].hp = s.wp[k];
    if (JSON.stringify(s.fl) !== JSON.stringify(this.flags)) {
      const lost = Object.keys(s.fl).some(k => k !== 'mood' && this.flags[k] && !s.fl[k]);
      Object.assign(this.flags, s.fl); this.setTexture(Draw.teacher(this.def, this.flags)); if (lost) Audio.weakpoint();
    }
    this.defeated = !!s.df; if (s.f && this.flash <= 0) this.flash = 0.15; this.remoteCharging = !!s.ch;
  }
  moveSpeed() {
    let s = this.def.speed;
    if ((this.def.id === 'pe' || this.def.id === 'gang1' || this.def.id === 'king') && !this.has('cap')) s *= 0.5;
    if (this.def.id === 'math' && !this.has('book')) s *= 0.6;
    if (this.def.id === 'principal' && this.rage > 0) s *= 1.6;
    if (this.def.id === 'timer' && !this.has('tie')) s *= 0.7;
    if (this.overtime) s *= 1.2;
    return s;
  }
  update(dt) {
    const p = this.group.position, player = this.nextTarget();
    let moving = false;
    if (this.ringFlash) { this.ringFlash.t -= dt; if (this.ringFlash.t <= 0) this.ringFlash = null; }
    for (const k in this.rings) { const r = this.rings[k]; r.visible = this.wp[k].hp > 0 && !this.defeated; const hot = this.ringFlash && this.ringFlash.k === k; r.scale.setScalar(hot ? 1.5 : 1 + Math.sin(performance.now() / 180) * 0.12); r.material.color.setHex(hot ? 0xffffff : 0xd8432b); }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.vel.y -= 9 * dt; d.mesh.position.addScaledVector(d.vel, dt); d.mesh.rotation.x += d.spin * dt; d.mesh.rotation.z += d.spin * 0.7 * dt; d.life -= dt;
      const gy = this.world.heightAt(d.mesh.position.x, d.mesh.position.z) + 0.05; if (d.mesh.position.y < gy) { d.mesh.position.y = gy; d.vel.y = Math.abs(d.vel.y) * 0.4; d.vel.x *= 0.7; d.vel.z *= 0.7; }
      if (d.life <= 0) { this.scene.remove(d.mesh); this.debris.splice(i, 1); }
    }
    if (this.remote) { this.remoteUpdate(dt, this.game.camera.position, !this.defeated); if (this.defeated) this.mesh.rotation.z = Math.sin(performance.now() / 120) * 0.05; else if (this.remoteCharging) this.mesh.rotation.z = Math.sin(performance.now() / 40) * 0.1; return; }
    if (this.defeated) { this.face(this.game.camera.position); this.tick(dt, false); this.mesh.rotation.z = Math.sin(performance.now() / 120) * 0.05; return; }
    this.rage = Math.max(0, this.rage - dt); this.retaliateT = Math.max(0, this.retaliateT - dt);
    // ---- special moves take over movement ----
    if (this.special) { moving = this.updateSpecial(dt, player); }
    else {
      moving = this.updateMove(dt, player);
      for (const sp of this.specials) { sp.t -= dt; if (sp.t <= 0 && !this.special) { sp.t = sp.every; this.startSpecial(player, sp.kind); } }
      if (this.eraserOk) { this.eraserT -= dt; if (this.eraserT <= 0 && !this.special) { this.eraserT = this.eraserEvery() * rand(0.8, 1.2) * (this.game.diff ? this.game.diff.teacherMul : 1); this.startSpecial(player, 'eraser'); } }
    }
    // ---- ranged attack ----
    this.throwTimer -= (this.rage > 0 ? 2.2 : 1) * dt;
    if (this.throwTimer <= 0 && !(this.special && this.special.phase === 'go')) {
      const fired = this.attack(player);
      let iv = this.def.interval * (this.game.diff ? this.game.diff.teacherMul : 1) * Math.max(0.5, 1 - MP.bossRate * (this.game.extraPlayers ? this.game.extraPlayers() : 0));
      if (this.def.id === 'music' && !this.has('sheet')) iv *= 1.6;
      if (this.def.id === 'math' && !this.has('glasses')) iv *= 1.35;
      if (this.def.id === 'stamper' && !this.has('badge')) iv *= 1.5;
      if (this.overtime) iv *= 0.7;
      this.throwTimer = fired ? iv : iv * 0.6;
    }
    this.face(this.game.camera.position);
    this.tick(dt, moving);
  }
  // ---------- movement styles ----------
  followPath(dt, speed) {
    const p = this.group.position;
    if (!this.path.length) return false;
    const t = this.path[0], dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz), sp = speed * dt;
    if (dist < sp || dist < 0.08) { p.x = t.x; p.z = t.z; this.path.shift(); } else { p.x += dx / dist * sp; p.z += dz / dist * sp; }
    p.y = this.world.heightAt(p.x, p.z);
    return true;
  }
  updateMove(dt, player) {
    const p = this.group.position;
    const L = this.L, gx = L.w / 2 - 2.8;
    if (this.state === 'enter') { if (this.followPath(dt, this.moveSpeed())) return true; this.state = 'roam'; this.pauseTimer = 1; this.glideT = Math.asin(clamp(p.x / gx, -1, 1)); return false; }
    const style = this.alone && this.def.chase ? 'pace' : this.def.move;
    switch (style) {
      case 'stage': { // wanders between spots on the stage
        if (this.followPath(dt, this.moveSpeed())) return true;
        this.pauseTimer -= dt;
        const S = L.stage || { minX: -L.w / 2 + 1, maxX: L.w / 2 - 1, minZ: -L.d / 2 + 0.6, maxZ: L.front + 0.15 };
        if (this.pauseTimer <= 0) { this.path = this.world.path(p, { x: rand(S.minX, S.maxX), z: rand(S.minZ, S.maxZ) }); this.pauseTimer = rand(1.2, 2.6); }
        return false;
      }
      case 'glide': { // sways along the front of the room like she is conducting
        this.glideT += dt * 0.55;
        const nx = Math.sin(this.glideT) * gx, nz = L.front + Math.sin(this.glideT * 2.4) * 0.22;
        const moved = Math.abs(nx - p.x) > 0.001; p.x = nx; p.z = nz; return moved;
      }
      case 'run': { // sprints between random spots anywhere in the room
        if (this.followPath(dt, this.moveSpeed())) return true;
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) { this.path = this.world.path(p, { x: rand(-L.w / 2 + 1, L.w / 2 - 1), z: rand(-L.d / 2 + 0.7, L.d / 2 - 0.7) }); this.pauseTimer = rand(0.4, 1.0); }
        return false;
      }
      case 'anchor': { // stays by the podium, shifting between three spots
        if (this.followPath(dt, this.moveSpeed())) return true;
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) { const fz = L.front - 0.15; const spots = [[-1.3, fz], [0, fz], [1.3, fz]].filter(s => Math.abs(s[0] - p.x) > 0.5); const s = pick(spots); this.path = this.world.path(p, { x: s[0], z: s[1] }); this.pauseTimer = rand(4, 7); }
        return false;
      }
      default: { // 'pace': along the front, sometimes advancing toward a player's row
        if (this.followPath(dt, this.moveSpeed())) return true;
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) {
          const advance = Math.random() < (this.alone ? 0.7 : 0.35);
          const tx = advance ? clamp(player.pos.x + rand(-2, 2), -L.w / 2 + 1, L.w / 2 - 1) : rand(-L.w / 2 + 1.5, L.w / 2 - 1.5);
          const tz = advance ? clamp(player.pos.z - 2.5, -L.d / 2 + 0.6, 1.5) : rand(-L.d / 2 + 0.6, L.front + 0.15);
          this.path = this.world.path(p, { x: tx, z: tz }); this.pauseTimer = rand(1.5, 3);
        }
        return false;
      }
    }
    this.group.position.y = this.world.heightAt(this.group.position.x, this.group.position.z);
  }
  // ---------- specials ----------
  startSpecial(player, kind) {
    const g = this.game;
    if (kind === 'broadcast') {
      if (!this.has('megaphone')) return;
      this.special = { kind: 'broadcast', phase: 'windup', t: 0.9, r: 0, hit: new Set() };
      Audio.tattle(); g.netEvent({ t: 'sfx', n: 'tattle' }); g.message('全體同學注意！廣播來了', '蹲下才不會被震到', 1.6);
      return;
    }
    if (kind === 'rollcall') {
      if (!this.has('clipboard') || g.bossPhase && g.students.filter(s => s.alive).length >= 3) return;
      for (let i = 0; i < 2; i++) g.spawnQueue.push(this.L.doors[i % 2]); g.spawnTimer = Math.min(g.spawnTimer, 0.3);
      Audio.whistle(); g.netEvent({ t: 'sfx', n: 'whistle' }); g.message(this.def.gang ? '軍師打電話叫人：再來兩個！' : '教務主任點名：再來兩個！', '', 1.6);
      return;
    }
    if (kind === 'slam') {
      if (!this.has('trophy')) return;
      this.special = { kind: 'slam', phase: 'walk', t: 2.5, target: player };
      this.path = this.world.path(this.group.position, player.pos);
      g.message(this.def.gang ? '大王舉起獎盃要砸人了……' : '校長要頒獎了……', '別站在他旁邊', 1.4);
      return;
    }
    if (kind === 'eraser' || kind === 'eraserQuick') { // a lobbed eraser: wherever it lands, a cloud of chalk dust. Quick = thrown in anger right after being hit
      const quick = kind === 'eraserQuick';
      this.special = { kind: 'eraser', t: quick ? 0.35 : 0.7, target: player };
      Audio.scribble(); g.netEvent({ t: 'sfx', n: 'scribble' }); { const who = this.def.gang ? this.def.name : '老師'; g.message(quick ? `${who}氣得丟板擦！` : `${who}拿起板擦了！`, '粉筆灰會讓人看不清楚，快閃', 1.4); }
      return;
    }
    if (kind === 'collect') { // 收卷：3 秒內誰開槍誰被記一筆；全場慢動作
      if (!this.has('papers')) return;
      this.special = { kind: 'collect', phase: 'windup', t: 1.0, shots: null, punished: new Set() };
      Audio.tattle(); g.netEvent({ t: 'sfx', n: 'tattle' }); g.message('主考官：收卷！', '接下來 3 秒不要開槍', 1.6);
      return;
    }
    if (kind === 'countdown') { // 倒數：盯住一個人，5 秒內沒躲好就連丟三張考卷
      if (!this.has('stopwatch')) return;
      this.special = { kind: 'countdown', t: CFG.committee.countdown, target: player, ringT: 0 };
      Audio.whistle(); g.netEvent({ t: 'sfx', n: 'whistle' });
      g.message(`監考官盯上${player === g.player ? '你' : (player.skin ? player.skin.name : '隊友')}了！`, '5 秒內蹲到掩體後面', 2);
      return;
    }
    if (kind === 'stamp') { // 不及格：往一個人腳下蓋章，留下會扣血的紅圈
      if (!this.has('stamp')) return;
      this.special = { kind: 'stamp', phase: 'windup', t: 1.2, target: player.pos.clone(), ringT: 0 };
      Audio.boing(); g.message('監考官要蓋「不及格」了！', '紅圈會留在地上，別站進去', 1.6);
      return;
    }
    if (kind === 'charge') {
      if (!this.has('whistle')) return;
      this.special = { kind: 'charge', phase: 'windup', t: 1.0, target: player.pos.clone() };
      Audio.whistle(); g.netEvent({ t: 'sfx', n: 'whistle' }); g.message(this.def.gang ? '嗶——！惡霸打手要衝過來了' : '嗶——！體育老師要衝過來了', '快躲開', 1.4);
    } else if (this.def.special === 'experiment') {
      if (!this.has('manual')) return;
      const at = player.pos.clone();
      this.special = { kind: 'experiment', phase: 'windup', t: 1.5, target: at, ringT: 0 };
      Audio.bubble(); g.netEvent({ t: 'sfx', n: 'bubble' }); g.message('自然老師在你腳下做實驗！', '紅圈會爆，快離開', 1.5);
    }
  }
  updateSpecial(dt, player) {
    const s = this.special, g = this.game, p = this.group.position;
    if (s.kind === 'eraser') {
      s.t -= dt; this.mesh.rotation.z = Math.sin(performance.now() / 45) * 0.1;
      if (s.t <= 0) {
        const { from, dir } = this.aimAt('eraser', s.target, CFG.teacher.eraserSpeed, CFG.gun.gravity, 0.03);
        const d = g.darts.fire(from, dir, CFG.teacher.eraserSpeed, 'teacher', 'eraser'); d.life = 4;
        Audio.chalkThrow(); this.special = null;
      }
      return false;
    }
    if (s.kind === 'collect') {
      s.t -= dt; this.mesh.rotation.z = Math.sin(performance.now() / 60) * 0.06;
      if (s.phase === 'windup') { if (s.t <= 0) { s.phase = 'hold'; s.t = CFG.committee.collectHold; g.slowT = CFG.committee.collectHold; s.shots = new Map(g.activeTargets().map(pl => [pl, pl.shots])); g.spawnWave(p, 7, 1.0, 0xf4e27a); } return false; }
      for (const pl of g.activeTargets()) { const was = s.shots.get(pl); if (was !== undefined && pl.shots > was && !s.punished.has(pl)) { s.punished.add(pl); pl.hurtCd = 0; pl.hurt(); g.message('收卷時間還開槍，記一筆！', '主考官瞪著你', 1.4); } }
      if (s.t <= 0) { this.special = null; g.slowT = 0; }
      return false;
    }
    if (s.kind === 'countdown') {
      s.t -= dt; s.ringT -= dt;
      const tgt = s.target;
      if (s.ringT <= 0) { s.ringT = 0.5; g.spawnRing(tgt.pos, 0.7, 0xd8432b); }
      if (s.t <= 0) {
        const eye = new THREE.Vector3(p.x, p.y + 1.6, p.z);
        const hidden = tgt.sitting || tgt.crouching || tgt.crouch || this.world.segmentBlocked(eye, tgt.eyePos());
        if (hidden) g.message('躲過了！', '監考官找不到人', 1.4);
        else {
          const { from, dir } = this.aimAt('stopwatch', tgt, 12, 1.5, 0.02), up = new THREE.Vector3(0, 1, 0);
          for (let i = 0; i < 3; i++) g.darts.fire(from.clone(), dir.clone().applyAxisAngle(up, (i - 1) * 0.12), 12, 'teacher', 'plane');
          Audio.chalkThrow(); g.message('時間到！三張考卷飛過來', '', 1.4);
        }
        this.special = null;
      }
      return false;
    }
    if (s.kind === 'stamp') {
      s.t -= dt; s.ringT -= dt;
      if (s.ringT <= 0) { s.ringT = 0.4; g.spawnRing(s.target, CFG.committee.stampRadius, 0xd8432b); }
      this.mesh.rotation.z = Math.sin(performance.now() / 45) * 0.1;
      if (s.t <= 0) {
        Audio.blast(); g.netEvent({ t: 'sfx', n: 'blast' });
        g.addZone(s.target, CFG.committee.stampRadius, CFG.committee.stampLife, 'fail');
        for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2; g.spawnDebris(s.target, 0xd8432b, [0.1, 0.02, 0.1], new THREE.Vector3(Math.cos(a) * rand(1, 2.5), rand(2, 4), Math.sin(a) * rand(1, 2.5)), 2); }
        this.special = null; this.pauseTimer = 0.5;
      }
      return false;
    }
    if (s.kind === 'broadcast') {
      s.t -= dt;
      if (s.phase === 'windup') { this.mesh.rotation.z = Math.sin(performance.now() / 50) * 0.08; if (s.t <= 0) { s.phase = 'wave'; s.t = 1.1; g.spawnWave(p, 5.0, 1.1, 0xd8432b); Audio.blast(); g.netEvent({ t: 'sfx', n: 'blast' }); } return false; }
      s.r += 5.0 * dt;
      for (const pl of g.activeTargets()) { const crouched = pl.crouching || pl.crouch; if (!crouched && !s.hit.has(pl) && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < s.r) { s.hit.add(pl); pl.hurtCd = 0; pl.hurt(); g.message('被廣播震到了！', '下次記得蹲下', 1.2); } }
      if (s.t <= 0) this.special = null;
      return false;
    }
    if (s.kind === 'slam') {
      s.t -= dt;
      if (s.phase === 'walk') {
        const went = this.followPath(dt, 3.0);
        const near = Math.hypot(s.target.pos.x - p.x, s.target.pos.z - p.z) < 1.4;
        if (!went || near || s.t <= 0) { s.phase = 'raise'; s.t = 1.0; s.ringT = 0; this.path = []; }
        return went;
      }
      s.ringT -= dt; if (s.ringT <= 0) { s.ringT = 0.35; g.spawnRing(p, 1.8, 0xf4e27a); }
      this.mesh.rotation.z = Math.sin(performance.now() / 40) * 0.1;
      if (s.t <= 0) {
        Audio.blast(); g.netEvent({ t: 'sfx', n: 'blast' });
        for (const pl of g.activeTargets()) if (Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 1.8) { pl.hurtCd = 0; pl.hurt(); g.message('被獎盃砸到了！', '校長：這是榮譽', 1.4); }
        for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2; g.spawnDebris(p, 0xf4e27a, [0.1, 0.1, 0.1], new THREE.Vector3(Math.cos(a) * rand(1, 3), rand(2, 4), Math.sin(a) * rand(1, 3)), 2); }
        this.special = null; this.pauseTimer = 0.6;
      }
      return false;
    }
    if (s.kind === 'charge') {
      if (s.phase === 'windup') {
        this.mesh.rotation.z = Math.sin(performance.now() / 40) * 0.1; s.t -= dt;
        if (s.t <= 0) { s.phase = 'go'; s.t = 2.4; s.target = player.pos.clone(); this.path = this.world.path(p, s.target); }
        return false;
      }
      s.t -= dt;
      const went = this.followPath(dt, 6.0);
      for (const pl of g.activeTargets()) if (Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 0.75) { pl.hurtCd = 0; pl.hurt(); g.message(this.def.gang ? '被惡霸打手撞飛了！' : '被體育老師撞飛了！', '', 1.2); s.t = 0; }
      if (!went || s.t <= 0) { this.special = null; this.path = []; this.pauseTimer = 0.8; }
      return went;
    }
    if (s.kind === 'experiment') {
      s.t -= dt; s.ringT -= dt;
      if (s.ringT <= 0) { s.ringT = 0.5; g.spawnRing(s.target, 2.0, 0x2f7d4f); }
      if (s.t <= 0) {
        Audio.blast(); g.netEvent({ t: 'sfx', n: 'blast' });
        for (const pl of g.activeTargets()) if (Math.hypot(pl.pos.x - s.target.x, pl.pos.z - s.target.z) < 2.0) { pl.hurtCd = 0; pl.hurt(); g.message('實驗爆炸了！', '', 1.2); }
        for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2; g.spawnDebris(s.target, pick([0xb7e3a1, 0x2f7d4f, 0xffffff]), [0.12, 0.12, 0.12], new THREE.Vector3(Math.cos(a) * rand(1, 3), rand(3, 5), Math.sin(a) * rand(1, 3)), 2); }
        g.addZone(s.target, 1.3, 3.5);
        this.special = null;
      }
      return false;
    }
    this.special = null; return false;
  }
  // ---------- ranged attacks ----------
  nextTarget() { const list = this.game.activeTargets(); return list[this.throwIdx % list.length] || this.game.player; }
  aimAt(fromKey, player, speed, gravity, spread) {
    if (player && player.touch) spread *= CFG.assist.enemySpreadMul;
    const from = this.has(fromKey) ? this.wpWorld(fromKey) : new THREE.Vector3(this.group.position.x, 1.6, this.group.position.z); from.y -= 0.1;
    const target = player.eyePos(); target.y -= 0.2;
    const dir = target.clone().sub(from); const dist = dir.length();
    if (gravity > 0) dir.y += dist * dist * gravity / (2 * speed * speed);
    dir.normalize().add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))).normalize();
    from.addScaledVector(dir, 0.4);
    return { from, dir };
  }
  attack(player) {
    const g = this.game; this.throwIdx++;
    switch (this.def.attack) {
      case 'chalk': {
        if (!this.has('chalk') && Math.random() < 0.5) return false;
        const { from, dir } = this.aimAt('chalk', player, CFG.teacher.chalkSpeed, CFG.gun.gravity, this.has('glasses') ? 0.045 : 0.2);
        g.darts.fire(from, dir, CFG.teacher.chalkSpeed, 'teacher', 'chalk'); Audio.chalkThrow(); return true;
      }
      case 'ball': {
        if (!this.has('ball')) return false;
        const { from, dir } = this.aimAt('ball', player, 12, CFG.gun.gravity, 0.05);
        g.darts.fire(from, dir, 12, 'teacher', 'ball'); Audio.boing(); return true;
      }
      case 'notes': {
        const n = this.has('baton') ? 3 : 1, acc = this.has('clip') ? 0.03 : 0.18;
        const { from, dir } = this.aimAt('baton', player, 9, 0, acc);
        const up = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < n; i++) {
          const a = n === 1 ? 0 : (i - 1) * 0.26;
          const d = dir.clone().applyAxisAngle(up, a);
          g.darts.fire(from.clone(), d, 9, 'teacher', 'note');
        }
        Audio.sing(); g.netEvent({ t: 'sfx', n: 'sing' }); return true;
      }
      case 'planes': { // report cards (or exam papers) folded into paper planes
        const key = this.def.planesKey || 'reports', n = this.has(key) ? 3 : 1;
        const { from, dir } = this.aimAt(key, player, 11, 1.5, this.def.id === 'chief' && !this.has('glasses') ? 0.2 : 0.04);
        const up = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < n; i++) { const a = n === 1 ? 0 : (i - 1) * 0.22; g.darts.fire(from.clone(), dir.clone().applyAxisAngle(up, a), 11, 'teacher', 'plane'); }
        Audio.chalkThrow(); return true;
      }
      case 'speech': { // the principal's words follow you around
        const { from, dir } = this.aimAt('mic', player, 6, 0, 0.02);
        const d = g.darts.fire(from, dir, 6, 'teacher', 'speech'); d.life = 4.5;
        if (this.has('mic')) { const who = player; d.home = () => who.eyePos(); d.turn = 1.6; }
        Audio.sing(); g.netEvent({ t: 'sfx', n: 'sing' }); return true;
      }
      case 'tube': {
        if (!this.has('rack')) return false;
        const { from, dir } = this.aimAt('rack', player, 11, CFG.gun.gravity, this.has('goggles') ? 0.05 : 0.2);
        g.darts.fire(from, dir, 11, 'teacher', 'tube'); Audio.chalkThrow(); return true;
      }
    }
    return false;
  }
  // returns 'weak' | 'body' | null. The teacher is a sheet of paper, so we find where the dart's
  // path (prev -> pos) crosses that sheet and compare the crossing point with the items drawn on it.
  testHit(pos, prev, mul = 1) {
    if (this.defeated) return null;
    this.group.updateMatrixWorld(true);
    const lp = this.mesh.worldToLocal(pos.clone()), lq = prev ? this.mesh.worldToLocal(prev.clone()) : lp.clone();
    let c = null;
    if ((lp.z <= 0) !== (lq.z <= 0)) { const t = lq.z / (lq.z - lp.z); c = lq.clone().lerp(lp, t); }
    else if (Math.abs(lp.z) < 0.12) c = lp;
    if (!c) return null;
    for (const k in this.wp) {
      const w = this.wp[k]; if (w.hp <= 0) continue;
      if (Math.hypot(c.x - w.local.x, c.y - w.local.y) < w.r * mul) { this.hitWeak(k); return 'weak'; }
    }
    if (Math.abs(c.x) < 0.55 && c.y > 0 && c.y < 2.3) return 'body';
    return null;
  }
  hitWeak(k) {
    const w = this.wp[k]; w.hp--; this.flash = 0.15; this.ringFlash = { k, t: 0.2 }; this.game.hitmark(); this.game.addScore(CFG.score.hit * 2);
    if (this.eraserOk && !this.remote && this.retaliateT <= 0 && !(this.special && this.special.phase === 'go')) {
      this.retaliateT = CFG.teacher.eraserRetaliate; const who = this.game.lastShooter, g = this.game;
      const shooter = (who && who !== 'host' && g.remoteBySlot(who)) || g.player;
      this.special = null; this.startSpecial(shooter.sitting ? this.nextTarget() : shooter, 'eraserQuick');
    }
    Audio.hitEnemy();
    this.game.updateBossHud();
    if (w.hp <= 0) {
      Audio.weakpoint();
      this.flags[k] = false; this.setTexture(Draw.teacher(this.def, this.flags));
      this.game.addScore(CFG.score.weakpoint);
      const m = new THREE.Mesh(new THREE.BoxGeometry(...w.def.size), new THREE.MeshToonMaterial({ color: w.def.color, gradientMap: this.world.gradient }));
      m.position.copy(this.wpWorld(k)); m.castShadow = true; this.scene.add(m);
      const toP = this.nextTarget().pos.clone().sub(m.position).setY(0).normalize();
      this.debris.push({ mesh: m, vel: new THREE.Vector3(toP.x * 2 + rand(-1, 1), 3.5, toP.z * 2 + rand(-1, 1)), spin: rand(4, 9), life: 4 });
      this.game.message(w.def.lost[0], w.def.lost[1], 2.2);
      if (this.def.id === 'principal') this.rage = 6;
      if (Object.values(this.wp).every(x => x.hp <= 0)) this.defeat();
    }
  }
  defeat() {
    this.defeated = true; this.special = null; this.flags.mood = 'cry'; this.setTexture(Draw.teacher(this.def, this.flags)); this.path = [];
    Audio.teacher();
    this.game.onTeacherDefeated(this);
  }
  dispose() { this.debris.forEach(d => this.scene.remove(d.mesh)); this.debris = []; super.dispose(); }
}
