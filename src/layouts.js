// The rooms a round can take place in. A layout is pure data; World builds it.
//   desks: logical cover entries {x,z,w,d,h, seat:{x,z}} — a student hides behind one and sits at its seat when out
//   furniture: things to draw + collide with, by kind
//   doors are always on the +x wall, windows on the -x wall, the board on the -z wall
const r2 = (v) => Math.round(v * 100) / 100;

function classroom() {
  // 5 columns 1.8 m apart, 4 rows 1.7 m apart: with a desk 0.62 deep plus its chair, every aisle is at least 0.8 m wide
  const cols = [-3.6, -1.8, 0, 1.8, 3.6], rows = [-2.9, -1.2, 0.5, 2.2];
  const desks = [], furniture = [];
  for (const x of cols) for (const z of rows) { desks.push({ x, z, w: 0.62, d: 0.46, h: 0.72, seat: { x, z: z + 0.48 } }); furniture.push({ kind: 'desk', x, z }); }
  furniture.push({ kind: 'podium', x: 0, z: -4.5, w: 1.3, d: 0.65, h: 0.78 });
  furniture.push({ kind: 'cupboard', x: 4.9, z: 4.95, w: 1.4, d: 0.5, h: 1.9 });
  furniture.push({ kind: 'bulletin', x: -2.8, z: 5.23 });
  return {
    id: 'classroom', name: '三年二班', w: 13, d: 10.5, h: 3.2, style: 'classroom',
    doors: [{ x: 6.1, z: -4.0 }, { x: 6.1, z: 4.0 }], windows: [-3.3, -1.1, 1.1, 3.3],
    start: { x: -5.6, z: 4.4, yaw: -0.55 }, front: -3.5, board: { w: 5.6, h: 1.5, style: 'chalk' },
    desks, furniture, props: [{ kind: 'trash', x: -5.8, z: -4.6 }, { kind: 'trash', x: 5.6, z: 0.3 }, { kind: 'bucket', door: 0 }],
    mounts: [
      { x: -2.4, y: 2.0, z: -5.16, ry: 0 }, { x: -0.8, y: 1.35, z: -5.16, ry: 0 }, { x: 1.8, y: 1.25, z: -5.16, ry: 0 }, { x: 2.6, y: 2.05, z: -5.16, ry: 0 },
      { x: -3.6, y: 1.85, z: 5.16, ry: Math.PI }, { x: -2.1, y: 1.5, z: 5.16, ry: Math.PI },
      { x: 4.9, y: 1.55, z: 4.68, ry: Math.PI },
      { x: -6.46, y: 2.75, z: -1.5, ry: Math.PI / 2 }, { x: -6.46, y: 2.75, z: 1.5, ry: Math.PI / 2 },
      { x: 6.46, y: 1.7, z: 0, ry: -Math.PI / 2 },
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


// 活動中心：禮堂兼體育館。舞台 (+0.9 m) 在前、二樓看台 (+2.6 m) 在後、兩側樓梯。
// The floor height is a function of (x,z) (see World.heightAt), so a single 2D nav grid still works:
// the balcony footprint is solid underneath (storage rooms), nothing walks beneath it.
function hall() {
  const desks = [], furniture = [], W = 16, D = 14;
  const STAGE = 0.9, BALC = 2.6;
  const terrain = [
    { kind: 'platform', x: 0, z: -5.5, w: 10, d: 3, h: STAGE, color: 0xc9a06a },                        // stage, z -7..-4
    { kind: 'ramp', x: 5.6, z: -5.5, w: 1.2, d: 1.6, h0: 0, h1: STAGE, axis: 'x', dir: -1, color: 0xb98556 }, // steps up on the right (rising toward -x)
    { kind: 'ramp', x: -5.6, z: -5.5, w: 1.2, d: 1.6, h0: 0, h1: STAGE, axis: 'x', dir: 1, color: 0xb98556 }, // and on the left
    { kind: 'ramp', x: 0, z: -3.6, w: 1.6, d: 0.8, h0: 0, h1: STAGE, axis: 'z', dir: -1, color: 0xb98556 },   // centre front steps
    { kind: 'platform', x: 0, z: 5.5, w: W, d: 3, h: BALC, color: 0xe4d7b4 },                            // balcony, z 4..7
    { kind: 'ramp', x: 7.3, z: 2.0, w: 1.4, d: 4, h0: 0, h1: BALC, axis: 'z', dir: 1, color: 0xd9c39a },  // staircase along the right wall, z 0..4
    { kind: 'ramp', x: -7.3, z: 2.0, w: 1.4, d: 4, h0: 0, h1: BALC, axis: 'z', dir: 1, color: 0xd9c39a }, // and the left wall
  ];
  // floor: two blocks of long benches facing the stage; each bench gives two cover entries and is its own seat
  for (const bx of [-3, 3]) for (const z of [-1.5, -0.2, 1.1, 2.4]) {
    furniture.push({ kind: 'gymbench', x: bx, z, w: 3.6, d: 0.4, h: 0.45 });
    for (const dx of [-0.9, 0.9]) desks.push({ x: bx + dx, z, w: 1.8, d: 0.4, h: 0.45, seat: { x: bx + dx, z: z + 0.02 } });
  }
  // bulky cover on the floor
  for (const [x, z] of [[-6.0, -2.4], [6.0, -2.4]]) { furniture.push({ kind: 'vault', x, z, w: 0.9, d: 0.9, h: 1.1 }); desks.push({ x, z, w: 0.9, d: 0.9, h: 1.1, seat: { x: x + (x < 0 ? 0.9 : -0.9), z } }); }
  furniture.push({ kind: 'cart', x: 0, z: -2.0, w: 1.2, d: 0.8, h: 0.9 }); desks.push({ x: 0, z: -2.0, w: 1.2, d: 0.8, h: 0.9, seat: { x: 0, z: -1.1 } });
  for (const x of [-5.2, 5.2]) { furniture.push({ kind: 'mat', x, z: 1.5, w: 1.8, d: 0.9, h: 0.5 }); desks.push({ x, z: 1.5, w: 1.8, d: 0.9, h: 0.5, seat: { x, z: 2.3 } }); }
  // on the stage: a lectern and two speakers
  furniture.push({ kind: 'podium', x: 0, z: -5.6, w: 1.3, d: 0.65, h: 0.78, floor: STAGE }); desks.push({ x: 0, z: -5.6, w: 1.3, d: 0.65, h: 0.78, floor: STAGE, seat: { x: 0, z: -6.4 } });
  for (const x of [-3.5, 3.5]) { furniture.push({ kind: 'speaker', x, z: -5.2, w: 0.7, d: 0.6, h: 1.0, floor: STAGE }); desks.push({ x, z: -5.2, w: 0.7, d: 0.6, h: 1.0, floor: STAGE, seat: { x, z: -6.2 } }); }
  // upstairs: a low wall along the edge and benches behind it
  furniture.push({ kind: 'rail', x: 0, z: 4.15, w: 12.8, d: 0.14, floor: BALC }); // leaves the stair tops (|x| > 6.4) open
  for (const x of [-6, -2, 2, 6]) {
    furniture.push({ kind: 'gymbench', x, z: 5.4, w: 2.4, d: 0.4, h: 0.45, floor: BALC });
    for (const dx of [-0.6, 0.6]) desks.push({ x: x + dx, z: 5.4, w: 1.2, d: 0.4, h: 0.45, floor: BALC, seat: { x: x + dx, z: 5.42 } });
  }
  furniture.push({ kind: 'banner', x: 0, y: STAGE + 3.9, z: -D / 2 + 0.03, w: 7, h: 1.6, text: '全校躲避球大賽' });
  furniture.push({ kind: 'banner', x: 0, y: 1.6, z: 4.02, w: 5, h: 1.1, text: '器材室', ry: 0 });
  return {
    id: 'hall', name: '活動中心', w: W, d: D, h: 6, style: 'gym',
    doors: [{ x: 7.6, z: -4.5 }, { x: 7.6, z: 5.5, floor: BALC }], windows: [-4.5, -1.5, 1.5, 4.5], windowY: 3.8,
    start: { x: -5.8, z: 3.2, yaw: -0.5 }, front: -3.0, board: { w: 5.0, h: 1.4, style: 'chalk' }, boardY: STAGE + 0.3,
    terrain, desks, furniture, props: [{ kind: 'trash', x: -7.2, z: -6.3 }, { kind: 'trash', x: 5.6, z: 3.4 }, { kind: 'bucket', door: 0 }],
    mounts: [
      { x: -3.2, y: STAGE + 2.4, z: -6.96, ry: 0 }, { x: 3.6, y: STAGE + 2.1, z: -6.96, ry: 0 },
      { x: -7.96, y: 2.0, z: -2.5, ry: Math.PI / 2 }, { x: -7.96, y: 2.3, z: -5.5, ry: Math.PI / 2 },
      { x: 7.96, y: 2.1, z: -1.0, ry: -Math.PI / 2 }, { x: 7.96, y: 1.9, z: 1.5, ry: -Math.PI / 2 },
      { x: -2.6, y: 1.5, z: 4.03, ry: 0 }, { x: 2.8, y: 1.9, z: 4.03, ry: 0 },
      { x: -4, y: BALC + 2.0, z: 6.96, ry: Math.PI }, { x: 4, y: BALC + 1.7, z: 6.96, ry: Math.PI },
    ],
  };
}

export const LAYOUTS = { classroom: classroom(), lab: lab(), music: music(), hall: hall() };
export const LAYOUT_IDS = Object.keys(LAYOUTS);
export const layoutById = (id) => LAYOUTS[id] || LAYOUTS.classroom;
