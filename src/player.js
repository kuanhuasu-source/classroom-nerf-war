import * as THREE from 'three';
import { COOP, TOILET, CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { freshUp } from './upgrades.js';
import { Draw } from './draw.js';

// ============================================================
//  Player
// ============================================================
export class Player {
  constructor(game) {
    this.game = game; this.camera = game.camera; this.world = game.world;
    const st = this.world.layout.start; this.pos = new THREE.Vector3(st.x, this.world ? this.world.heightAt(st.x, st.z) : 0, st.z); this.yaw = st.yaw; this.pitch = 0; this.eye = CFG.player.eye;
    this.up = freshUp(); this.maxHp = CFG.player.hp; this.wet = 0;
    this.hp = CFG.player.hp; this.ammo = CFG.gun.mag; this.reserve = CFG.gun.reserveStart; this.reloading = 0; this.reloadTotal = 1; this.emptyTime = 0; this.fireCd = 0; this.crouching = false;
    this.keys = {}; this.shots = 0; this.hits = 0; this.hurtCd = 0;
    this.sitting = false; this.sitT = 0; this.invuln = 0; this.seat = null; this.sitTick = -1;
    this.buildGun();
  }
  buildGun() {
    const g = new THREE.Group(); const t = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: this.world.gradient });
    const ink = (m) => { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), this.world.inkMat)); return m; };
    const body = ink(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.34), t(0xf28a1a))); g.add(body);
    const barrel = ink(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), t(0x2f6fd1))); barrel.position.set(0, 0.02, -0.25); g.add(barrel);
    const handle = ink(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.07), t(0x2f6fd1))); handle.position.set(0, -0.11, 0.08); handle.rotation.x = 0.25; g.add(handle);
    const mag = ink(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), t(0xf4e27a))); mag.position.set(0, -0.1, -0.06); g.add(mag); this.magMesh = mag;
    const sight = ink(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.06), t(0xf4e27a))); sight.position.set(0, 0.075, -0.05); g.add(sight);
    const dart = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), t(0xf28a1a)); dart.rotation.x = Math.PI / 2; dart.position.set(0, 0.02, -0.33); g.add(dart); this.loadedDart = dart;
    g.position.set(0.28, -0.26, -0.5); g.rotation.y = -0.08;
    this.gun = g; this.gunBase = g.position.clone(); this.camera.add(g); this.recoil = 0; this.bob = 0;
  }
  magSize() { return CFG.gun.mag + this.up.magBonus; }
  reserveCap() { return CFG.gun.reserveMax + this.up.reserveBonus; }
  eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z); }
  look(dx, dy) { this.yaw -= dx * 0.0022; this.pitch = clamp(this.pitch - dy * 0.0022, -1.4, 1.4); }
  update(dt) {
    const k = this.keys;
    const tc = this.game.touchCtl, tm = tc && tc.on ? tc.move : null;
    this.crouching = !!(k['ControlLeft'] || k['ControlRight'] || k['KeyC'] || (tc && tc.crouch));
    const targetEye = this.sitting ? 0.8 : this.crouching ? CFG.player.crouchEye : CFG.player.eye;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.sitting) this.sitUpdate(dt);
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 10);
    const run = (k['ShiftLeft'] || k['ShiftRight']) && !this.crouching;
    if (this.wet > 0) { this.wet -= dt; if (this.wet <= 0) { this.wet = 0; this.game.ui.wet(false); } }
    const speed = (this.crouching ? CFG.player.crouchSpeed : run ? CFG.player.run : CFG.player.walk) * (this.game.hasBuff('speed') ? CFG.items.speedMul : 1) * (this.wet > 0 ? TOILET.wetSpeed : 1);
    const LM = this.game.lunch ? this.game.lunchMode : null; // 午餐大作戰：兩個人都綁在餐車上
    if (LM) { if (!this.game.isHost) { if (LM.driver === this.game.mySlot && !this.sitting) LM.cart.predict(dt, this.game.driveInput()); else LM.cart.smooth(dt); } this.pos.copy(LM.pose(this.game.mySlot || 'host')); }
    let mx = 0, mz = 0;
    if (k['KeyW'] || k['ArrowUp']) mz -= 1; if (k['KeyS'] || k['ArrowDown']) mz += 1;
    if (k['KeyA'] || k['ArrowLeft']) mx -= 1; if (k['KeyD'] || k['ArrowRight']) mx += 1;
    if (tm && (tm.x || tm.z)) { mx += tm.x; mz += tm.z; }
    const moving = (mx || mz) && !this.sitting && !LM;
    if (moving) {
      const l = Math.hypot(mx, mz); if (l > 1 || !tm) { mx /= l; mz /= l; } // the stick may walk slowly, keys never do
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // forward is -z in camera space rotated by yaw
      const fx = -sin, fz = -cos, rx = cos, rz = -sin;
      this.world.walk(this.pos, (fx * -mz + rx * mx) * speed * dt, (fz * -mz + rz * mx) * speed * dt, CFG.player.radius);
      this.bob += dt * (run ? 13 : 9);
    }
    this.camera.position.set(this.pos.x, this.pos.y + this.eye + (moving ? Math.sin(this.bob) * 0.025 : 0), this.pos.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ'); this.camera.rotation.order = 'YXZ'; this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;
    if (LM && LM.cart.shake > 0) this.camera.rotation.z = Math.sin(performance.now() / 25) * 0.035 * LM.cart.shake; // the cart just hit something
    // gun animation
    this.fireCd -= dt; this.hurtCd -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    const bobX = moving ? Math.sin(this.bob) * 0.01 : 0, bobY = moving ? Math.abs(Math.cos(this.bob)) * 0.01 : 0;
    const reloadDip = this.reloading > 0 ? Math.sin(Math.min(1, (this.reloadTotal - this.reloading) / this.reloadTotal) * Math.PI) * 0.22 : 0;
    this.gun.position.set(this.gunBase.x + bobX, this.gunBase.y + bobY - reloadDip + this.recoil * 0.02, this.gunBase.z + this.recoil * 0.07);
    this.gun.rotation.x = this.recoil * 0.25 - reloadDip * 1.2; this.gun.rotation.z = reloadDip * 0.6;
    this.loadedDart.visible = this.ammo > 0 && this.reloading <= 0;
    if (this.game.siege && this.reserve < this.reserveCap()) { this.reserve = this.reserveCap(); this.game.ui.ammo(this.ammo, this.ammo === 0, this.reserve); } // 守校門：彈藥無限，備用彈永遠是滿的
    if (this.reloading > 0) {
      this.reloading -= dt;
      this.game.ui.reloadProgress(1 - this.reloading / this.reloadTotal);
      if (this.reloading <= 0) {
        const take = Math.min(this.magSize() - this.ammo, this.reserve);
        this.ammo += take; this.reserve -= take; this.game.ui.ammo(this.ammo, this.ammo === 0, this.reserve);
      }
    }
    // auto reload shortly after running dry (unless the player is still holding the trigger)
    if (this.ammo === 0 && this.reloading <= 0) { this.emptyTime += dt; if (this.emptyTime > CFG.gun.autoReloadDelay && !this.firing) this.reload(); } else this.emptyTime = 0;
    // scavenge darts lying around
    const got = this.game.isHost ? this.game.darts.pickupNear(this.pos, CFG.gun.pickupRadius * this.up.pickupMul, this.reserveCap() - this.reserve) : 0;
    if (got > 0) { this.reserve += got; Audio.pickup(); this.game.ui.ammo(this.ammo, this.ammo === 0, this.reserve); this.game.ui.pickFlash(); }
    if (this.firing && !this.sitting) this.tryFire();
  }
  // --- penalty sitting (co-op): knocked out, waiting for a rescue ---
  sitDown(seat, secs = COOP.sitSeconds) {
    this.sitting = true; this.sitT = secs; this.seat = seat; this.pos.set(seat.x, this.world.heightAt(seat.x, seat.z), seat.z); this.keys = {}; this.firing = false; this.reloading = 0; this.gun.visible = false; this.sitTick = -1;
    Audio.out();
  }
  sitUpdate(dt) {
    this.sitT -= dt;
    const tick = Math.ceil(this.sitT);
    if (tick !== this.sitTick) { this.sitTick = tick; this.game.ui.message('被打到了，罰坐中', `${Math.max(0, tick)} 秒後自己站起來，或等隊友走過來按 E`, 1.2); }
    if (this.sitT <= 0 && this.game.isHost) this.standUp(this.game.lunch ? 3 : 1);
  }
  standUp(hp) {
    this.sitting = false; this.hp = hp; this.invuln = COOP.invuln; this.gun.visible = true; this.game.ui.hp(hp, this.maxHp);
    this.game.ui.message(hp > 1 ? '被救起來了！' : '自己站起來了', hp > 1 ? '' : '只剩 1 顆心，小心', 1.5);
  }
  tryFire() {
    if (this.fireCd > 0 || this.sitting) return;
    if (this.game.lunch && this.game.lunchMode && this.game.lunchMode.roleOf(this.game.mySlot || 'host') === 'driver') { this.game.horn(); this.fireCd = 0.3; return; } // the driver's trigger is the horn
    if (this.reloading > 0) {
      if (this.ammo <= 0) return;
      this.reloading = 0; this.game.ui.reloading(false); // firing cancels a partial reload
    }
    if (this.ammo <= 0) {
      Audio.empty(); this.fireCd = 0.3;
      if (this.reserve <= 0) this.game.message('彈匣和備用彈都空了！', '去撿地上的泡棉彈', 1.4);
      return;
    }
    if (!this.game.hasBuff('infinite') && !(this.up.recycle > 0 && Math.random() < this.up.recycle)) this.ammo--;
    this.fireCd = CFG.gun.fireInterval * this.up.fireMul; this.recoil = 1; this.shots++;
    const view = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    // The dart leaves from just in front of the eye, not from the drawn muzzle 28 cm right and 22 cm down: a dart that
    // starts that far off the line of sight clips the desk you are crouching behind although the crosshair sees past it.
    let muzzle = this.camera.localToWorld(new THREE.Vector3(0.1, -0.06, -0.3));
    if (this.world.pointInBox(muzzle)) muzzle = this.camera.position.clone().addScaledVector(view, 0.05);
    // converge on what the crosshair is actually on: the first kid, teacher or piece of furniture along the line of sight
    const dist = Math.max(1.0, this.world.rayDistance(this.camera.position, view, 30, (p) => this.game.aimHit(p)));
    const target = this.camera.position.clone().addScaledVector(view, dist);
    const dir = target.sub(muzzle).normalize();
    const speed = CFG.gun.speed * this.up.speedMul;
    const dirs = [dir]; if (this.up.twin) { const side = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion); dirs.push(dir.clone().addScaledVector(side, 0.035).normalize()); dirs[0] = dir.clone().addScaledVector(side, -0.035).normalize(); }
    for (const dd of dirs) {
      if (this.game.isHost) { const d = this.game.darts.fire(muzzle, dd, speed, 'player'); d.who = 'host'; }
      else if (this.game.transport) { const pv = ++this.game.pvSeq; this.game.darts.firePreview(muzzle, dd, speed, this.game.mySlot, pv); this.game.transport.send(JSON.stringify({ t: 'fire', p: [+muzzle.x.toFixed(3), +muzzle.y.toFixed(3), +muzzle.z.toFixed(3)], d: [+dd.x.toFixed(4), +dd.y.toFixed(4), +dd.z.toFixed(4)], s: +speed.toFixed(1), pv })); }
    }
    Audio.pew();
    if (this.game.monitor && this.game.isHost) this.game.monitor.noticeShot();
    this.game.ui.ammo(this.ammo, this.ammo === 0, this.reserve);
  }
  reload() {
    if (this.reloading > 0 || this.ammo >= this.magSize()) return;
    if (this.reserve <= 0) { Audio.empty(); this.game.message('沒有備用彈了！', '地上的泡棉彈走過去就能撿', 1.6); return; }
    this.reloadTotal = (this.ammo === 0 ? CFG.gun.reloadEmpty : CFG.gun.reloadPartial) * this.up.reloadMul;
    this.reloading = this.reloadTotal; Audio.reload(this.reloadTotal); this.game.ui.reloading(true);
    if (this.reserve <= 5 && !this.lowWarned) { this.lowWarned = true; this.game.message('備用彈快沒了', '撿地上的泡棉彈補充', 2); }
  }
  // an upgrade was picked: apply the instant parts and show it on the gun
  applyUpgrade(u) {
    if (this.up.refill) { this.reserve = Math.min(this.reserveCap(), this.reserve + this.up.refill); this.up.refill = 0; }
    if (this.up.healFull) { this.maxHp = CFG.player.hp + this.up.maxHpBonus; this.hp = this.maxHp; this.up.healFull = false; }
    this.game.ui.hp(this.hp, this.maxHp); this.game.ui.ammo(this.ammo, this.ammo === 0, this.reserve);
    // a sticker on the blaster for every upgrade
    const n = Object.values(this.up.taken).reduce((a, b) => a + b, 0);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshToonMaterial({ color: [0xf4e27a, 0xf7a8c4, 0x9fd3f2, 0xb7e3a1, 0xd8432b, 0xffffff][n % 6], gradientMap: this.world.gradient }));
    st.position.set(0.05, 0.03 + (n % 3) * 0.035, 0.1 - Math.floor(n / 3) * 0.08); this.gun.add(st);
  }
  hurt() {
    if (this.hurtCd > 0 || this.sitting || this.invuln > 0) return;
    this.hurtCd = 0.7; this.hp--; Audio.hurt(); this.game.ui.hp(this.hp, this.maxHp); this.game.ui.vignette();
    if (this.hp <= 0) this.game.onPlayerDown(this);
  }
}
