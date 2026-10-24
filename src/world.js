import * as THREE from 'three';
import { CFG, rand, pick, clamp } from './config.js';
import { Draw } from './draw.js';
import { layoutById } from './layouts.js';

// ============================================================
//  World: builds a room from a layout; collision boxes; nav grid
// ============================================================
export class World {
  constructor(scene, layout = 'classroom') {
    this.scene = scene;
    this.layout = typeof layout === 'string' ? layoutById(layout) : layout;
    this.room = { w: this.layout.w, d: this.layout.d, h: this.layout.h };
    this.boxes = [];          // {minX,maxX,minZ,maxZ,h,y0}  (h = top, y0 = bottom)
    this.terrain = this.layout.terrain || []; // platforms and stairs: the floor height is a function of (x,z)
    this.desks = [];          // logical cover entries {x,z,w,d,h,seat:{x,z},occupant,covered}
    this.objects = [];        // everything we add to the scene, so the room can be torn down
    this.gradient = Draw.gradientMap();
    this.inkMat = new THREE.LineBasicMaterial({ color: 0x3a2e2a });
    this.animated = [];
    this.build();
    this.buildGrid();
  }
  tick(dt) { for (const a of this.animated) a(dt); }
  add(o) { this.scene.add(o); this.objects.push(o); return o; }
  dispose() { for (const o of this.objects) this.scene.remove(o); this.objects = []; this.boxes = []; this.desks = []; }
  toon(color) { return new THREE.MeshToonMaterial({ color, gradientMap: this.gradient }); }
  inked(mesh) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), this.inkMat); mesh.add(e); return mesh; }
  collide(x, z, w, d, h, y0 = 0) { this.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h, y0 }); }
  // floor height at a point: 0 on the ground, the platform height on a stage or balcony, in between on stairs
  heightAt(x, z) {
    let h = 0;
    for (const t of this.terrain) {
      if (x < t.x - t.w / 2 || x > t.x + t.w / 2 || z < t.z - t.d / 2 || z > t.z + t.d / 2) continue;
      if (t.kind === 'platform') { if (t.h > h) h = t.h; continue; }
      const along = t.axis === 'x' ? (x - (t.x - t.w / 2)) / t.w : (z - (t.z - t.d / 2)) / t.d;
      const f = t.dir < 0 ? 1 - along : along, th = t.h0 + (t.h1 - t.h0) * Math.min(1, Math.max(0, f));
      if (th > h) h = th;
    }
    return h;
  }
  // move a circle by (dx,dz): a step taller than 0.45 m is a wall (platform edges), the rest slides along boxes
  walk(pos, dx, dz, r) {
    const y = pos.y || 0;
    for (const [ax, v] of [['x', dx], ['z', dz]]) { if (!v) continue; const o = pos[ax]; pos[ax] += v; if (Math.abs(this.heightAt(pos.x, pos.z) - y) > 0.45) pos[ax] = o; }
    this.collideCircle(pos, r); this.collideCircle(pos, r);
    pos.y = this.heightAt(pos.x, pos.z);
  }
  box(w, h, d, x, y, z, color, { collide = true, ink = true, shadow = true, parent = null } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.toon(color));
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
    if (ink) this.inked(m);
    if (parent) parent.add(m); else this.add(m);
    if (collide) this.collide(x, z, w, d, y + h / 2, y - h / 2);
    return m;
  }
  cylinder(r, h, x, y, z, color, { collide = true, parent = null, seg = 16 } = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), this.toon(color));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; this.inked(m);
    if (parent) parent.add(m); else this.add(m);
    if (collide) this.collide(x, z, r * 2, r * 2, y + h / 2, y - h / 2);
    return m;
  }
  build() {
    const L = this.layout, { w, d, h } = this.room, s = this.scene, st = L.style, outdoor = st === 'yard';
    if (!World.indoorBg && s.background) World.indoorBg = s.background.clone();
    s.background = outdoor ? new THREE.Color(0xc9e6ff) : (World.indoorBg || new THREE.Color(0xfbf6e6));
    // floor / ceiling / walls by style
    const floorTex = outdoor ? Draw.tex(Draw.grass(), [w / 3, d / 3]) : st === 'lab' ? Draw.tex(Draw.tiles(), [w / 2, d / 2]) : Draw.tex(Draw.floor(), st === 'gym' ? [w / 2.5, d / 2.5] : [w / 4, d / 4]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: this.gradient }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.add(floor);
    if (!outdoor) { const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshToonMaterial({ color: 0xf3eee0, gradientMap: this.gradient })); ceil.rotation.x = Math.PI / 2; ceil.position.y = h; this.add(ceil); }
    const wallCanvas = st === 'music' ? Draw.staffWall() : Draw.paperWall(st === 'lab' ? '#eef5e8' : st === 'gym' ? '#f6efd9' : outdoor ? '#f3e2c8' : '#fbf6e6');
    const wallMat = new THREE.MeshToonMaterial({ map: Draw.tex(wallCanvas, [w / 4, 1]), gradientMap: this.gradient });
    const wallH = outdoor ? 4.2 : h;
    const mk = (pw, px, pz, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, wallH), wallMat); m.position.set(px, wallH / 2, pz); m.rotation.y = ry; m.receiveShadow = true; this.add(m); };
    if (outdoor) { // the school building along the front, a low fence around the rest, sky everywhere else
      mk(w, 0, -d / 2, 0);
      const winTexB = Draw.tex(Draw.window());
      for (let x = -w / 2 + 2.5; x < w / 2 - 1; x += 3.2) { if (Math.abs(x) < L.board.w / 2 + 1) continue; const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshBasicMaterial({ map: winTexB })); win.position.set(x, 2.3, -d / 2 + 0.03); this.add(win); const fr = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.4, 1.6, 0.06)), this.inkMat); fr.position.set(x, 2.3, -d / 2 + 0.03); this.add(fr); }
      this.box(w, 0.25, 0.3, 0, wallH + 0.12, -d / 2 + 0.1, 0xd8432b, { collide: false }); // roof edge
      this.fence(d, w / 2, 0, Math.PI / 2); this.fence(d, -w / 2, 0, Math.PI / 2); this.fence(w, 0, d / 2, 0);
    } else {
      mk(w, 0, -d / 2, 0); mk(w, 0, d / 2, Math.PI); mk(d, -w / 2, 0, Math.PI / 2); mk(d, w / 2, 0, -Math.PI / 2);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), this.inkMat); edges.position.y = h / 2; this.add(edges);
    }
    // the board on the front wall (chalkboard or whiteboard)
    this.boardStyle = L.board.style;
    this.blackboardMat = new THREE.MeshBasicMaterial({ map: Draw.tex(Draw.blackboard(0, this.boardStyle)) });
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(L.board.w, L.board.h), this.blackboardMat);
    const by = L.boardY || 0;
    bb.position.set(0, 1.65 + by, -d / 2 + 0.06); this.add(bb);
    this.box(L.board.w + 0.3, L.board.h + 0.3, 0.05, 0, 1.65 + by, -d / 2 + 0.02, this.boardStyle === 'chalk' ? 0x7a4a22 : 0xb8c0c8, { collide: false, shadow: false });
    this.box(L.board.w + 0.3, 0.08, 0.14, 0, 0.72 + by, -d / 2 + 0.07, this.boardStyle === 'chalk' ? 0x7a4a22 : 0xb8c0c8, { collide: false });
    // windows (-x wall) and doors (+x wall)
    const winTex = Draw.tex(Draw.window());
    for (const z of L.windows) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), new THREE.MeshBasicMaterial({ map: winTex }));
      const wy = L.windowY || 1.7;
      win.position.set(-w / 2 + 0.03, wy, z); win.rotation.y = Math.PI / 2; this.add(win);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.06, 1.7, 1.6)), this.inkMat); frame.position.set(-w / 2 + 0.03, wy, z); this.add(frame);
    }
    for (const dr of L.doors) {
      if (outdoor) { for (const sz of [-1, 1]) this.box(0.3, 1.6, 0.3, w / 2 - 0.15, 0.8, dr.z + sz * 0.9, 0xb98556, { collide: false }); this.box(0.1, 0.4, 2.1, w / 2 - 0.15, 1.75, dr.z, 0x2f6fd1, { collide: false }); continue; }
      const door = this.box(0.08, 2.1, 1.0, w / 2 - 0.04, 1.05 + (dr.floor || 0), dr.z, 0x8fb98a, { collide: false, shadow: false });
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), this.toon(0xf4e27a)); knob.position.set(-0.06, 0, -0.35); door.add(knob);
    }
    // clock on the front wall
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), this.toon(0xffffff)); clock.position.set(L.board.w / 2 + 0.8, 2.6, -d / 2 + 0.02); this.add(clock);
    clock.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, (_, i) => new THREE.Vector3(Math.cos(i / 24 * 6.283) * 0.28, Math.sin(i / 24 * 6.283) * 0.28, 0))), this.inkMat));
    clock.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.01), new THREE.Vector3(0, 0.2, 0.01), new THREE.Vector3(0, 0, 0.01), new THREE.Vector3(0.14, 0.08, 0.01)]), new THREE.LineBasicMaterial({ color: 0x2b2622 })));
    // platforms and stairs (the floor height comes from heightAt, so these never collide as boxes)
    for (const t of this.terrain) {
      if (t.kind === 'platform') { const m = this.box(t.w, t.h, t.d, t.x, t.h / 2, t.z, t.color || 0xd9c39a, { collide: false }); m.receiveShadow = true; continue; }
      const along = t.axis === 'x' ? t.w : t.d, across = t.axis === 'x' ? t.d : t.w;
      if (t.smooth) { // a slide: one tilted slab with low side rails
        const dh = t.h1 - t.h0, len = Math.hypot(along, dh), ang = Math.atan2(dh, along) * t.dir;
        const slab = this.box(t.axis === 'x' ? len : across, 0.08, t.axis === 'x' ? across : len, t.x, (t.h0 + t.h1) / 2 - 0.02, t.z, t.color || 0xf4c542, { collide: false });
        if (t.axis === 'x') slab.rotation.z = ang; else slab.rotation.x = -ang;
        for (const side of [-1, 1]) { const rail = this.box(t.axis === 'x' ? len : 0.06, 0.22, t.axis === 'x' ? 0.06 : len, t.x + (t.axis === 'x' ? 0 : side * (across / 2 - 0.03)), (t.h0 + t.h1) / 2 + 0.1, t.z + (t.axis === 'x' ? side * (across / 2 - 0.03) : 0), t.railColor || 0xd8432b, { collide: false }); if (t.axis === 'x') rail.rotation.z = ang; else rail.rotation.x = -ang; }
        continue;
      }
      const n = Math.max(2, Math.ceil(Math.abs(t.h1 - t.h0) / 0.2));
      for (let i = 0; i < n; i++) { // each step is a slab from the ground up to its own height, so the side reads as a solid staircase
        const f = (i + 1) / n, top = t.h0 + (t.h1 - t.h0) * f, len = along / n, c = -along / 2 + (i + 0.5) * len;
        const off = t.dir < 0 ? -c : c;
        const x = t.axis === 'x' ? t.x + off : t.x, z = t.axis === 'x' ? t.z : t.z + off;
        this.box(t.axis === 'x' ? len + 0.01 : across, top, t.axis === 'x' ? across : len + 0.01, x, top / 2, z, t.color || 0xc9b48c, { collide: false, ink: i % 2 === 0 });
      }
    }
    // furniture
    for (const f of L.furniture) this.furniture(f);
    // logical cover entries
    for (const dsk of L.desks) this.desks.push({ x: dsk.x, z: dsk.z, w: dsk.w, d: dsk.d, h: dsk.h, floor: dsk.floor || 0, seat: { x: dsk.seat.x, z: dsk.seat.z }, occupant: null, covered: null });
    this.bounds = { minX: -w / 2 + 0.3, maxX: w / 2 - 0.3, minZ: -d / 2 + 0.3, maxZ: d / 2 - 0.3 };
  }
  // a low fence: posts every 2 m and two rails; visual only, the room bounds do the stopping
  fence(len, x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.add(g);
    for (let p = -len / 2; p <= len / 2 + 0.01; p += 2) this.box(0.1, 1.1, 0.1, p, 0.55, 0, 0xffffff, { collide: false, parent: g });
    this.box(len, 0.06, 0.05, 0, 0.95, 0, 0xffffff, { collide: false, parent: g }); this.box(len, 0.06, 0.05, 0, 0.5, 0, 0xffffff, { collide: false, parent: g });
  }
  // ---- one piece of furniture ----
  furniture(f) {
    const d = this.room.d, fl = f.floor || 0;
    switch (f.kind) {
      case 'swing': { // an A-frame with two seats that sway
        const g = new THREE.Group(); g.position.set(f.x, 0, f.z); this.add(g);
        for (const sx of [-1, 1]) { for (const sz of [-1, 1]) { const leg = this.cylinder(0.05, 2.5, sx * 1.4, 1.25, sz * 0.5, 0x2f6fd1, { collide: false, parent: g, seg: 8 }); leg.rotation.x = sz * 0.2; } this.collide(f.x + sx * 1.4, f.z, 0.4, 1.2, 2.5); }
        const bar = this.cylinder(0.05, 3.0, 0, 2.45, 0, 0x2f6fd1, { collide: false, parent: g, seg: 8 }); bar.rotation.z = Math.PI / 2;
        [-0.5, 0.5].forEach((sx, i) => {
          const pivot = new THREE.Group(); pivot.position.set(sx, 2.45, 0); g.add(pivot);
          for (const rx of [-0.22, 0.22]) this.cylinder(0.012, 1.9, rx, -0.95, 0, 0x5a4e47, { collide: false, parent: pivot, seg: 6 });
          this.box(0.5, 0.05, 0.22, 0, -1.9, 0, 0xd8432b, { collide: false, parent: pivot });
          const phase = i * 1.3; this.animated.push((dt) => { pivot.userData.t = (pivot.userData.t || 0) + dt; pivot.rotation.x = Math.sin(pivot.userData.t * 1.4 + phase) * 0.35; });
        });
        return;
      }
      case 'pond': { // an oval pond: water, rim, lily pads, reeds; three boxes keep feet dry
        const water = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshToonMaterial({ color: 0x6fb7ef, transparent: true, opacity: 0.85, gradientMap: this.gradient })); water.rotation.x = -Math.PI / 2; water.scale.set(f.w / 2, f.d / 2, 1); water.position.set(f.x, 0.02, f.z); this.add(water);
        const rim = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.08, 36), this.toon(0x8a7a66)); rim.rotation.x = -Math.PI / 2; rim.scale.set(f.w / 2, f.d / 2, 1); rim.position.set(f.x, 0.03, f.z); this.add(rim);
        for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + 0.4, pad = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.1, 12), this.toon(0x4f9a3f)); pad.rotation.x = -Math.PI / 2; pad.position.set(f.x + Math.cos(a) * f.w * 0.3, 0.04, f.z + Math.sin(a) * f.d * 0.3); this.add(pad); }
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, rx = f.x + Math.cos(a) * (f.w / 2 + 0.15), rz = f.z + Math.sin(a) * (f.d / 2 + 0.15); this.cylinder(0.02, 0.9 + Math.random() * 0.4, rx, 0.5, rz, 0x6b8f3a, { collide: false, seg: 6 }); }
        this.collide(f.x, f.z, f.w, f.d * 0.5, 0.35); this.collide(f.x, f.z, f.w * 0.7, f.d * 0.85, 0.35); this.collide(f.x, f.z, f.w * 0.4, f.d, 0.35);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: Draw.tex(Draw.nameTag('生態池', '#fbf6e6', '#2b2622')), transparent: true })); sign.position.set(f.x + f.w / 2 + 0.5, 0.9, f.z - f.d / 2 - 0.2); this.add(sign); this.cylinder(0.03, 0.8, f.x + f.w / 2 + 0.5, 0.4, f.z - f.d / 2 - 0.22, 0xb98556, { collide: false, seg: 6 });
        return;
      }
      case 'tire': { // a half-buried tyre
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 10, 20), this.toon(0x2b2622)); t.position.set(f.x, 0.1, f.z); t.rotation.y = f.ry || 0; t.castShadow = true; this.inked(t); this.add(t);
        this.collide(f.x, f.z, 0.9, 0.34, 0.55); return;
      }
      case 'sandbox': { // a square of sand with a wooden border and a bucket
        const sand = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), this.toon(0xf0dca8)); sand.rotation.x = -Math.PI / 2; sand.position.set(f.x, 0.015, f.z); this.add(sand);
        for (const [dx, dz, bw, bd] of [[0, f.d / 2, f.w, 0.12], [0, -f.d / 2, f.w, 0.12], [f.w / 2, 0, 0.12, f.d], [-f.w / 2, 0, 0.12, f.d]]) this.box(bw, 0.18, bd, f.x + dx, 0.09, f.z + dz, 0xb98556, { collide: false });
        this.cylinder(0.14, 0.18, f.x + 0.6, 0.09, f.z - 0.4, 0xd8432b, { collide: false, seg: 10 }); return;
      }
      case 'tree': { // a trunk you can hide behind and a round canopy
        this.cylinder(0.22, 2.4, f.x, 1.2, f.z, 0x8a5a2b, { seg: 10 });
        for (const [dx, dy, dz, r] of [[0, 3.0, 0, 1.3], [0.8, 2.6, 0.4, 0.9], [-0.7, 2.7, -0.5, 0.95], [0.2, 3.6, -0.6, 0.8]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), this.toon(f.color || 0x5fa84a)); c.position.set(f.x + dx, dy, f.z + dz); c.castShadow = true; this.add(c); }
        return;
      }
      case 'flag': { // a flagpole on its little platform (the platform itself is terrain)
        this.cylinder(0.05, 5.0, f.x, (f.floor || 0) + 2.5, f.z, 0xe8e8e8, { seg: 8 });
        const flag = this.box(0.9, 0.6, 0.02, f.x + 0.47, (f.floor || 0) + 4.6, f.z, 0xd8432b, { collide: false }); this.box(0.6, 0.3, 0.025, f.x + 0.47, (f.floor || 0) + 4.6, f.z, 0xffffff, { collide: false, ink: false });
        this.animated.push((dt) => { flag.userData.t = (flag.userData.t || 0) + dt; flag.rotation.y = Math.sin(flag.userData.t * 2.2) * 0.25; });
        return;
      }
      case 'track': { // a strip of running track with lane lines
        const tr = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), this.toon(0xd8714a)); tr.rotation.x = -Math.PI / 2; tr.position.set(f.x, 0.012, f.z); tr.receiveShadow = true; this.add(tr);
        for (let i = 0; i <= 4; i++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(f.w, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff })); ln.rotation.x = -Math.PI / 2; ln.position.set(f.x, 0.016, f.z - f.d / 2 + i * f.d / 4); this.add(ln); }
        return;
      }
      case 'rail': { // low wall along a balcony edge: cover for the kids upstairs, a backboard for darts from below
        this.box(f.w, 0.7, f.d, f.x, fl + 0.35, f.z, 0xe4d7b4); this.box(f.w + 0.1, 0.06, f.d + 0.12, f.x, fl + 0.73, f.z, 0xb98556, { collide: false });
        return;
      }
      case 'gymbench': { // a long wooden bench; knocked-out kids sit on it
        this.box(f.w, 0.06, f.d, f.x, fl + f.h - 0.03, f.z, 0xdcc39a, { collide: false });
        for (const sx of [-1, 1]) this.box(0.06, f.h - 0.06, f.d - 0.04, f.x + sx * (f.w / 2 - 0.2), fl + (f.h - 0.06) / 2, f.z, 0x7a8794, { collide: false, ink: false });
        this.collide(f.x, f.z, f.w, f.d, fl + f.h, fl);
        return;
      }
      case 'vault': { // a vaulting box: stacked layers
        for (let i = 0; i < 4; i++) this.box(f.w - i * 0.08, f.h / 4, f.d - i * 0.08, f.x, fl + f.h / 8 + i * f.h / 4, f.z, i % 2 ? 0xd9a86c : 0xb98556, { collide: false });
        this.box(f.w - 0.3, 0.06, f.d - 0.3, f.x, fl + f.h + 0.03, f.z, 0x5d8ad6, { collide: false }); this.collide(f.x, f.z, f.w, f.d, fl + f.h, fl);
        return;
      }
      case 'cart': { // a ball cart
        this.box(f.w, f.h - 0.2, f.d, f.x, fl + 0.2 + (f.h - 0.2) / 2, f.z, 0x7a8794);
        for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), this.toon(pick([0xd8432b, 0xf4e27a, 0x5d8ad6]))); b.position.set(f.x + rand(-0.35, 0.35), fl + f.h + 0.05, f.z + rand(-0.2, 0.2)); this.add(b); }
        return;
      }
      case 'mat': { // a stack of gym mats
        for (let i = 0; i < 3; i++) this.box(f.w, f.h / 3, f.d, f.x, fl + f.h / 6 + i * f.h / 3, f.z, i % 2 ? 0x5d8ad6 : 0x4a6fb3, { collide: false });
        this.collide(f.x, f.z, f.w, f.d, fl + f.h, fl); return;
      }
      case 'speaker': { this.box(f.w, f.h, f.d, f.x, fl + f.h / 2, f.z, 0x2b2622); this.cylinder(0.18, 0.02, f.x, fl + f.h * 0.6, f.z + f.d / 2, 0x7a8794, { collide: false, seg: 14 }).rotation.x = Math.PI / 2; return; }
      case 'banner': { // a cloth banner hanging on a wall
        const m = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), new THREE.MeshBasicMaterial({ map: Draw.tex(Draw.banner(f.text || '歡迎')) })); m.position.set(f.x, f.y, f.z); m.rotation.y = f.ry || 0; this.add(m); return;
      }
      case 'podium': return this.box(f.w, f.h, f.d, f.x, fl + f.h / 2, f.z, 0xb98556);
      case 'desk': return this.deskAndChair(f.x, f.z);
      case 'cupboard': return this.box(f.w, f.h, f.d, f.x, f.h / 2, f.z, 0xa88a68);
      case 'bulletin': {
        this.box(3.4, 1.2, 0.04, f.x, 1.7, f.z, 0xd9a86c, { collide: false, shadow: false });
        [[-1.0, 1.9, 0xf7a8c4], [-0.1, 1.6, 0x9fd3f2], [0.9, 1.85, 0xf4e27a]].forEach(([dx, y, c]) => this.box(0.6, 0.75, 0.02, f.x + dx, y, f.z - 0.025, c, { collide: false, shadow: false }));
        return;
      }
      case 'bench': { // lab bench with a sink and a gas tap
        const g = new THREE.Group(); g.position.set(f.x, 0, f.z); this.add(g);
        const top = this.box(f.w, 0.08, f.d, 0, f.h - 0.04, 0, 0x2f3a3a, { collide: false, parent: g });
        this.box(f.w - 0.2, f.h - 0.08, f.d - 0.2, 0, (f.h - 0.08) / 2, 0, 0xd9d2c0, { collide: false, parent: g });
        if (!f.teacher) { this.box(0.4, 0.06, 0.3, f.w / 2 - 0.4, f.h + 0.03, 0, 0xcfd8dc, { collide: false, parent: g }); this.cylinder(0.02, 0.25, f.w / 2 - 0.55, f.h + 0.12, 0.1, 0xb8b8b8, { collide: false, parent: g, seg: 8 }); }
        [[-0.3, 0xb7e3a1], [0.1, 0x9fd3f2], [0.5, 0xf7a8c4]].forEach(([dx, c]) => this.cylinder(0.05, 0.16, dx - 0.4, f.h + 0.08, -0.25, c, { collide: false, parent: g, seg: 10 }));
        this.collide(f.x, f.z, f.w, f.d, f.h);
        return;
      }
      case 'stool': { this.cylinder(0.18, 0.04, f.x, 0.6, f.z, 0x5d8ad6, { collide: false }); this.cylinder(0.03, 0.58, f.x, 0.29, f.z, 0x7a8794, { collide: false, seg: 8 }); this.collide(f.x, f.z, 0.32, 0.32, 0.62); return; }
      case 'cabinet': { // lab chemicals or music instruments
        const m = this.box(f.w, f.h, f.d, f.x, f.h / 2, f.z, this.layout.style === 'lab' ? 0xe8e2cc : 0xb98556);
        if (this.layout.style === 'lab') for (let i = 0; i < 6; i++) this.cylinder(0.07, 0.2, f.x - f.w / 2 + 0.25 + i * 0.26, f.h + 0.1, f.z, pick([0xb7e3a1, 0x9fd3f2, 0xf7a8c4, 0xf4e27a, 0xd8432b]), { collide: false, seg: 10 });
        else { const nb = this.box(f.w - 0.3, 0.05, 0.3, f.x, f.h + 0.03, f.z, 0x2b2622, { collide: false }); this.cylinder(0.12, 0.5, f.x + f.w / 2 - 0.3, f.h + 0.25, f.z, 0xf28a1a, { collide: false, seg: 12 }); }
        return m;
      }
      case 'hood': { this.box(f.w, f.h, f.d, f.x, f.h / 2, f.z, 0xc9d1d6); this.box(f.w - 0.2, 0.9, 0.04, f.x, 1.35, f.z - f.d / 2 - 0.01, 0x9fd3f2, { collide: false, shadow: false }); return; }
      case 'sink': { this.box(f.w, f.h, f.d, f.x, f.h / 2, f.z, 0xcfd8dc); for (let i = 0; i < 3; i++) this.cylinder(0.02, 0.3, f.x - f.w / 2 + 0.5 + i * 1.0, f.h + 0.15, f.z + 0.1, 0xb8b8b8, { collide: false, seg: 8 }); return; }
      case 'skeleton': {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.7), new THREE.MeshBasicMaterial({ map: Draw.tex(Draw.skeleton()), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
        plane.position.set(f.x, 1.05, f.z); plane.rotation.y = Math.PI / 4; this.add(plane);
        this.cylinder(0.3, 0.06, f.x, 0.03, f.z, 0x5a4e47, { collide: false }); this.collide(f.x, f.z, 0.5, 0.5, 1.9);
        return;
      }
      case 'poster': {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), new THREE.MeshBasicMaterial({ map: Draw.tex(Draw.poster(f.style)) }));
        m.position.set(f.x, 1.9, f.z - 0.02); m.rotation.y = Math.PI; this.add(m);
        return;
      }
      case 'chair': { // a lone chair facing ry
        const g = new THREE.Group(); g.position.set(f.x, 0, f.z); g.rotation.y = f.ry || 0; this.add(g);
        const seat = this.box(0.4, 0.04, 0.4, 0, 0.42, 0, 0x5d8ad6, { collide: false, parent: g });
        this.box(0.4, 0.4, 0.04, 0, 0.64, 0.18, 0x5d8ad6, { collide: false, parent: g });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => this.box(0.03, 0.42, 0.03, sx * 0.17, 0.21, sz * 0.17, 0x7a8794, { collide: false, ink: false, parent: g }));
        this.collide(f.x, f.z, 0.36, 0.36, 0.44);
        return;
      }
      case 'piano': {
        this.box(f.w, 0.3, f.d, f.x, f.h - 0.15, f.z, 0x2b2622);
        [[-1, -1], [1, -1], [-1, 1]].forEach(([sx, sz]) => this.box(0.08, f.h - 0.3, 0.08, f.x + sx * (f.w / 2 - 0.1), (f.h - 0.3) / 2, f.z + sz * (f.d / 2 - 0.1), 0x2b2622, { collide: false }));
        this.box(f.w * 0.8, 0.04, 0.3, f.x, f.h, f.z + f.d / 2 - 0.15, 0xffffff, { collide: false });
        const lid = this.box(f.w * 0.9, 0.04, f.d * 0.8, f.x, f.h + 0.3, f.z - 0.2, 0x2b2622, { collide: false }); lid.rotation.x = -0.5;
        return;
      }
      case 'timpani': { this.cylinder(0.5, 0.7, f.x, 0.5, f.z, 0xb98556); this.cylinder(0.52, 0.04, f.x, f.h, f.z, 0xfbf6e6, { collide: false }); return; }
      case 'drum': { this.cylinder(0.3, 0.5, f.x, 0.45, f.z, 0xd8432b); this.cylinder(0.32, 0.04, f.x, f.h - 0.08, f.z, 0xfbf6e6, { collide: false }); this.cylinder(0.2, 0.3, f.x + 0.5, 0.35, f.z + 0.3, 0xf4e27a); return; }
      case 'conductor': { this.box(1.0, 0.2, 1.0, f.x, 0.1, f.z, 0xb98556, { collide: false }); this.cylinder(0.02, 1.2, f.x, 0.8, f.z, 0x7a8794, { collide: false, seg: 8 }); this.box(0.5, 0.4, 0.03, f.x, 1.4, f.z + 0.1, 0x2b2622, { collide: false }); this.collide(f.x, f.z, 0.3, 0.3, 1.6); return; }
    }
  }
  deskAndChair(x, z) {
    const DESK = { w: 0.62, d: 0.46, h: 0.72 };
    const g = new THREE.Group(); g.position.set(x, 0, z); this.add(g);
    const top = new THREE.Mesh(new THREE.BoxGeometry(DESK.w, 0.05, DESK.d), this.toon(0xdcc39a)); top.position.y = DESK.h - 0.025; top.castShadow = true; top.receiveShadow = true; this.inked(top); g.add(top);
    const legMat = this.toon(0x7a8794), chairMat = this.toon(0x5d8ad6);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, DESK.h - 0.05, 0.04), legMat); leg.position.set(sx * (DESK.w / 2 - 0.04), (DESK.h - 0.05) / 2, sz * (DESK.d / 2 - 0.04)); g.add(leg); });
    const nb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.3), this.toon(pick([0xf7a8c4, 0x9fd3f2, 0xb7e3a1, 0xf4e27a]))); nb.position.set(rand(-0.12, 0.12), DESK.h + 0.008, rand(-0.05, 0.05)); nb.rotation.y = rand(-0.4, 0.4); this.inked(nb); g.add(nb);
    const seatZ = 0.48;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), chairMat); seat.position.set(0, 0.42, seatZ); this.inked(seat); seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.04), chairMat); back.position.set(0, 0.64, seatZ + 0.18); this.inked(back); g.add(back);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.03), legMat); leg.position.set(sx * 0.17, 0.21, seatZ + sz * 0.17); g.add(leg); });
    this.collide(x, z, DESK.w, DESK.d, DESK.h);
    this.collide(x, z + (DESK.d / 2 + seatZ + 0.2) / 2, 0.4, seatZ + 0.2 - DESK.d / 2, 0.44); // chair box runs from the desk's back edge to the chair back
  }
  setTally(n) { const old = this.blackboardMat.map; this.blackboardMat.map = Draw.tex(Draw.blackboard(n, this.boardStyle)); this.blackboardMat.needsUpdate = true; if (old) old.dispose(); }
  buildGrid() {
    this.cell = 0.3;
    this.gw = Math.round(this.room.w / this.cell); this.gh = Math.round(this.room.d / this.cell);
    this.grid = new Uint8Array(this.gw * this.gh); this.gridH = new Float32Array(this.gw * this.gh);
    const pad = 0.2;
    for (let gz = 0; gz < this.gh; gz++) for (let gx = 0; gx < this.gw; gx++) {
      const { x, z } = this.cellCenter(gx, gz), hc = this.heightAt(x, z); this.gridH[gz * this.gw + gx] = hc;
      let blocked = Math.abs(x) > this.room.w / 2 - 0.35 || Math.abs(z) > this.room.d / 2 - 0.35;
      if (!blocked) for (const b of this.boxes) {
        if (b.h < hc + 0.3 || b.y0 > hc + 1.4) continue; // below the feet or above the head at this floor level
        if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) { blocked = true; break; }
      }
      this.grid[gz * this.gw + gx] = blocked ? 1 : 0;
    }
    // pockets of free cells that cannot be reached from the door side are useless to the AI: seal them
    const st = this.layout.start, sc = this.nearestFree(st.x, st.z), seen = new Uint8Array(this.gw * this.gh), q = [sc.gz * this.gw + sc.gx]; seen[q[0]] = 1;
    for (let head = 0; head < q.length; head++) { const c = q[head], cx = c % this.gw, cz = (c / this.gw) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, nz = cz + dz; if (!this.free(nx, nz) || !this.stepOk(c, nz * this.gw + nx)) continue; const ni = nz * this.gw + nx; if (!seen[ni]) { seen[ni] = 1; q.push(ni); } } }
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === 0 && !seen[i]) this.grid[i] = 1;
  }
  cellOf(x, z) { return { gx: clamp(Math.floor((x + this.room.w / 2) / this.cell), 0, this.gw - 1), gz: clamp(Math.floor((z + this.room.d / 2) / this.cell), 0, this.gh - 1) }; }
  cellCenter(gx, gz) { return { x: -this.room.w / 2 + (gx + 0.5) * this.cell, z: -this.room.d / 2 + (gz + 0.5) * this.cell }; }
  free(gx, gz) { return gx >= 0 && gz >= 0 && gx < this.gw && gz < this.gh && this.grid[gz * this.gw + gx] === 0; }
  stepOk(i, j) { return Math.abs(this.gridH[i] - this.gridH[j]) <= 0.45; }
  nearestFree(x, z) {
    const c = this.cellOf(x, z);
    if (this.free(c.gx, c.gz)) return c;
    for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      if (this.free(c.gx + dx, c.gz + dz)) return { gx: c.gx + dx, gz: c.gz + dz };
    }
    return c;
  }
  // BFS path between world points; returns array of {x,z}
  path(from, to) {
    const a = this.nearestFree(from.x, from.z), b = this.nearestFree(to.x, to.z);
    const n = this.gw * this.gh, prev = new Int32Array(n).fill(-1), q = [a.gz * this.gw + a.gx];
    const start = q[0], goal = b.gz * this.gw + b.gx; prev[start] = start;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let head = 0, found = start === goal;
    while (head < q.length && !found) {
      const cur = q[head++], cx = cur % this.gw, cz = (cur / this.gw) | 0;
      for (const [dx, dz] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.free(nx, nz)) continue;
        if (dx && dz && (!this.free(cx + dx, cz) || !this.free(cx, cz + dz))) continue; // no corner cutting
        const ni = nz * this.gw + nx;
        if (prev[ni] !== -1 || !this.stepOk(cur, ni)) continue;
        prev[ni] = cur; q.push(ni);
        if (ni === goal) { found = true; break; }
      }
    }
    if (!found) return [];
    const out = [];
    for (let i = goal; i !== start; i = prev[i]) { const c = this.cellCenter(i % this.gw, (i / this.gw) | 0); out.push(c); }
    out.reverse();
    // string-pull a little: drop waypoints when the straight segment is free
    const pulled = [];
    let cur = { x: from.x, z: from.z };
    for (let i = 0; i < out.length; i++) {
      const nxt = out[i + 1];
      if (!nxt || !this.segmentFree(cur, nxt)) { pulled.push(out[i]); cur = out[i]; }
    }
    return pulled;
  }
  segmentFree(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), steps = Math.ceil(len / (this.cell * 0.5));
    let last = -1;
    for (let i = 0; i <= steps; i++) { const t = i / steps, c = this.cellOf(a.x + dx * t, a.z + dz * t); if (!this.free(c.gx, c.gz)) return false; const ci = c.gz * this.gw + c.gx; if (last >= 0 && !this.stepOk(last, ci)) return false; last = ci; }
    return true;
  }
  // push a circle (x,z,r) out of boxes and bounds
  collideCircle(pos, r, ignoreLow = 0) {
    pos.x = clamp(pos.x, this.bounds.minX, this.bounds.maxX); pos.z = clamp(pos.z, this.bounds.minZ, this.bounds.maxZ);
    const py = pos.y || 0;
    for (const b of this.boxes) {
      if (b.h <= py + ignoreLow || b.y0 > py + 1.4) continue;
      const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x += dx / d * (r - d); pos.z += dz / d * (r - d); }
        else { // inside: push out along smallest penetration
          const px = Math.min(pos.x - b.minX, b.maxX - pos.x), pz = Math.min(pos.z - b.minZ, b.maxZ - pos.z);
          if (px < pz) pos.x += (pos.x - (b.minX + b.maxX) / 2 > 0 ? 1 : -1) * (px + r); else pos.z += (pos.z - (b.minZ + b.maxZ) / 2 > 0 ? 1 : -1) * (pz + r);
        }
      }
    }
  }
  pointInBox(p) {
    if (Math.abs(p.x) > this.room.w / 2 - 0.05 || Math.abs(p.z) > this.room.d / 2 - 0.05) return 'wall';
    if (p.y > this.room.h - 0.05) return 'wall';
    for (const b of this.boxes) if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ && p.y < b.h && p.y > b.y0) return b;
    if (this.terrain.length && p.y < this.heightAt(p.x, p.z) - 0.02) return 'wall';
    return null;
  }
  // march along a ray until something solid; used to converge the dart on the crosshair
  // extra(p): optional test for things that are not part of the room (kids, teachers), so the crosshair converges on them
  rayDistance(origin, dir, maxDist = 30, extra = null) {
    const p = origin.clone(), step = 0.1;
    for (let d = step; d < maxDist; d += step) {
      p.copy(origin).addScaledVector(dir, d);
      if (p.y < this.heightAt(p.x, p.z) || this.pointInBox(p) || (extra && extra(p))) return d;
    }
    return maxDist;
  }
  // 3D segment vs AABB (slab test) — used for line-of-sight
  segmentBlocked(p0, p1) {
    if (this.terrain.length) { // a stage or a balcony body is solid
      const n = Math.ceil(p0.distanceTo(p1) / 0.3) || 1;
      for (let i = 1; i < n; i++) { const t = i / n, x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t, z = p0.z + (p1.z - p0.z) * t; if (y < this.heightAt(x, z) - 0.03) return true; }
    }
    for (const b of this.boxes) {
      let tmin = 0, tmax = 1;
      const mins = [b.minX, b.y0, b.minZ], maxs = [b.maxX, b.h, b.maxZ], o = [p0.x, p0.y, p0.z], d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z];
      let hit = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mins[i] || o[i] > maxs[i]) { hit = false; break; } continue; }
        let t1 = (mins[i] - o[i]) / d[i], t2 = (maxs[i] - o[i]) / d[i];
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) { hit = false; break; }
      }
      if (hit) return true;
    }
    return false;
  }
  freeDesk(preferNear) {
    const free = this.desks.filter(d => !d.covered);
    if (!free.length) return null;
    // a cover on another floor counts as far away: kids upstairs tend to stay upstairs, kids on the stage stay on the stage
    const py = preferNear.y || 0, cost = (d) => Math.hypot(d.x - preferNear.x, d.z - preferNear.z) + Math.abs((d.floor || 0) - py) * 4;
    free.sort((a, b) => cost(a) - cost(b));
    return pick(free.slice(0, Math.min(4, free.length)));
  }
}
World.indoorBg = null;
