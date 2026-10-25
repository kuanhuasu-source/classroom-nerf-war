// The rooms a round can take place in. A layout is pure data; World builds it.
//   desks: logical cover entries {x,z,w,d,h, seat:{x,z}} — a student hides behind one and sits at its seat when out
//   furniture: things to draw + collide with, by kind
//   doors are always on the +x wall, windows on the -x wall, the board on the -z wall
const r2 = (v) => Math.round(v * 100) / 100;

function classroom() {
  // a class of 30: 6 columns 2.0 m apart, 5 rows 1.9 m apart. A desk plus its chair is 0.91 m deep, so every aisle is at least 0.99 m wide (player 0.56)
  const cols = [-5.0, -3.0, -1.0, 1.0, 3.0, 5.0], rows = [-3.8, -1.9, 0, 1.9, 3.8];
  const desks = [], furniture = [];
  for (const x of cols) for (const z of rows) { desks.push({ x, z, w: 0.62, d: 0.46, h: 0.72, seat: { x, z: z + 0.48 } }); furniture.push({ kind: 'desk', x, z }); }
  furniture.push({ kind: 'podium', x: 0, z: -5.5, w: 1.3, d: 0.65, h: 0.78 });
  furniture.push({ kind: 'cupboard', x: 5.4, z: 5.95, w: 1.4, d: 0.5, h: 1.9 });
  furniture.push({ kind: 'bulletin', x: -2.8, z: 6.23 });
  return {
    id: 'classroom', name: '六年二班', w: 14, d: 12.5, h: 3.2, style: 'classroom',
    doors: [{ x: 6.6, z: -4.5 }, { x: 6.6, z: 4.5 }], windows: [-4.4, -2.2, 0, 2.2, 4.4],
    start: { x: -6.1, z: 5.3, yaw: -0.55 }, front: -4.4, board: { w: 5.6, h: 1.5, style: 'chalk' },
    desks, furniture, props: [{ kind: 'trash', x: -6.3, z: -5.6 }, { kind: 'trash', x: 6.1, z: 0.3 }, { kind: 'bucket', door: 0 }],
    mounts: [
      { x: -2.4, y: 2.0, z: -6.21, ry: 0 }, { x: -0.8, y: 1.35, z: -6.21, ry: 0 }, { x: 1.8, y: 1.25, z: -6.21, ry: 0 }, { x: 2.6, y: 2.05, z: -6.21, ry: 0 },
      { x: -3.6, y: 1.85, z: 6.21, ry: Math.PI }, { x: -2.1, y: 1.5, z: 6.21, ry: Math.PI },
      { x: 5.4, y: 1.55, z: 5.68, ry: Math.PI },
      { x: -6.96, y: 2.75, z: -2.0, ry: Math.PI / 2 }, { x: -6.96, y: 2.75, z: 2.0, ry: Math.PI / 2 },
      { x: 6.96, y: 1.7, z: 0, ry: -Math.PI / 2 },
    ],
  };
}

