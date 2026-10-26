import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';

// ============================================================
//  Darts (foam darts + chalk)
// ============================================================
export class Darts {
  constructor(scene, world) {
    this.scene = scene; this.world = world; this.list = []; this.seq = 0; this.byId = new Map(); this.localWho = 'host';
    this.restVersion = 0; // bumps whenever the set of darts lying around changes
    this.settledQ = []; this.removedQ = []; // per-tick deltas for the guest
    const geo = new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8); geo.rotateX(Math.PI / 2);
    this.geo = geo;
    this.matOrange = new THREE.MeshToonMaterial({ color: 0xf28a1a, gradientMap: world.gradient });
    this.matBlue = new THREE.MeshToonMaterial({ color: 0x2f6fd1, gradientMap: world.gradient });
    this.matChalk = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: world.gradient });
    this.tipGeo = new THREE.SphereGeometry(0.032, 8, 8);
    this.chalkGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.11, 6); this.chalkGeo.rotateX(Math.PI / 2);
    this.ballGeo = new THREE.SphereGeometry(0.18, 14, 10); this.matBall = new THREE.MeshToonMaterial({ map: Draw.tex(Draw.ballTex()), gradientMap: world.gradient });
    this.tubeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8); this.tubeGeo.rotateX(Math.PI / 2); this.matTube = new THREE.MeshToonMaterial({ color: 0x9fe3c8, transparent: true, opacity: 0.85, gradientMap: world.gradient });
    this.eraserGeo = new THREE.BoxGeometry(0.16, 0.05, 0.07); this.eraserBackGeo = new THREE.BoxGeometry(0.16, 0.025, 0.07); this.matFelt = new THREE.MeshToonMaterial({ color: 0x4a4440, gradientMap: world.gradient }); this.matWood = new THREE.MeshToonMaterial({ color: 0xb98556, gradientMap: world.gradient });
    this.noteMat = new THREE.SpriteMaterial({ map: Draw.tex(Draw.noteIcon()), transparent: true, depthTest: true });
    this.planeMat = new THREE.SpriteMaterial({ map: Draw.tex(Draw.planeIcon()), transparent: true, depthTest: true });
    this.speechMats = ['不要跑', '認真點', '要有禮貌', '校長的話'].map(t => new THREE.SpriteMaterial({ map: Draw.tex(Draw.speechIcon(t)), transparent: true, depthTest: true }));
  }
  fire(pos, dir, speed, owner, kind = 'dart') {
    let mesh;
    if (kind === 'chalk') { mesh = new THREE.Mesh(this.chalkGeo, this.matChalk); }
    else if (kind === 'ball') { mesh = new THREE.Mesh(this.ballGeo, this.matBall); }
    else if (kind === 'tube') { mesh = new THREE.Mesh(this.tubeGeo, this.matTube); const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 8), this.matChalk); cork.rotation.x = Math.PI / 2; cork.position.z = 0.09; mesh.add(cork); }
    else if (kind === 'eraser') { mesh = new THREE.Mesh(this.eraserGeo, this.matFelt); const back = new THREE.Mesh(this.eraserBackGeo, this.matWood); back.position.y = 0.037; mesh.add(back); }
    else if (kind === 'note') { mesh = new THREE.Sprite(this.noteMat); mesh.scale.set(0.36, 0.36, 1); }
    else if (kind === 'plane') { mesh = new THREE.Sprite(this.planeMat); mesh.scale.set(0.4, 0.4, 1); }
    else if (kind === 'speech') { mesh = new THREE.Sprite(this.speechMats[Math.floor(Math.random() * this.speechMats.length)]); mesh.scale.set(0.9, 0.45, 1); }
    else if (kind === 'water') { // a splash of mop water: slows whoever it hits
      if (!this.waterMat) this.waterMat = new THREE.MeshToonMaterial({ color: 0x6fb7ef, transparent: true, opacity: 0.8 });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), this.waterMat); mesh.scale.set(1.2, 0.9, 1.4);
    }
    else if (kind === 'plunger') { // a rubber plunger: stick along z with the red cup in front
      if (!this.plungerGeo) { this.plungerGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.34, 6); this.plungerGeo.rotateX(Math.PI / 2); this.cupGeo = new THREE.CylinderGeometry(0.03, 0.075, 0.07, 10); this.cupGeo.rotateX(-Math.PI / 2); this.matRubber = new THREE.MeshToonMaterial({ color: 0xd8432b }); }
      mesh = new THREE.Mesh(this.plungerGeo, this.matWood || this.matChalk); const cup = new THREE.Mesh(this.cupGeo, this.matRubber); cup.position.z = 0.2; mesh.add(cup);
    }
    else {
      mesh = new THREE.Mesh(this.geo, owner === 'player' ? this.matOrange : this.matBlue);
      const tip = new THREE.Mesh(this.tipGeo, owner === 'player' ? this.matBlue : this.matOrange); tip.position.z = 0.08; mesh.add(tip);
    }
    mesh.castShadow = true;
    mesh.position.copy(pos);
    const vel = dir.clone().normalize().multiplyScalar(speed);
    const d = { mesh, vel, owner, kind, life: 3.2, stuck: false, restTime: 0, id: ++this.seq, who: 'host', g: kind === 'note' || kind === 'speech' ? 0 : kind === 'plane' ? 1.5 : kind === 'water' ? 9 : CFG.gun.gravity, r: kind === 'ball' ? 0.2 : kind === 'water' ? 0.12 : 0 };
    this.orient(d);
    this.scene.add(mesh); this.list.push(d);
    return d;
  }
  orient(d) { if (d.kind === 'note' || d.kind === 'speech') { d.mesh.material.rotation = Math.sin(performance.now() / 150) * 0.3; return; } if (d.kind === 'plane') { d.mesh.material.rotation = Math.atan2(d.vel.y, Math.hypot(d.vel.x, d.vel.z)) * 0.5; return; } if (d.vel.lengthSq() > 1e-4) { const t = d.mesh.position.clone().add(d.vel); d.mesh.lookAt(t); } }
  update(dt, hooks) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      if (d.stuck) {
        d.restTime += dt;
        const limit = d.kind === 'dart' ? CFG.gun.floorLife : 2.5;
        if (d.restTime > limit) { this.remove(i); }
        else if (d.kind === 'dart' && d.restTime > limit - 2) { d.mesh.visible = Math.floor(d.restTime * 6) % 2 === 0; } // blink before vanishing
        continue;
      }
      d.life -= dt;
      // sub-step so a fast dart cannot skip over a small target (ball, wall item, a peeking head)
      const n = Math.max(1, Math.ceil(d.vel.length() * dt / 0.15)), sdt = dt / n;
      let done = false;
      for (let k = 0; k < n && !done; k++) {
        d.vel.y -= d.g * sdt;
        if (d.home) { // homing: bend the velocity toward the target, keeping speed
          const sp = d.vel.length(), want = d.home().sub(d.mesh.position).normalize(), cur = d.vel.clone().normalize();
          const ang = cur.angleTo(want); if (ang > 1e-3) { const maxA = d.turn * sdt, axis = cur.clone().cross(want).normalize(); if (axis.lengthSq() > 0.5) { cur.applyAxisAngle(axis, Math.min(ang, maxA)); d.vel.copy(cur.multiplyScalar(sp)); } }
        }
        const prev = d.mesh.position.clone();
        d.mesh.position.addScaledVector(d.vel, sdt);
        this.orient(d);
        const p = d.mesh.position;
        // targets first
        const consumed = hooks(d, prev);
        if (consumed) { this.remove(i); done = true; break; }
        // floor
        const ground = this.world.heightAt(p.x, p.z), floorY = ground + 0.03 + d.r;
        if (p.y < floorY) {
          if (p.y < ground - 0.25) { // came in from the side of a stage or balcony: sticks to the wall like any other wall
            this.settle(d); d.mesh.position.copy(prev);
            if (d.kind !== 'dart') { d.stuck = false; Audio.thud(); this.remove(i); hooks({ kind: d.kind + 'Break', pos: prev }); done = true; break; }
            Audio.thud(); break;
          }
          if (d.kind !== 'dart') { Audio.thud(); this.remove(i); hooks({ kind: d.kind + 'Break', pos: p.clone() }); done = true; break; }
          p.y = ground + 0.03; this.settle(d); d.mesh.rotation.set(0, Math.random() * 6.28, 0); if (d.owner === 'player') Audio.thud(); break;
        }
        const hit = this.world.pointInBox(p) || (this.world.terrain.length && this.world.overCrossed(prev, p) ? 'wall' : null); // the slide's slab counts as a wall from both sides
        if (hit || (d.life <= 0 && k === n - 1)) {
          this.settle(d); d.mesh.position.copy(prev);
          if (hit === 'wall' || (hit && hit.h - hit.y0 > 0.5)) { /* stays stuck where it hit */ } else { d.mesh.position.y = Math.max(this.world.heightAt(prev.x, prev.z) + 0.03, prev.y); }
          if (d.kind !== 'dart') { d.stuck = false; Audio.thud(); this.remove(i); hooks({ kind: d.kind + 'Break', pos: prev }); done = true; break; }
          Audio.thud(); break;
        }
      }
    }
  }
  remove(i) { const d = this.list[i]; if (d.stuck && !d.preview) { this.restVersion++; this.removedQ.push(d.id); } this.scene.remove(d.mesh); if (this.byId.get(d.id) === d) this.byId.delete(d.id); this.list.splice(i, 1); }
  // a dart comes to rest; keep the floor from filling up forever
  settle(d) {
    d.stuck = true; d.restTime = 0; if (d.kind !== 'dart') return; this.restVersion++; this.settledQ.push(d);
    let resting = 0; for (const x of this.list) if (x.stuck && x.kind === 'dart') resting++;
    while (resting > CFG.gun.restCap) { const i = this.list.findIndex(x => x.stuck && x.kind === 'dart' && x !== d); if (i < 0) break; this.remove(i); resting--; }
  }
  // [id, x, y, z, vx, vy, vz, owner, kind, who] for darts in flight
  serializeMoving() {
    const out = [];
    for (const d of this.list) if (!d.stuck) { const p = d.mesh.position, v = d.vel; out.push([d.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1), d.owner, d.kind, d.who, d.pv || 0]); }
    return out;
  }
  // [id, x, y, z, rotY, owner] for a dart lying around
  packResting(d) { const p = d.mesh.position; return [d.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +d.mesh.rotation.y.toFixed(2), d.owner]; }
  serializeResting() { const out = []; for (const d of this.list) if (d.stuck) out.push(this.packResting(d)); return out; }
  // what came to rest / vanished since the last snapshot
  takeDeltas() {
    const settled = this.settledQ.filter(d => d.stuck && this.byId.get(d.id) === d || this.list.includes(d)).map(d => this.packResting(d));
    const removed = this.removedQ.slice();
    this.settledQ = []; this.removedQ = [];
    return { settled, removed };
  }
  // guest side: mirror the host's darts by id.
  //   moving: every dart in flight, every tick; settled/removed: deltas of the floor; full: the whole floor (on connect)
  applyState(moving, settled, removed, full) { this.applyFloor(settled, removed, full); this.applyMoving(moving); }
  // the floor: deltas (settled / removed) ride the reliable channel, the full list only on connect
  applyFloor(settled, removed, full) {
    const rest = (a) => {
      let d = this.byId.get(a[0]);
      if (!d) { d = this.fire(new THREE.Vector3(a[1], a[2], a[3]), new THREE.Vector3(0, 0, 1), 0.01, a[5], 'dart'); d.id = a[0]; this.byId.set(a[0], d); d.restTime = 0; }
      else if (!d.stuck) d.restTime = 0;
      d.stuck = true; d.vel.set(0, 0, 0); d.mesh.position.set(a[1], a[2], a[3]); d.mesh.rotation.set(0, a[4], 0); d.mesh.visible = true; d.hiddenByPreview = false;
      this.dropPreview(a[0]); // our own dart landed for real: the preview has done its job
      return d;
    };
    if (full) {
      const keep = new Set(full.map(a => a[0]));
      for (const a of full) rest(a);
      for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].stuck && !this.list[i].preview && !keep.has(this.list[i].id)) this.remove(i);
    }
    if (settled) for (const a of settled) rest(a);
    if (removed) for (const id of removed) { const d = this.byId.get(id); if (d) { const i = this.list.indexOf(d); if (i >= 0) this.remove(i); } }
  }
  // every dart in flight, every snapshot (fast channel)
  applyMoving(moving) {
    const seen = new Set();
    for (const a of moving) {
      seen.add(a[0]);
      let d = this.byId.get(a[0]);
      if (!d) {
        const vel = new THREE.Vector3(a[4], a[5], a[6]), sp = vel.length() || 0.01;
        d = this.fire(new THREE.Vector3(a[1], a[2], a[3]), sp > 0.02 ? vel : new THREE.Vector3(0, 0, 1), sp, a[7], a[8]);
        d.id = a[0]; d.who = a[9]; this.byId.set(a[0], d);
        if (a[10] && a[9] === this.localWho) { // the host's copy of a dart we already drew: keep showing ours until it lands
          const pre = this.list.find(x => x.preview === a[10]); if (pre) { pre.hostId = a[0]; d.hiddenByPreview = true; }
        }
        if (a[8] === 'chalk') Audio.chalkThrow(); else if (a[7] === 'player') { if (a[9] !== this.localWho) Audio.pew(); } else Audio.enemyPew();
      }
      d.stuck = false; d.mesh.visible = !d.hiddenByPreview; d.mesh.position.set(a[1], a[2], a[3]); d.vel.set(a[4], a[5], a[6]); this.orient(d);
    }
    // a dart in flight that vanished either came to rest (floor delta) or was consumed; previews follow their host copy
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      if (d.preview) { if (d.hostId && !seen.has(d.hostId)) this.remove(i); continue; }
      if (!d.stuck && !seen.has(d.id)) { this.scene.remove(d.mesh); if (this.byId.get(d.id) === d) this.byId.delete(d.id); this.list.splice(i, 1); }
    }
  }
  dropPreview(hostId) { const i = this.list.findIndex(x => x.preview && x.hostId === hostId); if (i >= 0) this.remove(i); }
  // guest: a dart drawn the instant the trigger is pulled, flown with the same physics, swapped for the host's copy when that lands
  firePreview(pos, dir, speed, who, pv) {
    const d = this.fire(pos, dir, speed, 'player'); d.who = who; d.preview = pv; d.id = -(++this.seq); d.born = performance.now(); d.hostId = 0;
    return d;
  }
  stepPreview(d, dt, hitTest) {
    const p = d.mesh.position, n = Math.max(1, Math.ceil(d.vel.length() * dt / 0.15)), sdt = dt / n;
    for (let k = 0; k < n; k++) {
      d.vel.y -= d.g * sdt; const prev = p.clone(); p.addScaledVector(d.vel, sdt); this.orient(d);
      if (hitTest && hitTest(p)) return 'hit';
      const ground = this.world.heightAt(p.x, p.z);
      if (p.y < ground + 0.03) { if (p.y < ground - 0.25) p.copy(prev); else p.y = ground + 0.03; d.stuck = true; d.restTime = 0; return 'rest'; }
      if (this.world.pointInBox(p)) { p.copy(prev); d.stuck = true; d.restTime = 0; return 'rest'; }
    }
    return null;
  }
  remoteUpdate(dt, previewHit = null) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      if (d.preview) {
        if (!d.hostId && performance.now() - d.born > 2500) { this.remove(i); continue; } // never acknowledged: the fire message was lost
        if (d.stuck) { d.restTime += dt; if (d.restTime > 3) this.remove(i); continue; } // a resting preview waits briefly for the host's copy
        if (this.stepPreview(d, dt, previewHit) === 'hit') this.remove(i);
        continue;
      }
      if (d.stuck) { d.restTime += dt; const limit = CFG.gun.floorLife; d.mesh.visible = d.restTime < limit - 2 || Math.floor(d.restTime * 6) % 2 === 0; }
      else { d.vel.y -= d.g * dt; d.mesh.position.addScaledVector(d.vel, dt); this.orient(d); }
    }
  }
  // darts lying on the floor (dropped by a knocked-out student)
  drop(pos, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, r = rand(0.25, 0.7);
      const p = new THREE.Vector3(pos.x + Math.cos(a) * r, 0, pos.z + Math.sin(a) * r); p.y = this.world.heightAt(p.x, p.z) + 0.03;
      if (Math.abs(p.y - 0.03 - (pos.y || 0)) > 0.5 || this.world.pointInBox(p)) continue; // not over the edge of a balcony
      const d = this.fire(p, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 0.01, 'enemy');
      this.settle(d); d.vel.set(0, 0, 0); d.mesh.rotation.set(0, Math.random() * 6.28, 0);
    }
  }
  // pick up resting foam darts near a point; returns how many
  pickupNear(pos, radius, max) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0 && n < max; i--) {
      const d = this.list[i];
      if (!d.stuck || d.kind !== 'dart') continue;
      const p = d.mesh.position;
      if (p.y - (pos.y || 0) < 1.7 && p.y > (pos.y || 0) - 0.6 && Math.hypot(p.x - pos.x, p.z - pos.z) < radius) { this.remove(i); n++; }
    }
    return n;
  }
  clear() { this.list.forEach(d => this.scene.remove(d.mesh)); this.list = []; this.byId.clear(); }
}
