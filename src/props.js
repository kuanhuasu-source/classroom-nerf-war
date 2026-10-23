import * as THREE from 'three';
import { Audio } from './audio.js';

// Interactive room props. Shoot them.
//   trash: a bin that tips over and releases a stink cloud — students inside cannot see or shoot
//   bucket: the classic prank bucket balanced on the front door — shoot it down and the doorway
//           becomes a puddle; students who walk into it are out at once
export class Prop {
  constructor(game, def, id) {
    this.game = game; this.def = def; this.kind = def.kind; this.id = id; this.world = game.world;
    this.state = 'up'; this.t = 0; this.cool = 0;
    this.group = new THREE.Group(); game.scene.add(this.group);
    const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: this.world.gradient });
    const ink = (m) => { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), this.world.inkMat)); return m; };
    if (this.kind === 'trash') {
      this.pos = new THREE.Vector3(def.x, this.world.heightAt(def.x, def.z), def.z); this.group.position.copy(this.pos);
      const body = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.55, 12), toon(0x7a8794))); body.position.y = 0.275; body.castShadow = true; this.group.add(body);
      const lid = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), toon(0x5a6570))); lid.position.y = 0.57; this.group.add(lid);
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), toon(0xffffff)); paper.position.set(0.05, 0.62, 0); paper.rotation.z = 0.4; this.group.add(paper);
      this.world.collide(def.x, def.z, 0.44, 0.44, this.pos.y + 0.55, this.pos.y); this.world.buildGrid();
    } else {
      const door = this.world.layout.doors[def.door || 0];
      this.pos = new THREE.Vector3(door.x - 0.45, (door.floor || 0) + 2.25, door.z); this.group.position.copy(this.pos);
      const b = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.26, 12), toon(0x2f6fd1))); b.castShadow = true; this.group.add(b);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 12), toon(0x9fd3f2)); water.position.y = 0.12; this.group.add(water);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 16, Math.PI), toon(0x2b2622)); handle.position.y = 0.13; this.group.add(handle);
      this.group.rotation.z = 0.25;
      this.landing = new THREE.Vector3(door.x - 0.7, door.floor || 0, door.z);
    }
  }
  testDart(d) {
    if (this.state !== 'up' || d.owner !== 'player') return false;
    const p = d.mesh.position;
    if (this.kind === 'trash') { if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 0.32 && p.y < 0.7) { this.trigger(d.who); return true; } return false; }
    return p.distanceTo(this.pos) < 0.32 ? (this.trigger(d.who), true) : false;
  }
  trigger(who = 'host') {
    const g = this.game; this.state = 'down'; this.t = 0; this.who = who;
    g.netEvent({ t: 'prop', id: this.id, st: 'down' });
    if (this.kind === 'trash') {
      Audio.thud(); g.netEvent({ t: 'sfx', n: 'thud' });
      g.addZone(this.pos, 1.7, 5, 'stink');
      g.message('垃圾桶倒了，好臭！', '煙霧裡的同學看不到也射不了', 1.8);
      this.cool = 18;
    } else {
      Audio.boing(); g.netEvent({ t: 'sfx', n: 'boing' });
      g.message('水桶掉下來了！', '門口變水坑，走進來的同學直接出局', 2);
    }
  }
  reset() { this.state = 'up'; this.t = 0; this.cool = 0; this.group.rotation.set(0, 0, this.kind === 'bucket' ? 0.25 : 0); this.group.position.copy(this.pos); this.group.visible = true; }
  update(dt) {
    if (this.state === 'up') return;
    this.t += dt;
    if (this.kind === 'trash') {
      const k = Math.min(1, this.t / 0.35); this.group.rotation.z = -1.45 * k; this.group.position.y = 0.0;
      if (this.game.isHost) { this.cool -= dt; if (this.cool <= 0) { this.reset(); this.game.netEvent({ t: 'prop', id: this.id, st: 'up' }); } }
    } else {
      const k = Math.min(1, this.t / 0.45);
      this.group.position.lerpVectors(this.pos, new THREE.Vector3(this.landing.x, 0.13, this.landing.z), k); this.group.rotation.z = 0.25 + k * 2.4;
      if (k >= 1 && !this.spilled) { this.spilled = true; if (this.game.isHost) { const z = this.game.addZone(this.landing, 1.15, 6, 'water'); if (z) z.who = this.who; } }
    }
  }
  applyState(st) { if (st === 'down' && this.state === 'up') { this.state = 'down'; this.t = 0; this.spilled = true; } else if (st === 'up' && this.state !== 'up') this.reset(); }
  dispose() { this.game.scene.remove(this.group); }
}
