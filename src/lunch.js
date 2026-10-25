import * as THREE from 'three';
import { CFG, LUNCH, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';
import { PaperFigure } from './paperfigure.js';

// ============================================================
//  午餐大作戰 (two-player corridor run)
//  Cart: pushed by the driver, ridden by the shooter. Host-authoritative; the guest keeps a smoothed replica.
//  LunchKid: a door kid (peeks out of a classroom door and throws) or a grabber (chases the cart and scoops the lunch).
//  LunchMode: phases (out → load → back), the timer, the soup, roles, spawning, win and loss.
// ============================================================

export class Cart {
  constructor(game, start) {
    this.game = game; this.world = game.world;
    this.pos = new THREE.Vector3(start.x, 0, start.z); this.heading = start.heading || 0; this.v = 0;
    this.loaded = false; this.soup = 100; this.shake = 0; this.inSplash = false;
    this.group = new THREE.Group(); game.scene.add(this.group); this.build();
  }
  build() {
    const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: this.world.gradient });
    const inked = (m) => { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), this.world.inkMat)); m.castShadow = true; return m; };
    const body = inked(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), toon(0xb8c0c8))); body.position.y = 0.5; this.group.add(body);
    const top = inked(new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.06, 0.84), toon(0xdde3e8))); top.position.y = 0.78; this.group.add(top);
    const shelf = inked(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.8), toon(0xdde3e8))); shelf.position.y = 0.22; this.group.add(shelf);
    for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), toon(0x2b2622)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.1, z); this.group.add(w); }
    for (const z of [-0.3, 0.3]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), toon(0x7a8794)); post.position.set(-0.62, 0.95, z); this.group.add(post); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), toon(0xd8432b)); bar.rotation.x = Math.PI / 2; bar.position.set(-0.62, 1.2, 0); this.group.add(bar);
    // the lunch: a soup pot and a rice tub, shown once loaded
    this.load = new THREE.Group(); this.load.visible = false; this.group.add(this.load);
    const pot = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.3, 16), toon(0xcfd8dc))); pot.position.set(0.22, 0.96, 0); this.load.add(pot);
    this.lid = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 16), toon(0xeeeeee))); this.lid.position.set(0.22, 1.13, 0); this.load.add(this.lid);
    this.broth = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16), toon(0xf4b27a)); this.broth.position.set(0.22, 1.1, 0); this.load.add(this.broth);
    const tub = inked(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.5), toon(0xf4e27a))); tub.position.set(-0.25, 0.94, 0); this.load.add(tub);
    const rice = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.44), toon(0xffffff)); rice.position.set(-0.25, 1.1, 0); this.load.add(rice);
    this.sync();
  }
  forward() { return new THREE.Vector3(Math.cos(this.heading), 0, Math.sin(this.heading)); }
  // where the two riders stand: the driver behind the handle, the shooter on the top shelf
  pose(role) { const f = this.forward(); return role === 'driver' ? new THREE.Vector3(this.pos.x - f.x * 1.0, this.pos.y, this.pos.z - f.z * 1.0) : new THREE.Vector3(this.pos.x + f.x * 0.05, this.pos.y + 0.82, this.pos.z + f.z * 0.05); }
  sync() { this.group.position.copy(this.pos); this.group.rotation.y = -this.heading; this.load.visible = this.loaded; if (this.loaded) { const k = clamp(this.soup / 100, 0, 1); this.broth.position.y = 0.84 + 0.26 * k; this.broth.visible = k > 0.02; } if (this.shake > 0) this.group.rotation.z = Math.sin(performance.now() / 30) * 0.05 * this.shake; else this.group.rotation.z = 0; }
  // host physics. input: { f: -1..1 (push/brake), t: -1..1 (turn) }
  step(dt, input) {
    const P = this.loaded ? LUNCH.cart.loaded : LUNCH.cart.empty, f = clamp(input.f || 0, -1, 1), t = clamp(input.t || 0, -1, 1);
    if (f > 0) this.v += P.accel * f * dt; else if (f < 0) this.v -= P.brake * -f * dt; else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), LUNCH.cart.drag * dt);
    this.v = clamp(this.v, -1.0, P.max);
    this.inSplash = this.world.buckets.some(b => Math.hypot(this.pos.x - b.x, this.pos.z - b.z) < b.splashR);
    let turn = P.turn * (this.inSplash ? 0.5 : 1);
    if (Math.abs(this.v) > 0.05) this.heading += t * turn * dt * Math.sign(this.v) * Math.min(1, Math.abs(this.v) / 1.2 + 0.3);
    if (this.inSplash && this.loaded && Math.abs(t) > 0.3 && Math.abs(this.v) > 1.5) this.spill(LUNCH.soup.splash * Math.abs(t) * (Math.abs(this.v) / P.max) * dt, 'splash'); // sliding through a puddle while turning fast
    const fw = this.forward(), want = this.pos.clone().addScaledVector(fw, this.v * dt);
    // a bucket in the way gets knocked over (then it is only a puddle)
    for (let i = 0; i < this.world.buckets.length; i++) { const b = this.world.buckets[i]; if (b.knocked) continue; if (Math.hypot(want.x - b.x, want.z - b.z) < LUNCH.cart.radius + 0.3 && Math.abs(this.v) > 1) { if (this.local) { this.v *= 0.5; continue; } this.world.knockBucket(i); this.game.onBucket(i); if (this.loaded) this.spill(LUNCH.soup.bucket, 'bucket'); this.v *= 0.5; this.shake = Math.max(this.shake, 0.6); } }
    const before = want.clone(); this.world.collideCircle(want, LUNCH.cart.radius);
    const corr = before.distanceTo(want);
    if (corr > 0.02) { // ran into a wall or furniture
      if (Math.abs(this.v) > 2) { if (!this.local) { if (this.loaded) this.spill(Math.min(LUNCH.soup.impactMax, Math.abs(this.v) * LUNCH.soup.impactMul), 'impact'); Audio.thud(); this.game.netEvent({ t: 'sfx', n: 'thud' }); } this.shake = 1; this.v = 0; }
      else this.v *= 0.3;
    }
    this.pos.copy(want); this.pos.y = this.world.heightAt(want.x, want.z);
    this.shake = Math.max(0, this.shake - dt);
    this.sync();
  }
  spill(n, why) { if (!this.loaded || n <= 0 || this.local) return; this.soup = Math.max(0, this.soup - n); this.game.onSpill(n, why); }
  // guest replica: glide to the host's state
  applyState(s, stamp) {
    this.target = s; this.loaded = !!s.ld; this.soup = s.sp; if (!this.predicting) this.v = s.v;
    if (!this.gotFirst) { this.gotFirst = true; this.pos.set(s.x, 0, s.z); this.heading = s.h; }
    if (stamp !== undefined && stamp !== null) { this.hist = this.hist || []; const last = this.hist[this.hist.length - 1]; if (!last || stamp > last.t) this.hist.push({ t: stamp, x: s.x, z: s.z, h: s.h }); if (this.hist.length > 16) this.hist.shift(); }
  }
  static lerpAngle(a, b, f) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; }
  // the rider who is not steering: draw the cart a little behind the newest sample, between two samples, like every other remote figure
  smooth(dt) {
    this.predicting = false; const s = this.target; if (!s) return;
    const h = this.hist;
    if (h && h.length >= 2 && PaperFigure.renderTime) {
      const rt = PaperFigure.renderTime(), last = h[h.length - 1]; let x, z, hd;
      if (rt >= last.t) { const a = h[h.length - 2], span = Math.max(1, last.t - a.t), f = Math.min(rt - last.t, 80) / span; x = last.x + (last.x - a.x) * f; z = last.z + (last.z - a.z) * f; hd = Cart.lerpAngle(last.h, last.h + (last.h - a.h), f); }
      else { let i = h.length - 1; while (i > 0 && h[i - 1].t > rt) i--; if (i === 0) { x = h[0].x; z = h[0].z; hd = h[0].h; } else { const a = h[i - 1], b = h[i], f = (rt - a.t) / Math.max(1, b.t - a.t); x = a.x + (b.x - a.x) * f; z = a.z + (b.z - a.z) * f; hd = Cart.lerpAngle(a.h, b.h, f); } }
      this.pos.x = x; this.pos.z = z; this.heading = hd;
    } else {
      const k = Math.min(1, dt * 12); this.pos.x += (s.x - this.pos.x) * k; this.pos.z += (s.z - this.pos.z) * k; this.heading = Cart.lerpAngle(this.heading, s.h, k);
    }
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z); this.shake = s.sh || 0; this.sync();
  }
  // the guest who is steering: run the same physics locally from their own keys so the cart answers at once,
  // and lean toward the host's state (pushed forward by the lag) so the two never drift apart
  predict(dt, input) {
    this.predicting = true; this.local = true; this.step(dt, input); this.local = false;
    const s = this.target; if (!s) return;
    const lag = ((this.game.net && this.game.net.rtt) || 0) / 2000 + 0.05, hx = s.x + Math.cos(s.h) * s.v * lag, hz = s.z + Math.sin(s.h) * s.v * lag;
    const ex = hx - this.pos.x, ez = hz - this.pos.z, err = Math.hypot(ex, ez);
    if (err > 2.5) { this.pos.x = hx; this.pos.z = hz; this.heading = s.h; this.v = s.v; }
    else { const k = Math.min(1, dt * 2.5); this.pos.x += ex * k; this.pos.z += ez * k; this.heading = Cart.lerpAngle(this.heading, s.h, k * 0.6); this.v += (s.v - this.v) * k * 0.5; }
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z); this.sync();
  }
  serialize() { return { x: +this.pos.x.toFixed(2), z: +this.pos.z.toFixed(2), h: +this.heading.toFixed(3), v: +this.v.toFixed(2), ld: this.loaded ? 1 : 0, sp: Math.round(this.soup), sh: +this.shake.toFixed(2) }; }
  dispose() { this.game.scene.remove(this.group); }
}

