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
    this.boxes = [];          // {minX,maxX,minZ,maxZ,h}
    this.desks = [];          // logical cover entries {x,z,w,d,h,seat:{x,z},occupant,covered}
    this.objects = [];        // everything we add to the scene, so the room can be torn down
    this.gradient = Draw.gradientMap();
    this.inkMat = new THREE.LineBasicMaterial({ color: 0x3a2e2a });
    this.build();
    this.buildGrid();
  }
  add(o) { this.scene.add(o); this.objects.push(o); return o; }
  dispose() { for (const o of this.objects) this.scene.remove(o); this.objects = []; this.boxes = []; this.desks = []; }
  toon(color) { return new THREE.MeshToonMaterial({ color, gradientMap: this.gradient }); }
  inked(mesh) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), this.inkMat); mesh.add(e); return mesh; }
  collide(x, z, w, d, h) { this.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h }); }
  box(w, h, d, x, y, z, color, { collide = true, ink = true, shadow = true, parent = null } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.toon(color));
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
    if (ink) this.inked(m);
    if (parent) parent.add(m); else this.add(m);
    if (collide) this.collide(x, z, w, d, y + h / 2);
    return m;
  }
  cylinder(r, h, x, y, z, color, { collide = true, parent = null, seg = 16 } = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), this.toon(color));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; this.inked(m);
    if (parent) parent.add(m); else this.add(m);
    if (collide) this.collide(x, z, r * 2, r * 2, y + h / 2);
    return m;
  }
  build() {
    const L = this.layout, { w, d, h } = this.room, s = this.scene, st = L.style;
    // floor / ceiling / walls by style
    const floorTex = st === 'lab' ? Draw.tex(Draw.tiles(), [w / 2, d / 2]) : Draw.tex(Draw.floor(), [w / 4, d / 4]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: this.gradient }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshToonMaterial({ color: 0xf3eee0, gradientMap: this.gradient }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = h; this.add(ceil);
    const wallCanvas = st === 'music' ? Draw.staffWall() : Draw.paperWall(st === 'lab' ? '#eef5e8' : '#fbf6e6');
    const wallMat = new THREE.MeshToonMaterial({ map: Draw.tex(wallCanvas, [w / 4, 1]), gradientMap: this.gradient });
    const mk = (pw, px, pz, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, h), wallMat); m.position.set(px, h / 2, pz); m.rotation.y = ry; m.receiveShadow = true; this.add(m); };
    mk(w, 0, -d / 2, 0); mk(w, 0, d / 2, Math.PI); mk(d, -w / 2, 0, Math.PI / 2); mk(d, w / 2, 0, -Math.PI / 2);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), this.inkMat); edges.position.y = h / 2; this.add(edges);
    // the board on the front wall (chalkboard or whiteboard)
    this.boardStyle = L.board.style;
    this.blackboardMat = new THREE.MeshBasicMaterial({ map: Draw.tex(Draw.blackboard(0, this.boardStyle)) });
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(L.board.w, L.board.h), this.blackboardMat);
    bb.position.set(0, 1.65, -d / 2 + 0.06); this.add(bb);
    this.box(L.board.w + 0.3, L.board.h + 0.3, 0.05, 0, 1.65, -d / 2 + 0.02, this.boardStyle === 'chalk' ? 0x7a4a22 : 0xb8c0c8, { collide: false, shadow: false });
    this.box(L.board.w + 0.3, 0.08, 0.14, 0, 0.72, -d / 2 + 0.07, this.boardStyle === 'chalk' ? 0x7a4a22 : 0xb8c0c8, { collide: false });
    // windows (-x wall) and doors (+x wall)
    const winTex = Draw.tex(Draw.window());
    for (const z of L.windows) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), new THREE.MeshBasicMaterial({ map: winTex }));
      win.position.set(-w / 2 + 0.03, 1.7, z); win.rotation.y = Math.PI / 2; this.add(win);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.06, 1.7, 1.6)), this.inkMat); frame.position.set(-w / 2 + 0.03, 1.7, z); this.add(frame);
    }
    for (const dr of L.doors) {
      const door = this.box(0.08, 2.1, 1.0, w / 2 - 0.04, 1.05, dr.z, 0x8fb98a, { collide: false, shadow: false });
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), this.toon(0xf4e27a)); knob.position.set(-0.06, 0, -0.35); door.add(knob);
    }
    // clock on the front wall
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), this.toon(0xffffff)); clock.position.set(L.board.w / 2 + 0.8, 2.6, -d / 2 + 0.02); this.add(clock);
    clock.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, (_, i) => new THREE.Vector3(Math.cos(i / 24 * 6.283) * 0.28, Math.sin(i / 24 * 6.283) * 0.28, 0))), this.inkMat));
    clock.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.01), new THREE.Vector3(0, 0.2, 0.01), new THREE.Vector3(0, 0, 0.01), new THREE.Vector3(0.14, 0.08, 0.01)]), new THREE.LineBasicMaterial({ color: 0x2b2622 })));
    // furniture
    for (const f of L.furniture) this.furniture(f);
    // logical cover entries
    for (const dsk of L.desks) this.desks.push({ x: dsk.x, z: dsk.z, w: dsk.w, d: dsk.d, h: dsk.h, seat: { x: dsk.seat.x, z: dsk.seat.z }, occupant: null, covered: null });
    this.bounds = { minX: -w / 2 + 0.3, maxX: w / 2 - 0.3, minZ: -d / 2 + 0.3, maxZ: d / 2 - 0.3 };
  }
  // ---- one piece of furniture ----
  furniture(f) {
    const d = this.room.d;
    switch (f.kind) {
      case 'desk': return this.deskAndChair(f.x, f.z);
      case 'podium': return this.box(f.w, f.h, f.d, f.x, f.h / 2, f.z, 0xb98556);
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
      case 'stool': { this.cylinder(0.18, 0.04, f.x, 0.6, f.z, 0x5d8ad6, { collide: false }); this.cylinder(0.03, 0.58, f.x, 0.29, f.z, 0x7a8794, { collide: false, seg: 8 }); this.collide(f.x, f.z, 0.36, 0.36, 0.62); return; }
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
        this.collide(f.x, f.z, 0.42, 0.42, 0.44);
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
    this.collide(x, z + seatZ, 0.4, 0.4, 0.44);
  }
  setTally(n) { const old = this.blackboardMat.map; this.blackboardMat.map = Draw.tex(Draw.blackboard(n, this.boardStyle)); this.blackboardMat.needsUpdate = true; if (old) old.dispose(); }
  buildGrid() {
    this.cell = 0.3;
    this.gw = Math.round(this.room.w / this.cell); this.gh = Math.round(this.room.d / this.cell);
    this.grid = new Uint8Array(this.gw * this.gh);
    const pad = 0.2;
    for (let gz = 0; gz < this.gh; gz++) for (let gx = 0; gx < this.gw; gx++) {
      const { x, z } = this.cellCenter(gx, gz);
      let blocked = Math.abs(x) > this.room.w / 2 - 0.35 || Math.abs(z) > this.room.d / 2 - 0.35;
      if (!blocked) for (const b of this.boxes) {
        if (b.h < 0.3) continue;
        if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) { blocked = true; break; }
      }
      this.grid[gz * this.gw + gx] = blocked ? 1 : 0;
    }
    // pockets of free cells that cannot be reached from the door side are useless to the AI: seal them
    const st = this.layout.start, sc = this.nearestFree(st.x, st.z), seen = new Uint8Array(this.gw * this.gh), q = [sc.gz * this.gw + sc.gx]; seen[q[0]] = 1;
    for (let head = 0; head < q.length; head++) { const c = q[head], cx = c % this.gw, cz = (c / this.gw) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, nz = cz + dz; if (!this.free(nx, nz)) continue; const ni = nz * this.gw + nx; if (!seen[ni]) { seen[ni] = 1; q.push(ni); } } }
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === 0 && !seen[i]) this.grid[i] = 1;
  }
  cellOf(x, z) { return { gx: clamp(Math.floor((x + this.room.w / 2) / this.cell), 0, this.gw - 1), gz: clamp(Math.floor((z + this.room.d / 2) / this.cell), 0, this.gh - 1) }; }
  cellCenter(gx, gz) { return { x: -this.room.w / 2 + (gx + 0.5) * this.cell, z: -this.room.d / 2 + (gz + 0.5) * this.cell }; }
  free(gx, gz) { return gx >= 0 && gz >= 0 && gx < this.gw && gz < this.gh && this.grid[gz * this.gw + gx] === 0; }
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
        if (prev[ni] !== -1) continue;
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
    for (let i = 0; i <= steps; i++) { const t = i / steps, c = this.cellOf(a.x + dx * t, a.z + dz * t); if (!this.free(c.gx, c.gz)) return false; }
    return true;
  }
  // push a circle (x,z,r) out of boxes and bounds
  collideCircle(pos, r, ignoreLow = 0) {
    pos.x = clamp(pos.x, this.bounds.minX, this.bounds.maxX); pos.z = clamp(pos.z, this.bounds.minZ, this.bounds.maxZ);
    for (const b of this.boxes) {
      if (b.h <= ignoreLow) continue;
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
    for (const b of this.boxes) if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ && p.y < b.h) return b;
    return null;
  }
  // march along a ray until something solid; used to converge the dart on the crosshair
  rayDistance(origin, dir, maxDist = 30) {
    const p = origin.clone(), step = 0.1;
    for (let d = step; d < maxDist; d += step) {
      p.copy(origin).addScaledVector(dir, d);
      if (p.y < 0 || this.pointInBox(p)) return d;
    }
    return maxDist;
  }
  // 3D segment vs AABB (slab test) — used for line-of-sight
  segmentBlocked(p0, p1) {
    for (const b of this.boxes) {
      let tmin = 0, tmax = 1;
      const mins = [b.minX, 0, b.minZ], maxs = [b.maxX, b.h, b.maxZ], o = [p0.x, p0.y, p0.z], d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z];
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
    free.sort((a, b) => Math.hypot(a.x - preferNear.x, a.z - preferNear.z) - Math.hypot(b.x - preferNear.x, b.z - preferNear.z));
    return pick(free.slice(0, Math.min(4, free.length)));
  }
}
