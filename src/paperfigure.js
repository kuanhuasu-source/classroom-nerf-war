import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';

// ============================================================
//  Paper figure base
// ============================================================
export class PaperFigure {
  constructor(scene, canvasFn, w, h) {
    this.scene = scene; this.w = w; this.h = h; this.canvasFn = canvasFn;
    this.tex = Draw.tex(canvasFn());
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.castShadow = true;
    this.group = new THREE.Group(); this.group.add(this.mesh); scene.add(this.group);
    this.flash = 0; this.wobble = 0;
  }
  setTexture(canvas) { this.tex.dispose(); this.tex = Draw.tex(canvas); this.mat.map = this.tex; this.mat.needsUpdate = true; }
  face(camPos) { const dx = camPos.x - this.group.position.x, dz = camPos.z - this.group.position.z; this.group.rotation.y = Math.atan2(dx, dz); }
  tick(dt, moving) {
    if (this.flash > 0) { this.flash -= dt; const f = clamp(this.flash / 0.15, 0, 1); this.mat.color.setRGB(1 + f * 1.5, 1 + f * 0.6, 1 + f * 0.6); } else this.mat.color.setRGB(1, 1, 1);
    if (moving) { this.wobble += dt * 11; this.mesh.rotation.z = Math.sin(this.wobble) * 0.09; this.mesh.position.y = Math.abs(Math.sin(this.wobble)) * 0.05; }
    else { this.mesh.rotation.z *= 0.85; this.mesh.position.y *= 0.85; }
  }
  // --- remote mode: the figure is driven by snapshots and glides toward the last known spot ---
  setTarget(x, y, z) { if (!this.target) { this.target = new THREE.Vector3(x, y, z); this.group.position.set(x, y, z); } else this.target.set(x, y, z); }
  remoteUpdate(dt, camPos, wobble = true) {
    if (this.target) {
      const p = this.group.position, d = this.target.clone().sub(p), moving = wobble && d.lengthSq() > 0.0004;
      p.addScaledVector(d, Math.min(1, dt * 14));
      this.tick(dt, moving);
    }
    this.face(camPos);
  }
  dispose() { this.scene.remove(this.group); this.tex.dispose(); this.mat.dispose(); }
}