// A kid of the lunch run. kind 'door': lives at a classroom door, peeks out and throws when the cart is near.
// kind 'grab': runs after the cart and scoops the lunch out of the pot until shot three times.
export class LunchKid extends PaperFigure {
  constructor(game, opts) {
    const v = opts.v || { ...Draw.kidVariant(), ...(opts.kind === 'grab' ? { shirt: '#ffffff', grab: true } : {}) };
    super(game.scene, () => Draw.kid(v, 'normal'), 0.9, 1.35);
    this.game = game; this.world = game.world; this.v = v; this.kind = opts.kind || v.kind || 'door'; v.kind = this.kind;
    this.id = opts.id ?? game.nextId(); this.remote = !!opts.remote;
    this.door = opts.door || null; // { x, z, nx, nz, name }
    this.hp = this.kind === 'grab' ? LUNCH.grabber.hp : LUNCH.kid.hp; this.alive = true; this.texState = 'normal';
    this.state = this.kind === 'grab' ? 'chase' : 'hidden'; this.timer = this.kind === 'grab' ? 0 : rand(0.2, 1.0); this.shots = 0; this.shotT = 0; this.path = []; this.pathT = 0; this.stun = 0; this.scared = 0;
    const at = opts.at || (this.door ? { x: this.door.x, z: this.door.z } : { x: 0, z: 0 });
    this.group.position.set(at.x, this.world.heightAt(at.x, at.z), at.z);
    if (!LunchKid.alertTex) LunchKid.alertTex = Draw.tex(Draw.alertIcon());
    this.alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: LunchKid.alertTex, transparent: true, depthTest: false })); this.alert.scale.set(0.28, 0.42, 1); this.alert.position.set(0, 1.75, 0); this.alert.visible = false; this.group.add(this.alert);
    if (this.kind === 'grab') { if (!LunchKid.grabTag) LunchKid.grabTag = Draw.tex(Draw.nameTag('搶菜王', '#d8432b', '#ffffff')); const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: LunchKid.grabTag, transparent: true, depthTest: false })); tag.scale.set(0.7, 0.2, 1); tag.position.set(0, 1.55, 0); this.group.add(tag); this.tag = tag; }
    this.group.visible = this.kind === 'grab'; this.team(0xd8432b);
    if (this.remote) this.state = 'remote';
  }
  setTex(st) { if (this.texState === st) return; this.texState = st; this.setTexture(Draw.kid(this.v, st)); }
  serialize(withVariant) { const p = this.group.position; const a = [this.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +this.group.scale.y.toFixed(2), this.texState, this.alive ? 1 : 0, this.group.visible ? 1 : 0, this.alert.visible ? 1 : 0, this.flash > 0 ? 1 : 0]; if (withVariant || this.age === undefined || this.age < 1.2) a.push(this.v); return a; }
  static unpack(a) { return { id: a[0], x: a[1], y: a[2], z: a[3], sy: a[4], st: a[5], a: a[6], vis: a[7], al: a[8], f: a[9], v: a[10] }; }
  applyState(s) { this.setTarget(s.x, s.y, s.z); if (this.alive && !s.a) this.fade(true); this.alive = !!s.a; const prev = this.texState; this.setTex(s.st); if (prev !== s.st) { if (s.st === 'hurt') Audio.hitEnemy(); else if (s.st === 'out') Audio.out(); } this.group.scale.y = s.sy; this.group.visible = !!s.vis; this.alert.visible = !!s.al; if (s.f && this.flash <= 0) this.flash = 0.15; }
  eye() { return new THREE.Vector3(this.group.position.x, this.group.position.y + 1.1 * this.group.scale.y, this.group.position.z); }
  nearestTarget() { const list = this.game.activeTargets(), p = this.group.position; let best = list[0], bd = 1e9; for (const t of list) { const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z); if (d < bd) { bd = d; best = t; } } return best; }
  canSee(t) { const from = this.eye(), to = t.eyePos ? t.eyePos() : new THREE.Vector3(t.pos.x, t.pos.y + 1.2, t.pos.z); return from.distanceTo(to) < 14 && !this.world.segmentBlocked(from, to); }
  fireAt(target) {
    const from = this.eye(); from.y -= 0.15; const to = target.eyePos ? target.eyePos() : new THREE.Vector3(target.pos.x, target.pos.y + 1.2, target.pos.z); to.y -= 0.25;
    const dir = to.clone().sub(from), dist = dir.length(), speed = this.game.diff.dartSpeed || CFG.enemy.dartSpeed;
    dir.y += dist * dist * CFG.gun.gravity / (2 * speed * speed);
    const spread = CFG.enemy.spread * this.game.diff.spread * (this.shots === 0 ? this.game.diff.firstShotMul : 1);
    dir.normalize().add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))).normalize();
    from.addScaledVector(dir, 0.5);
    const d = this.game.darts.fire(from, dir, speed, 'enemy'); d.shooter = this; this.shots++; Audio.enemyPew();
  }
  // the horn: a door kid ducks back for a while, a grabber jumps back and is dazed
  scare(cart) {
    if (this.kind === 'door') { if (this.state !== 'hidden' && this.alive) { this.hide(); this.scared = LUNCH.horn.scare; } return; }
    const p = this.group.position, dx = p.x - cart.pos.x, dz = p.z - cart.pos.z, l = Math.hypot(dx, dz) || 1;
    const np = p.clone(); np.x += dx / l * LUNCH.horn.push; np.z += dz / l * LUNCH.horn.push; this.world.collideCircle(np, 0.25); p.copy(np); p.y = this.world.heightAt(p.x, p.z);
    this.stun = 1.0; this.state = 'chase'; this.flash = 0.15;
  }
  hide() { this.state = 'hidden'; this.group.visible = false; this.alert.visible = false; this.timer = rand(2.0, 3.0); const d = this.door; this.group.position.set(d.x, this.world.heightAt(d.x, d.z), d.z); }
  update(dt) {
    this.age = (this.age || 0) + dt;
    if (this.remote) { this.remoteUpdate(dt, this.game.camera.position, this.alive && this.state !== 'hidden'); return; }
    const L = this.game.lunchMode, cart = L.cart, p = this.group.position;
    if (!this.alive) { this.tick(dt, false); this.face(this.game.camera.position); return; }
    this.timer -= dt; this.stun = Math.max(0, this.stun - dt); this.scared = Math.max(0, this.scared - dt);
    const target = this.nearestTarget();
    if (this.kind === 'door') {
      const near = Math.hypot(cart.pos.x - this.door.x, cart.pos.z - this.door.z) < LUNCH.kid.trigger;
      if (this.state === 'hidden') { if (near && this.timer <= 0 && this.scared <= 0) { this.state = 'peek'; this.group.visible = true; this.timer = 0.35; this.shotsLeft = 1 + Math.floor(Math.random() * 2); this.alert.visible = true; } }
      else if (this.state === 'peek') { // step out of the door
        const d = this.door, ox = d.x + d.nx * LUNCH.kid.peekOut, oz = d.z + d.nz * LUNCH.kid.peekOut; p.x += (ox - p.x) * Math.min(1, dt * 8); p.z += (oz - p.z) * Math.min(1, dt * 8);
        if (this.timer <= 0) { this.alert.visible = false; if (this.canSee(target)) { this.state = 'throw'; this.shotT = 0.1; } else { this.hide(); } }
      } else if (this.state === 'throw') {
        this.shotT -= dt;
        if (this.shotT <= 0) { this.fireAt(target); this.shotsLeft--; this.shotT = 0.45; if (this.shotsLeft <= 0) this.hide(); }
        if (!near) this.hide();
      } else if (this.state === 'hurt') { if (this.timer <= 0) { this.setTex('normal'); this.hide(); } }
      this.tick(dt, this.state === 'peek'); this.face(this.game.camera.position); return;
    }
    // grabber
    if (this.stun > 0 || this.state === 'hurt') { if (this.state === 'hurt' && this.timer <= 0) { this.setTex('normal'); this.state = 'chase'; } this.tick(dt, false); this.face(this.game.camera.position); return; }
    const dc = Math.hypot(cart.pos.x - p.x, cart.pos.z - p.z);
    if (dc < LUNCH.grabber.reach + LUNCH.cart.radius) { // at the cart: scoop
      this.state = 'grab'; this.alert.visible = true; L.onGrab(this, dt);
      this.tick(dt, true); this.face(this.game.camera.position); return;
    }
    this.state = 'chase'; this.alert.visible = false;
    this.pathT -= dt;
    if (this.pathT <= 0) { this.pathT = 0.5; this.path = this.world.path(p, { x: cart.pos.x, z: cart.pos.z }); }
    const goal = this.path.length ? this.path[0] : cart.pos;
    const dx = goal.x - p.x, dz = goal.z - p.z, dist = Math.hypot(dx, dz), sp = LUNCH.grabber.speed * dt;
    if (dist < sp || dist < 0.1) { p.x = goal.x; p.z = goal.z; if (this.path.length) this.path.shift(); } else { p.x += dx / dist * sp; p.z += dz / dist * sp; }
    this.world.collideCircle(p, 0.2); p.y = this.world.heightAt(p.x, p.z);
    this.tick(dt, true); this.face(this.game.camera.position);
  }
  // a player's dart landed: true when this knocked the kid out
  hit() {
    this.hp--; this.flash = 0.15; this.game.addScore(CFG.score.hit); this.game.hitmark();
    if (this.hp <= 0) { this.alive = false; this.setTex('out'); this.alert.visible = false; this.group.visible = true; this.group.scale.y = 0.6; this.fade(true); Audio.out(); this.game.addScore(CFG.score.out); if (this.tag) this.tag.visible = false; return true; }
    this.setTex('hurt'); this.state = 'hurt'; this.timer = 0.6; return false;
  }
}

