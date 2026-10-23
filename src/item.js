import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';

export class SpecialItem {
  constructor(game, buff, mount, opts = {}) {
    this.game = game; this.buff = buff; this.life = CFG.items.life; this.t = Math.random() * 6;
    this.id = opts.id ?? game.nextId(); this.mi = game.world.layout.mounts.indexOf(mount); this.remote = !!opts.remote;
    const geo = new THREE.PlaneGeometry(0.5, 0.5);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: Draw.tex(Draw.itemIcon(buff.id)), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    this.mesh.position.set(mount.x, mount.y, mount.z); this.mesh.rotation.y = mount.ry;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.36, 24), new THREE.MeshBasicMaterial({ color: 0xf28a1a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.mesh.add(this.ring);
    game.scene.add(this.mesh);
  }
  update(dt) {
    this.t += dt; this.life -= dt;
    const k = 1 + Math.sin(this.t * 4) * 0.06; this.mesh.scale.set(k, k, 1); this.ring.rotation.z = this.t * 1.5;
    if (this.life < 3) this.mesh.visible = Math.floor(this.life * 5) % 2 === 0;
    return this.life > 0;
  }
  serialize() { return { id: this.id, b: this.buff.id, mi: this.mi, life: +this.life.toFixed(1) }; }
  applyState(s) { this.life = s.life; }
  testDart(d) { return d.owner === 'player' && d.mesh.position.distanceTo(this.mesh.position) < CFG.items.hitRadius; }
  dispose() { this.game.scene.remove(this.mesh); }
}
