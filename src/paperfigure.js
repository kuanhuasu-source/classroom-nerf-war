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
    this.flash = 0; this.wobble = 0; this.dim = 1;
  }
  // a ring at the feet says which side this figure is on: red enemies, blue teammates, grey bystanders
  team(color) {
    if (!this.ringMesh) { this.ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })); this.ringMesh.rotation.x = -Math.PI / 2; this.ringMesh.position.y = 0.02; this.group.add(this.ringMesh); }
    else this.ringMesh.material.color.setHex(color);
    this.ringMesh.visible = true;
  }
  // out of the fight (knocked out, sitting, leaving): pale and see-through, no ring
  fade(on) { this.dim = on ? 0.72 : 1; this.mat.opacity = on ? 0.5 : 1; if (this.ringMesh) this.ringMesh.visible = !on; }
  // a short speech bubble over the head (哎唷！) — textures are shared per text
  yelp(text, dur = 0.9) {
    PaperFigure.yelps = PaperFigure.yelps || {};
    if (!PaperFigure.yelps[text]) {
      const c = Draw.canvas(320, 120), ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 6; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(10, 10, 300, 80, 22); else ctx.rect(10, 10, 300, 80); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(140, 88); ctx.lineTo(160, 116); ctx.lineTo(180, 88); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b2622'; ctx.font = 'bold 40px Iansui, "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 160, 52);
      PaperFigure.yelps[text] = Draw.tex(c);
    }
    if (!this.yelpSprite) { this.yelpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: PaperFigure.yelps[text], transparent: true, depthTest: false })); this.yelpSprite.scale.set(1.2, 0.45, 1); this.yelpSprite.position.set(0.15, this.h + 0.6, 0); this.group.add(this.yelpSprite); }
    else { this.yelpSprite.material.map = PaperFigure.yelps[text]; this.yelpSprite.material.needsUpdate = true; }
    this.yelpSprite.visible = true; this.yelpT = dur;
  }
  // a foam dart left sticking out of the paper where it hit, for a couple of seconds (three at most)
  stickDart(y = null) {
    PaperFigure.stuckGeo = PaperFigure.stuckGeo || new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8); PaperFigure.stuckMat = PaperFigure.stuckMat || new THREE.MeshBasicMaterial({ color: 0xf28a1a }); PaperFigure.stuckTip = PaperFigure.stuckTip || new THREE.MeshBasicMaterial({ color: 0x2f6fd1 });
    this.stuck = this.stuck || [];
    if (this.stuck.length >= 3) { const old = this.stuck.shift(); this.mesh.remove(old.m); }
    const m = new THREE.Mesh(PaperFigure.stuckGeo, PaperFigure.stuckMat); m.rotation.x = Math.PI / 2 + rand(-0.5, 0.5); m.rotation.z = rand(-0.5, 0.5);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), PaperFigure.stuckTip); tip.position.y = 0.08; m.add(tip);
    m.position.set(rand(-0.16, 0.16), y === null ? this.h * rand(0.45, 0.9) : clamp(y, 0.2, this.h - 0.1), 0.07); this.mesh.add(m); this.stuck.push({ m, t: 2.5 });
  }
  setTexture(canvas) { this.tex.dispose(); this.tex = Draw.tex(canvas); this.mat.map = this.tex; this.mat.needsUpdate = true; }
  face(camPos) { const dx = camPos.x - this.group.position.x, dz = camPos.z - this.group.position.z; this.group.rotation.y = Math.atan2(dx, dz); }
  tick(dt, moving) {
    if (this.yelpT > 0) { this.yelpT -= dt; if (this.yelpT <= 0 && this.yelpSprite) this.yelpSprite.visible = false; }
    if (this.stuck && this.stuck.length) { for (let i = this.stuck.length - 1; i >= 0; i--) { this.stuck[i].t -= dt; if (this.stuck[i].t <= 0) { this.mesh.remove(this.stuck[i].m); this.stuck.splice(i, 1); } } }
    if (this.flash > 0) { this.flash -= dt; const f = clamp(this.flash / 0.15, 0, 1); this.mat.color.setRGB(1 + f * 1.5, 1 + f * 0.6, 1 + f * 0.6); } else this.mat.color.setRGB(this.dim, this.dim, this.dim);
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
