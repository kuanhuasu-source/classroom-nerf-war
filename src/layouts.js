// The rooms a round can take place in. A layout is pure data; World builds it.
//   desks: logical cover entries {x,z,w,d,h, seat:{x,z}} — a student hides behind one and sits at its seat when out
//   furniture: things to draw + collide with, by kind
//   doors are always on the +x wall, windows on the -x wall, the board on the -z wall
const r2 = (v) => Math.round(v * 100) / 100;

function classroom() {
  const cols = [-4.5, -2.9, -1.3, 0.3, 1.9, 3.5], rows = [-2.2, -1.1, 0.0, 1.1, 2.2];
  const desks = [], furniture = [];
  for (const x of cols) for (const z of rows) { desks.push({ x, z, w: 0.62, d: 0.46, h: 0.72, seat: { x, z: z + 0.48 } }); furniture.push({ kind: 'desk', x, z }); }
  furniture.push({ kind: 'podium', x: 0, z: -3.45, w: 1.3, d: 0.65, h: 0.78 });
  furniture.push({ kind: 'cupboard', x: 4.3, z: 4.2, w: 1.4, d: 0.5, h: 1.9 });
  furniture.push({ kind: 'bulletin', x: -2.5, z: 4.48 });
  return {
    id: 'classroom', name: '三年二班', w: 12, d: 9, h: 3.2, style: 'classroom',
    doors: [{ x: 5.6, z: -3.3 }, { x: 5.6, z: 3.3 }], windows: [-2.6, 0, 2.6],
    start: { x: -5.0, z: 3.7, yaw: -0.55 }, front: -2.75, board: { w: 5.2, h: 1.5, style: 'chalk' },
    desks, furniture, props: [{ kind: 'trash', x: -5.3, z: -3.7 }, { kind: 'trash', x: 5.1, z: 0.3 }, { kind: 'bucket', door: 0 }],
    mounts: [
      { x: -2.0, y: 2.0, z: -4.41, ry: 0 }, { x: -0.6, y: 1.35, z: -4.41, ry: 0 }, { x: 1.6, y: 1.25, z: -4.41, ry: 0 }, { x: 2.3, y: 2.05, z: -4.41, ry: 0 },
      { x: -3.2, y: 1.85, z: 4.41, ry: Math.PI }, { x: -1.9, y: 1.5, z: 4.41, ry: Math.PI },
      { x: 4.3, y: 1.55, z: 3.93, ry: Math.PI },
      { x: -5.96, y: 2.75, z: -1.3, ry: Math.PI / 2 }, { x: -5.96, y: 2.75, z: 1.3, ry: Math.PI / 2 },
      { x: 5.96, y: 1.7, z: 0, ry: -Math.PI / 2 },
    ],
  };
}

function lab() {
  const desks = [], furniture = [];
  for (const x of [-2.6, 2.6]) for (const z of [-1.8, 0.3, 2.4]) {
    furniture.push({ kind: 'bench', x, z, w: 2.4, d: 1.0, h: 0.85 });
    for (const dx of [-0.6, 0.6]) { desks.push({ x: x + dx, z, w: 1.2, d: 1.0, h: 0.85, seat: { x: x + dx, z: z + 0.85 } }); furniture.push({ kind: 'stool', x: x + dx, z: z + 0.85 }); }
  }
  furniture.push({ kind: 'bench', x: 0, z: -3.9, w: 2.2, d: 0.8, h: 0.9, teacher: true });
  furniture.push({ kind: 'cabinet', x: -5.9, z: 4.4, w: 1.8, d: 0.55, h: 2.0 });
  furniture.push({ kind: 'hood', x: 4.6, z: -4.5, w: 1.3, d: 0.8, h: 2.1 });
  furniture.push({ kind: 'sink', x: 2.6, z: 4.6, w: 3.0, d: 0.5, h: 0.9 });
  furniture.push({ kind: 'skeleton', x: -5.6, z: -3.6 });
  furniture.push({ kind: 'poster', x: -3.0, z: 4.96, w: 2.6, h: 1.4, style: 'periodic' });
  return {
    id: 'lab', name: '自然教室', w: 14, d: 10, h: 3.4, style: 'lab',
    doors: [{ x: 6.6, z: -3.9 }, { x: 6.6, z: 3.9 }], windows: [-3, -1, 1, 3],
    start: { x: -6.0, z: 4.1, yaw: -0.55 }, front: -3.0, board: { w: 6.0, h: 1.5, style: 'lab' },
    desks, furniture, props: [{ kind: 'trash', x: -3.0, z: -4.4 }, { kind: 'trash', x: 0.2, z: 4.0 }, { kind: 'bucket', door: 0 }],
    mounts: [
      { x: -3.6, y: 2.1, z: -4.96, ry: 0 }, { x: 3.8, y: 1.4, z: -4.96, ry: 0 }, { x: 4.6, y: 2.2, z: -4.96, ry: 0 },
      { x: -0.8, y: 1.9, z: 4.96, ry: Math.PI }, { x: 0.6, y: 2.3, z: 4.96, ry: Math.PI },
      { x: -6.96, y: 2.8, z: -2, ry: Math.PI / 2 }, { x: -6.96, y: 2.8, z: 2, ry: Math.PI / 2 },
      { x: 6.96, y: 1.8, z: 0, ry: -Math.PI / 2 }, { x: 6.96, y: 2.4, z: 2.0, ry: -Math.PI / 2 },
    ],
  };
}

