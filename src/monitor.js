import * as THREE from 'three';
import { CFG, COOP, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';
import { PaperFigure } from './paperfigure.js';

export class Monitor extends PaperFigure {
  constructor(game, opts = {}) {
    super(game.scene, () => Draw.monitor('normal'), 0.9, 1.4);
    this.game = game; this.world = game.world; this.remote = !!opts.remote; this.texState = 'normal';
    const L = this.world.layout; this.L = L;
    this.group.position.set(opts.x ?? rand(-3, 3), 0, opts.z ?? rand(L.front - 0.65, L.front + 0.15));
    this.state = 'pause'; this.timer = 1; this.path = []; this.strokes = 0; this.strokeCd = 0; this.rest = 0;
    const c = Draw.canvas(128, 96), ctx = c.getContext('2d');
    ctx.fillStyle = '#2b2622'; ctx.font = 'bold 60px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✎', 64, 70);
    this.pen = new THREE.Sprite(new THREE.SpriteMaterial({ map: Draw.tex(c), transparent: true, depthTest: false })); this.pen.scale.set(0.4, 0.3, 1); this.pen.position.set(0.35, 1.7, 0); this.pen.visible = false; this.group.add(this.pen);
  }
  setTex(st) { if (this.texState === st) return; this.texState = st; this.setTexture(Draw.monitor(st)); }
  serialize() { const p = this.group.position; return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), st: this.state, n: this.strokes, pen: this.pen.visible ? 1 : 0, f: this.flash > 0 ? 1 : 0 }; }
  applyState(s) {
    this.setTarget(s.x, 0, s.z); this.state = s.st; this.setTex(s.st === 'cry' ? 'cry' : 'normal'); this.pen.visible = !!s.pen;
    if (s.n !== this.strokes) { this.strokes = s.n; this.world.setTally(s.n); Audio.scribble(); }
    if (s.f && this.flash <= 0) this.flash = 0.15;
  }
  canSee(player) {
    const from = new THREE.Vector3(this.group.position.x, 1.05, this.group.position.z), to = player.eyePos();
    if (from.distanceTo(to) > CFG.monitor.sight) return false;
    return !this.world.segmentBlocked(from, to);
  }
  noticeShot(who = this.game.player) {
    if (this.state === 'cry' || this.rest > 0 || this.strokeCd > 0 || !this.canSee(who)) return;
    this.strokeCd = CFG.monitor.strokeCooldown; this.game.stat(who === this.game.player ? 'host' : 'guest', 'strokes');
    this.addStroke(1, who === this.game.player ? '班長記你一筆！' : '班長記了' + (who.skin ? who.skin.name : '隊友') + '一筆！');
  }
  addStroke(n, text) {
    this.strokes += n; this.world.setTally(this.strokes); Audio.scribble();
    if (this.state !== 'cry') { this.state = 'write'; this.timer = 0.7; this.pen.visible = true; this.path = []; }
    const full = Math.floor(this.strokes / 5), rest = this.strokes % 5;
    if (this.strokes % 5 === 0) this.tattle(); else this.game.message(text, `黑板上的正字：${'正'.repeat(full)}${rest ? ' ' + rest + '/5' : ''}`, 1.4);
  }
  tattle() {
    Audio.tattle();
    const g = this.game; this.rest = CFG.monitor.rest; this.restSpot = { x: rand(-2, 2), z: this.L.front - 0.55 };
    if (g.teacher && !g.teacher.defeated) { g.teacher.rage = CFG.monitor.rageSeconds; g.message('班長去告狀了！', '老師更生氣，粉筆丟更快', 2); }
    else if (!g.bossPhase) { for (let i = 0; i < (g.coop ? COOP.reinforcements : CFG.monitor.reinforcements); i++) g.spawnQueue.push(this.L.doors[i % 2]); g.spawnTimer = Math.min(g.spawnTimer, 0.3); g.message('班長去告狀了！', '隔壁班的同學被叫進來了', 2); }
    else g.message('班長去告狀了！', '老師馬上就到', 1.6);
  }
  hitByDart() {
    if (this.state === 'cry') return;
    if (this.rest > 0) { this.state = 'cry'; this.timer = 2.2; this.flash = 0.15; this.path = []; this.setTex('cry'); this.pen.visible = false; this.game.message('班長又被打到了', '她已經告過狀，先哭一下', 1.4); return; }
    this.state = 'cry'; this.timer = 2.2; this.flash = 0.15; this.path = []; this.setTex('cry'); this.pen.visible = false;
    this.game.message('你打到班長了！', '她哭著去找老師', 1.8); Audio.hurt();
    this.addStroke(5 - (this.strokes % 5), '');
  }
  update(dt) {
    if (this.remote) { this.remoteUpdate(dt, this.game.camera.position, this.state !== 'cry'); if (this.state === 'cry') this.mesh.rotation.z = Math.sin(performance.now() / 90) * 0.08; return; }
    const p = this.group.position; this.timer -= dt; this.strokeCd -= dt; this.rest = Math.max(0, this.rest - dt);
    let moving = false;
    // after tattling she goes to the front and stays out of the fight for a while
    if (this.rest > 0 && this.state !== 'cry' && this.state !== 'write') {
      if (Math.hypot(p.x - this.restSpot.x, p.z - this.restSpot.z) > 0.3) { if (this.state !== 'walk' || !this.path.length) { this.path = this.world.path(p, this.restSpot); this.state = 'walk'; } }
      else { this.state = 'pause'; this.timer = 1; this.path = []; }
    }
    if (this.state === 'cry') { this.mesh.rotation.z = Math.sin(performance.now() / 90) * 0.08; if (this.timer <= 0) { this.state = 'pause'; this.timer = 0.5; this.setTex('normal'); } }
    else if (this.state === 'write') { if (this.timer <= 0) { this.state = 'pause'; this.timer = 0.3; this.pen.visible = false; } }
    else if (this.state === 'walk') {
      if (this.path.length) {
        const t = this.path[0], dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz), sp = CFG.monitor.speed * dt;
        if (dist < sp || dist < 0.08) { p.x = t.x; p.z = t.z; this.path.shift(); } else { p.x += dx / dist * sp; p.z += dz / dist * sp; }
        moving = true;
      } else { this.state = 'pause'; this.timer = rand(1, 2.5); }
    } else if (this.timer <= 0 && this.rest <= 0) {
      const pp = pick(this.game.activeTargets()).pos;
      const hx = this.L.w / 2 - 0.8, hz = this.L.d / 2 - 0.6;
      const tx = Math.random() < 0.5 ? clamp(pp.x + rand(-3, 3), -hx, hx) : rand(-hx, hx), tz = Math.random() < 0.5 ? clamp(pp.z + rand(-3, 3), -hz, hz) : rand(-hz, hz);
      this.path = this.world.path(p, { x: tx, z: tz }); this.state = 'walk';
    }
    this.face(this.game.camera.position); this.tick(dt, moving);
  }
  testHit(pos) { if (this.state === 'cry') return false; return Math.hypot(pos.x - this.group.position.x, pos.z - this.group.position.z) < 0.38 && pos.y > 0 && pos.y < 1.4; }
  dispose() { this.world.setTally(0); super.dispose(); }
}