export class LunchMode {
  constructor(game) {
    this.game = game; const L = game.world.layout;
    this.cart = new Cart(game, L.cartStart);
    this.kids = []; this.phase = 'out'; this.loadT = 0; this.timeLeft = LUNCH.time; this.driver = 'host'; this.hornCd = 0; this.broadcast = false; this.grabbing = 0; this.spawned = new Set(); this.msgT = 0; this.kills = 0;
    if (game.isHost) this.arm('out');
  }
  shooterSlot() { const other = this.game.remoteList()[0]; return this.driver === 'host' ? (other ? other.slot : 'g1') : 'host'; }
  roleOf(slot) { return slot === this.driver ? 'driver' : 'shooter'; }
  pose(slot) { return this.cart.pose(this.roleOf(slot)); }
  // door kids for a phase: knocked-out ones are swept away, the phase's doors get fresh kids
  arm(phase) {
    const L = this.game.world.layout, doors = L.doors2.filter(d => (L.phaseDoors[phase] || []).includes(d.name));
    for (const k of this.kids) k.dispose(); this.kids = [];
    for (const d of doors) this.kids.push(new LunchKid(this.game, { kind: 'door', door: d }));
  }
  spawnGrabber(at) { const k = new LunchKid(this.game, { kind: 'grab', at }); this.kids.push(k); this.game.message('搶菜王衝出來了！', '他會貼著車挖菜，射手回頭', 2); Audio.tattle(); this.game.netEvent({ t: 'sfx', n: 'tattle' }); }
  onGrab(kid, dt) { this.grabbing = 0.2; if (this.cart.loaded) this.cart.spill(LUNCH.soup.grab * dt, 'grab'); }
  horn(slot) {
    if (slot !== this.driver || this.hornCd > 0) return false;
    this.hornCd = LUNCH.horn.cd; Audio.whistle(); this.game.netEvent({ t: 'sfx', n: 'whistle' }); this.game.message('叭叭！', '', 0.8);
    const c = this.cart, f = c.forward();
    for (const k of this.kids) { if (!k.alive) continue; const dx = k.group.position.x - c.pos.x, dz = k.group.position.z - c.pos.z, d = Math.hypot(dx, dz); if (d > LUNCH.horn.range + 0.7) continue; const cos = (dx * f.x + dz * f.z) / (d || 1); if (cos < Math.cos(LUNCH.horn.cone) && k.kind === 'door') continue; k.scare(c); }
    return true;
  }
  swap() { this.driver = this.shooterSlot(); this.game.ui.wave(this.game.waveLabel(0)); this.game.message('換手！', this.driver === 'host' ? `${this.game.profile.name || '你'}推車，隊友上車` : '隊友推車，你上車射擊', 2.5); }
  // host step
  step(dt) {
    const g = this.game, L = g.world.layout, c = this.cart;
    this.timeLeft -= dt; g.ui.timer(this.timeLeft); this.hornCd = Math.max(0, this.hornCd - dt); this.grabbing = Math.max(0, this.grabbing - dt);
    if (!this.broadcast && this.timeLeft <= LUNCH.time - LUNCH.broadcastAt) { this.broadcast = true; g.message('廣播：午餐時間快到了', '還沒回來的班級動作快', 3); Audio.tattle(); }
    if (this.timeLeft <= 0) { this.timeLeft = 0; return g.onLose(); }
    // driver input
    const drv = this.driver === 'host' ? g.player : g.remoteBySlot(this.driver);
    let input = { f: 0, t: 0 };
    if (drv && !drv.sitting) {
      if (this.driver === 'host') input = g.driveInput();
      else input = drv.cartIn || input;
    }
    c.step(dt, input);
    // the riders follow the cart
    for (const pl of g.players()) { const pose = this.pose(pl.slot || 'host'); if (pl === g.player) { pl.pos.copy(pose); } else { pl.pos.copy(pose); pl.clearHist(); pl.target = null; } }
    // phases
    if (this.phase === 'out') {
      const dk = Math.hypot(c.pos.x - L.kitchen.x, c.pos.z - L.kitchen.z);
      if (dk < L.kitchen.r && Math.abs(c.v) < 0.6 && this.grabbing <= 0) {
        if (this.loadT === 0) { g.message('到蒸飯室了！停好，裝菜中……', '守住 10 秒', 2); this.arm('load'); }
        this.loadT += dt; const tick = Math.ceil(LUNCH.loadSeconds - this.loadT); if (tick !== this.loadTick) { this.loadTick = tick; if (tick > 0 && tick < LUNCH.loadSeconds) g.ui.message(`裝菜中 ${tick}`, '車不要動，搶菜王來了就打', 1.1); }
        if (this.loadT >= LUNCH.loadSeconds) { c.loaded = true; c.soup = 100; this.phase = 'back'; this.swap(); this.arm('back'); g.refillShooter(); setTimeout(() => g.message('裝好了！推回六年二班', '車變重了，轉彎要提前，撞到會灑湯', 3), 2600); }
        if (!this.spawned.has('load') && this.loadT > 3) { this.spawned.add('load'); const d = L.grabberSpawns.load; this.spawnGrabber({ x: d[0], z: d[1] }); }
      } else if (this.loadT > 0 && dk > L.kitchen.r + 0.5) { this.loadT = 0; g.message('車跑出裝菜區了', '推回圈圈裡重新裝', 1.5); }
    } else if (this.phase === 'back') {
      for (const [key, trig] of Object.entries(L.grabberSpawns.back)) { if (this.spawned.has(key)) continue; if (c.pos.x < trig.when) { this.spawned.add(key); this.spawnGrabber({ x: trig.at[0], z: trig.at[1] }); } }
      if (c.soup <= 0) return g.onLose();
      if (Math.hypot(c.pos.x - L.home.x, c.pos.z - L.home.z) < L.home.r) return g.onWin();
    }
    for (const k of this.kids) k.update(dt);
    g.ui.left(this.kids.filter(k => k.alive && k.group.visible).length);
    if (g.players().every(p => p.sitting)) return g.onLose();
  }
  // a player's dart vs the kids
  hitKid(p, who) {
    for (const k of this.kids) { if (!k.alive || !k.group.visible) continue; const dx = p.x - k.group.position.x, dz = p.z - k.group.position.z, h = 1.35 * k.group.scale.y; if (dx * dx + dz * dz < 0.36 * 0.36 * this.game.hitMul(who) && p.y > k.group.position.y && p.y < k.group.position.y + h) { this.game.lastShooter = who; if (k.hit()) { this.kills++; this.game.stat(who, 'kills'); } this.game.lastShooter = null; return true; } }
    return false;
  }
  // an enemy dart vs the pot
  hitPot(p) { const c = this.cart; if (!c.loaded) return false; const f = c.forward(), dx = p.x - c.pos.x, dz = p.z - c.pos.z, along = dx * f.x + dz * f.z, side = -dx * f.z + dz * f.x; if (Math.abs(along) < 0.65 && Math.abs(side) < 0.45 && p.y > 0.85 && p.y < 1.45) { c.spill(LUNCH.soup.hit, 'dart'); return true; } return false; }
  stars() { const s = this.cart.soup; return s >= LUNCH.stars[0] ? 3 : s >= LUNCH.stars[1] ? 2 : s > 0 ? 1 : 0; }
  serialize() { return { ...this.cart.serialize(), ph: this.phase, dr: this.driver, lt: +this.loadT.toFixed(1), tl: +this.timeLeft.toFixed(1), hc: +this.hornCd.toFixed(1) }; }
  // guest: apply the host's cart and roles
  applyState(s) { this.cart.applyState(s, PaperFigure.stamp); const swapped = this.driver !== s.dr; this.phase = s.ph; this.driver = s.dr; this.timeLeft = s.tl; this.hornCd = s.hc; if (swapped && this.gotRole) this.game.ui.roleLabel(this.roleOf(this.game.mySlot)); this.gotRole = true; }
  dispose() { this.cart.dispose(); for (const k of this.kids) k.dispose(); this.kids = []; }
}
