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
  // Each sample is stamped (PaperFigure.stamp, a local-clock time set by whoever applies the snapshot or input).
  // The figure is drawn PaperFigure.renderTime() ms behind the newest sample, interpolating between the two samples
  // around that moment; with a steady buffer the motion stays even however the packets arrive.
  setTarget(x, y, z, stamp = PaperFigure.stamp) {
    if (!this.target) { this.target = new THREE.Vector3(x, y, z); this.group.position.set(x, y, z); } else this.target.set(x, y, z);
    if (stamp !== undefined && stamp !== null) { if (!this.hist) this.hist = []; const last = this.hist[this.hist.length - 1]; if (!last || stamp > last.t) this.hist.push({ t: stamp, x, y, z }); if (this.hist.length > 16) this.hist.shift(); }
  }
  clearHist() { this.hist = null; }
  remoteUpdate(dt, camPos, wobble = true) {
    if (this.target) {
      const p = this.group.position; let moving = false;
      const h = this.hist;
      if (h && h.length >= 2 && PaperFigure.renderTime) {
        const rt = PaperFigure.renderTime(), last = h[h.length - 1];
        let x, y, z;
        if (rt >= last.t) { // nothing newer yet: glide on a little along the last motion, then hold
          const a = h[h.length - 2], span = Math.max(1, last.t - a.t), f = Math.min(rt - last.t, 80) / span;
          x = last.x + (last.x - a.x) * f; y = last.y + (last.y - a.y) * f; z = last.z + (last.z - a.z) * f;
        } else {
          let i = h.length - 1; while (i > 0 && h[i - 1].t > rt) i--;
          if (i === 0) { x = h[0].x; y = h[0].y; z = h[0].z; }
          else { const a = h[i - 1], b = h[i], f = (rt - a.t) / Math.max(1, b.t - a.t); x = a.x + (b.x - a.x) * f; y = a.y + (b.y - a.y) * f; z = a.z + (b.z - a.z) * f; }
        }
        moving = wobble && Math.abs(x - p.x) + Math.abs(z - p.z) > 0.0006;
        p.set(x, y, z);
      } else {
        const d = this.target.clone().sub(p); moving = wobble && d.lengthSq() > 0.0004;
        p.addScaledVector(d, Math.min(1, dt * 14));
      }
      this.tick(dt, moving);
    }
    this.face(camPos);
  }
  dispose() { this.scene.remove(this.group); this.tex.dispose(); this.mat.dispose(); }
}
PaperFigure.stamp = undefined; PaperFigure.renderTime = null;