function music() {
  const desks = [], furniture = [];
  // chairs in three arcs facing the front; also the seats for knocked-out students
  const chairs = [];
  [[3.0, 7], [4.3, 9], [5.6, 11]].forEach(([radius, n]) => {
    for (let i = 0; i < n; i++) { const a = -0.95 + (i / (n - 1)) * 1.9; const x = Math.sin(a) * radius, z = -4.2 + Math.cos(a) * radius; chairs.push({ x: r2(x), z: r2(z), ry: r2(-a) }); furniture.push({ kind: 'chair', x: r2(x), z: r2(z), ry: r2(-a) }); }
  });
  const covers = [
    { kind: 'piano', x: -3.9, z: -2.0, w: 2.0, d: 1.6, h: 1.0, entries: [[-4.4, -2.0], [-3.4, -2.0]] },
    { kind: 'timpani', x: 3.6, z: -2.3, w: 1.1, d: 1.1, h: 0.85, entries: [[3.6, -2.3]] },
    { kind: 'timpani', x: 4.8, z: -2.3, w: 1.1, d: 1.1, h: 0.85, entries: [[4.8, -2.3]] },
    { kind: 'cabinet', x: -4.6, z: 1.2, w: 1.6, d: 0.55, h: 0.95, entries: [[-5.0, 1.2], [-4.2, 1.2]] },
    { kind: 'cabinet', x: 4.6, z: 1.2, w: 1.6, d: 0.55, h: 0.95, entries: [[4.2, 1.2], [5.0, 1.2]] },
    { kind: 'cabinet', x: -3.6, z: 3.9, w: 1.6, d: 0.55, h: 0.95, entries: [[-4.0, 3.9], [-3.2, 3.9]] },
    { kind: 'cabinet', x: 3.6, z: 3.9, w: 1.6, d: 0.55, h: 0.95, entries: [[3.2, 3.9], [4.0, 3.9]] },
    { kind: 'drum', x: 0.4, z: 3.6, w: 1.0, d: 1.0, h: 0.8, entries: [[0.4, 3.6]] },
  ];
  const used = new Set();
  for (const c of covers) {
    furniture.push(c);
    for (const [ex, ez] of c.entries) {
      let best = null, bd = 1e9;
      chairs.forEach((ch, i) => { if (used.has(i)) return; const dd = Math.hypot(ch.x - ex, ch.z - ez); if (dd < bd) { bd = dd; best = i; } });
      used.add(best);
      desks.push({ x: ex, z: ez, w: c.entries.length > 1 ? c.w / 2 : c.w, d: c.d, h: c.h, seat: { x: chairs[best].x, z: chairs[best].z } });
    }
  }
  furniture.push({ kind: 'conductor', x: 0, z: -4.1 });
  furniture.push({ kind: 'poster', x: -2.6, z: 4.96, w: 1.0, h: 1.3, style: 'composer' });
  furniture.push({ kind: 'poster', x: 2.2, z: 4.96, w: 1.0, h: 1.3, style: 'composer2' });
  return {
    id: 'music', name: '音樂教室', w: 12, d: 10, h: 3.4, style: 'music',
    doors: [{ x: 5.6, z: -3.8 }, { x: 5.6, z: 3.8 }], windows: [-2.5, 0, 2.5],
    start: { x: -5.0, z: 4.2, yaw: -0.55 }, front: -3.0, board: { w: 5.6, h: 1.5, style: 'music' },
    desks, furniture, props: [{ kind: 'trash', x: -5.3, z: -4.3 }, { kind: 'trash', x: 5.2, z: -0.6 }, { kind: 'bucket', door: 0 }],
    mounts: [
      { x: -3.6, y: 2.1, z: -4.96, ry: 0 }, { x: 3.6, y: 1.5, z: -4.96, ry: 0 },
      { x: -0.6, y: 2.2, z: 4.96, ry: Math.PI }, { x: 0.6, y: 1.7, z: 4.96, ry: Math.PI },
      { x: -5.96, y: 2.8, z: -1.3, ry: Math.PI / 2 }, { x: -5.96, y: 2.8, z: 1.3, ry: Math.PI / 2 },
      { x: 5.96, y: 1.8, z: 0, ry: -Math.PI / 2 },
    ],
  };
}

export const LAYOUTS = { classroom: classroom(), lab: lab(), music: music() };
export const LAYOUT_IDS = Object.keys(LAYOUTS);
export const layoutById = (id) => LAYOUTS[id] || LAYOUTS.classroom;