function lab() {
  const desks = [], furniture = [];
  // rows 2.2 m apart with the stools tucked against the bench: 0.84 m between a stool and the next bench
  for (const x of [-2.6, 2.6]) for (const z of [-1.9, 0.3, 2.5]) {
    furniture.push({ kind: 'bench', x, z, w: 2.4, d: 1.0, h: 0.85 });
    for (const dx of [-0.6, 0.6]) { desks.push({ x: x + dx, z, w: 1.2, d: 1.0, h: 0.85, seat: { x: x + dx, z: z + 0.72 } }); furniture.push({ kind: 'stool', x: x + dx, z: z + 0.68 }); }
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
      { x: -3.6, y: 2.1, z: -4.96, ry: 0 }, { x: 3.6, y: 1.4, z: -4.96, ry: 0 }, { x: 2.7, y: 2.3, z: -4.96, ry: 0 }, // both clear of the fume hood (x 3.95..5.25)
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
  // 6/8/10 chairs on arcs 1.4 m apart: at least 0.7 m between neighbours, 1.0 m between arcs
  [[3.0, 6], [4.4, 8], [5.8, 10]].forEach(([radius, n]) => {
    for (let i = 0; i < n; i++) { const a = -0.85 + (i / (n - 1)) * 1.7; const x = Math.sin(a) * radius, z = -4.2 + Math.cos(a) * radius; chairs.push({ x: r2(x), z: r2(z), ry: r2(-a) }); furniture.push({ kind: 'chair', x: r2(x), z: r2(z), ry: r2(-a) }); }
  });
  const covers = [
    { kind: 'piano', x: -4.4, z: -2.2, w: 2.0, d: 1.6, h: 1.0, entries: [[-4.9, -2.2], [-3.9, -2.2]] },
    { kind: 'timpani', x: 4.0, z: -2.5, w: 1.1, d: 1.1, h: 0.85, entries: [[4.0, -2.5]] },
    { kind: 'timpani', x: 5.2, z: -2.5, w: 1.1, d: 1.1, h: 0.85, entries: [[5.2, -2.5]] },
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
  for (const x of [-5.2, 5.2]) { furniture.push({ kind: 'mat', x, z: -3.5, w: 1.8, d: 0.9, h: 0.5 }); desks.push({ x, z: -3.5, w: 1.8, d: 0.9, h: 0.5, seat: { x, z: -2.7 } }); } // against the stage front, off the side corridors
  furniture.push({ kind: 'cart', x: 2.4, z: -6.4, w: 1.2, d: 0.8, h: 0.9, floor: STAGE }); desks.push({ x: 2.4, z: -6.4, w: 1.2, d: 0.8, h: 0.9, floor: STAGE, seat: { x: 2.4, z: -5.5 } }); // ball cart at the back of the stage
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
    stage: { minX: -4.3, maxX: 4.3, minZ: -6.6, maxZ: -4.4 },
    terrain, desks, furniture, props: [{ kind: 'trash', x: -7.2, z: -6.3 }, { kind: 'trash', x: 7.5, z: -6.5 }, { kind: 'bucket', door: 0 }], // bins in the front corners, out of the side corridors
    mounts: [
      { x: -3.2, y: STAGE + 2.4, z: -6.96, ry: 0 }, { x: 3.6, y: STAGE + 2.1, z: -6.96, ry: 0 },
      { x: -7.96, y: 2.0, z: -2.5, ry: Math.PI / 2 }, { x: -7.96, y: 2.3, z: -5.5, ry: Math.PI / 2 },
      { x: 7.96, y: 2.1, z: -1.0, ry: -Math.PI / 2 }, { x: 7.96, y: 1.9, z: 1.5, ry: -Math.PI / 2 },
      { x: -2.6, y: 1.5, z: 4.03, ry: 0 }, { x: 2.8, y: 1.9, z: 4.03, ry: 0 },
      { x: -4, y: BALC + 2.0, z: 6.96, ry: Math.PI }, { x: 4, y: BALC + 1.7, z: 6.96, ry: Math.PI },
    ],
  };
}

// 操場：戶外。溜滑梯（有高台）、盪鞦韆、生態池（走不過去）、輪胎、沙坑、長椅、升旗台、跑道、樹。
function yard() {
  const desks = [], furniture = [], W = 20, D = 16, TOWER = 1.6;
  const terrain = [
    { kind: 'platform', x: -4, z: -2, w: 1.4, d: 1.4, h: TOWER, color: 0x2f6fd1 },                                   // slide tower
    { kind: 'ramp', x: -5.3, z: -2, w: 1.2, d: 1.0, h0: 0, h1: TOWER, axis: 'x', dir: 1, color: 0x2f6fd1 },             // steps up from the west
    { kind: 'ramp', x: -1.8, z: -2, w: 3.0, d: 0.9, h0: 0, h1: TOWER, axis: 'x', dir: -1, smooth: true, color: 0xf4c542 }, // the slide down to the east
    { kind: 'platform', x: 7.5, z: -6.3, w: 2.2, d: 2.2, h: 0.5, color: 0xd9d2c0 },                                    // flag platform
    { kind: 'ramp', x: 7.5, z: -4.8, w: 1.2, d: 0.8, h0: 0, h1: 0.5, axis: 'z', dir: -1, color: 0xd9d2c0 },
  ];
  furniture.push({ kind: 'rail', x: -4, z: -2.68, w: 1.4, d: 0.08, floor: TOWER }); furniture.push({ kind: 'rail', x: -4, z: -1.32, w: 1.4, d: 0.08, floor: TOWER });
  desks.push({ x: -4, z: -2, w: 1.4, d: 1.4, h: TOWER, seat: { x: -4, z: -0.6 } }); desks.push({ x: -4, z: -2, w: 1.4, d: 1.4, h: TOWER, seat: { x: -4, z: -3.4 } });
  furniture.push({ kind: 'swing', x: 4, z: -3 });
  for (const sx of [-1, 1]) desks.push({ x: 4 + sx * 1.4, z: -3, w: 0.5, d: 1.2, h: 2.4, seat: { x: 4 + sx * 0.5, z: -3 } });
  // a small pond with a plank bridge across the middle (the bridge is terrain, 12 cm up, so people and kids walk over it)
  furniture.push({ kind: 'pond', x: 0.5, z: 3.5, w: 3.6, d: 2.4, bridgeW: 1.0 });
  terrain.push({ kind: 'platform', x: 0.5, z: 3.5, w: 1.0, d: 3.0, h: 0.12, color: 0xb98556 });
  for (let i = 0; i < 4; i++) { const x = -8.0 + i * 1.6; furniture.push({ kind: 'tire', x, z: 2.6 }); desks.push({ x, z: 2.6, w: 0.9, d: 0.34, h: 0.55, seat: { x, z: 2.6 } }); }
  furniture.push({ kind: 'sandbox', x: 6.5, z: 2.8, w: 3, d: 3 });
  furniture.push({ kind: 'flag', x: 7.5, z: -6.3, floor: 0.5 });
  for (const x of [-6.5, -2.5, 2.5, 6.5]) { furniture.push({ kind: 'gymbench', x, z: 5.2, w: 1.8, d: 0.4, h: 0.45 }); desks.push({ x, z: 5.2, w: 1.8, d: 0.4, h: 0.45, seat: { x, z: 5.22 } }); }
  furniture.push({ kind: 'track', x: 0, z: 7.0, w: W - 1, d: 1.6 });
  for (const [x, z] of [[-8.6, -6.4], [8.8, 6.4], [-8.6, 6.4], [2.2, -6.6]]) { furniture.push({ kind: 'tree', x, z }); desks.push({ x, z, w: 0.5, d: 0.5, h: 2.4, seat: { x: x + 0.6, z } }); }
  furniture.push({ kind: 'bulletin', x: 5.5, z: -D / 2 + 0.02 });
  return {
    id: 'yard', name: '操場', w: W, d: D, h: 7, style: 'yard',
    doors: [{ x: 9.6, z: -3.5 }, { x: 9.6, z: 4.5 }], windows: [],
    start: { x: -8.6, z: 4.8, yaw: -0.8 }, front: -6.0, board: { w: 4.4, h: 1.5, style: 'chalk' }, boardY: 0.2,
    terrain, desks, furniture, props: [{ kind: 'trash', x: -9.0, z: -7.0 }, { kind: 'trash', x: 9.0, z: 1.0 }, { kind: 'bucket', door: 0 }],
    // 守校門：校門就是 +x 牆的兩個出入口；水溝蓋在草地上，爬牆點是靠在圍牆內側的木板
    siege: { drains: [[-6.5, -4.8], [4.5, 0.3], [0, 6.0]], climbs: [[-9.6, -0.5], [-5, 7.6], [6.5, 7.6]] },
    mounts: [
      { x: -6.5, y: 1.6, z: -7.96, ry: 0 }, { x: -3.2, y: 2.1, z: -7.96, ry: 0 }, { x: 3.0, y: 1.5, z: -7.96, ry: 0 }, { x: 8.2, y: 2.0, z: -7.96, ry: 0 },
      { x: 9.96, y: 1.0, z: 0.5, ry: -Math.PI / 2 }, { x: -9.96, y: 1.0, z: -2.5, ry: Math.PI / 2 }, { x: -9.96, y: 1.0, z: 1.0, ry: Math.PI / 2 },
      { x: 0, y: 1.0, z: 7.96, ry: Math.PI }, { x: 4.5, y: 1.0, z: 7.96, ry: Math.PI },
    ],
  };
}

// 廁所（搶廁所模式專用）：長形，-x 側四間隔間、+x 側洗手台，中間拖把桶當矮掩體，最裡面是大型小便斗，靶心在裡面。
function toilet() {
  const desks = [], furniture = [], W = 10, D = 16;
  for (const z of [-4.5, -2.5, -0.5, 1.5]) { furniture.push({ kind: 'stall', x: -4.2, z, w: 1.6, d: 1.9, h: 2.0 }); desks.push({ x: -4.2, z, w: 1.6, d: 1.9, h: 1.0, seat: { x: -4.3, z } }); }
  for (const z of [-3.2, 0.6, 4.2]) { furniture.push({ kind: 'sinkrow', x: 4.6, z, w: 0.6, d: 2.6, h: 0.9 }); desks.push({ x: 4.6, z, w: 0.6, d: 2.6, h: 0.9, seat: { x: 3.9, z } }); }
  for (const [x, z] of [[0.6, 3.2], [-1.4, -0.8], [1.8, -3.6], [-0.6, -5.4]]) { furniture.push({ kind: 'mopcart', x, z, w: 0.7, d: 0.7, h: 0.95 }); desks.push({ x, z, w: 0.7, d: 0.7, h: 0.95, seat: { x: x + 0.9, z } }); }
  for (const [x, z] of [[1.2, 0.8], [-2.2, 2.6], [2.6, -1.6], [-2.4, -4.2]]) furniture.push({ kind: 'wetsign', x, z });
  furniture.push({ kind: 'urinal', x: 0, z: -7.3, w: 3.2, d: 1.1, h: 2.4 });
  furniture.push({ kind: 'cabinet', x: 3.8, z: -7.6, w: 1.6, d: 0.5, h: 2.0 });
  furniture.push({ kind: 'banner', x: 0, y: 2.6, z: D / 2 - 0.03, w: 4, h: 0.9, text: '洗手 20 秒', ry: Math.PI });
  return {
    id: 'toilet', name: '廁所', w: W, d: D, h: 3.4, style: 'toilet', modeOnly: true,
    doors: [{ x: 5.1, z: 6.3 }, { x: 5.1, z: -5.8 }], windows: [-5, -1, 3], windowY: 2.5,
    start: { x: 2.6, z: 6.8, yaw: 0.25 }, front: -6.0, board: { w: 2.8, h: 0.9, style: 'toilet' }, boardY: 1.2,
    // the cans to shoot: five on the shelf inside the urinal, one on each sink row; crewSpots: where the cleaners already stand when you walk in
    cans: [[-1.0, 1.32, -7.4], [-0.5, 1.32, -7.4], [0, 1.32, -7.4], [0.5, 1.32, -7.4], [1.0, 1.32, -7.4], [4.55, 1.06, -3.2], [4.55, 1.06, 0.6], [4.55, 1.06, 4.2]],
    crewSpots: [[-3.0, -4.5], [3.6, -3.2], [-0.4, -2.6], [2.2, 1.6], [-3.0, 1.5], [3.4, 4.2], [-1.6, 4.4]],
    desks, furniture, props: [{ kind: 'trash', x: -4.6, z: 7.3 }, { kind: 'trash', x: 4.6, z: 2.2 }, { kind: 'bucket', door: 0 }],
    mounts: [
      { x: -3.2, y: 2.4, z: -7.96, ry: 0 }, { x: 2.6, y: 2.6, z: -7.96, ry: 0 },
      { x: -4.96, y: 1.9, z: 3.6, ry: Math.PI / 2 }, { x: -4.96, y: 2.6, z: -6.5, ry: Math.PI / 2 },
      { x: 4.96, y: 2.3, z: -1.3, ry: -Math.PI / 2 }, { x: 4.96, y: 2.4, z: 2.8, ry: -Math.PI / 2 },
      { x: -2.6, y: 1.8, z: 7.96, ry: Math.PI }, { x: 2.4, y: 1.5, z: 7.96, ry: Math.PI },
    ],
  };
}

// 走廊（午餐大作戰專用）：L 形。段 A 從六年二班門口（西端）往東 24 m，轉角後段 B 往北 18 m 到蒸飯室。
// 房間本身是 28 × 28 的方形，走廊以外的部分用一大塊實心「教室」填滿（filler），所以導航格、碰撞都照舊。
function corridor() {
  const W = 28, D = 28, furniture = [], desks = [];
  const doors2 = [];
  ['一', '三', '四', '五', '六'].forEach((n, i) => doors2.push({ name: 'A' + i, label: `六年${n}班`, x: -10 + i * 4, z: -9.35, nx: 0, nz: -1 }));          // segment A, the classrooms' side (z = -9 face)
  ['一', '二', '三', '四'].forEach((n, i) => doors2.push({ name: 'B' + i, label: `五年${n}班`, x: 10.35, z: -5 + i * 4, nx: 1, nz: 0 }));             // segment B, inner face (x = 10)
  ['五', '六', '七'].forEach((n, i) => doors2.push({ name: 'C' + i, label: `五年${n}班`, x: 13.65, z: -3 + i * 4, nx: -1, nz: 0 }));                 // segment B, outer wall (x = 14)
  return {
    id: 'corridor', name: '走廊', w: W, d: D, h: 3.4, style: 'corridor', modeOnly: true, noBoard: true,
    doors: [], windows: [], start: { x: -12, z: -11, yaw: -Math.PI / 2 }, front: -6.0, board: { w: 2, h: 0.8, style: 'lab' },
    filler: [{ minX: -14, maxX: 10, minZ: -9, maxZ: 14 }],
    home: { x: -12, z: -11, r: 1.8 }, kitchen: { x: 12, z: 10.8, r: 2.0 }, cartStart: { x: -11, z: -11, heading: 0 },
    fountain: { x: 10.4, z: -9.4 },
    buckets: [[-5, -10.0], [1, -12.0], [7, -10.2], [12.9, -3], [11.2, 4]],
    doors2,
    phaseDoors: { out: ['A0', 'A1', 'A2', 'A3', 'A4', 'B0', 'B1', 'B2'], load: ['B3', 'C2', 'B2', 'C1'], back: ['A1', 'A2', 'A3', 'A4', 'B0', 'B1', 'B2', 'B3', 'C1', 'C2'] },
    grabberSpawns: { load: [10.6, 7], back: { corner: { when: 8, at: [6, -9.9] }, last: { when: -4, at: [-2, -9.9] } } },
    desks, furniture, props: [{ kind: 'trash', x: -13.4, z: -12.6 }], mounts: [],
  };
}

export const LAYOUTS = { classroom: classroom(), lab: lab(), music: music(), hall: hall(), yard: yard(), toilet: toilet(), corridor: corridor() };
export const LAYOUT_IDS = Object.keys(LAYOUTS).filter(id => !LAYOUTS[id].modeOnly); // the random pick never lands on a mode-only room
export const layoutById = (id) => LAYOUTS[id] || LAYOUTS.classroom;
