import * as THREE from 'three';
import { BUFFS, MOUNTS, PLAYER_SKINS, EMOTES } from '../config.js';
import { Audio } from '../audio.js';
import { Student } from '../student.js';
import { Teacher } from '../teacher.js';
import { Bully } from '../bully.js';
import { Dodgeball } from '../dodgeball.js';
import { Monitor } from '../monitor.js';
import { SpecialItem } from '../item.js';
import { RemotePlayer } from '../remoteplayer.js';

const r2 = (v) => Math.round(v * 100) / 100;

// Host side: everything the guest needs to draw the classroom this tick.
export function serializeSnapshot(g) {
  const p = g.player;
  const snap = {
    t: 'snap', st: g.state, wave: g.wave, score: g.score, kills: g.kills, boss: g.bossPhase ? 1 : 0,
    left: g.teachers.length ? '老師' : g.students.filter(s => s.alive).length + g.spawnQueue.length,
    slow: g.worldSlow() ? 1 : 0,
    host: { x: r2(p.pos.x), z: r2(p.pos.z), yaw: r2(p.yaw), eye: r2(p.eye), c: p.crouching ? 1 : 0, hp: p.hp, sit: p.sitting ? 1 : 0, sx: p.seat ? r2(p.seat.x) : 0, sz: p.seat ? r2(p.seat.z) : 0 },
    guest: g.remote ? { hp: g.remote.hp, mh: g.remote.maxHp, sit: g.remote.sitting ? 1 : 0, sx: g.remote.seat ? r2(g.remote.seat.x) : 0, sz: g.remote.seat ? r2(g.remote.seat.z) : 0, st: r2(g.remote.sitT) } : null,
    students: g.students.map(s => s.serialize(g.fullSnapNext)),
    tc: g.teachers.map(t => t.serialize()),
    bully: g.bully ? g.bully.serialize() : null,
    ball: g.ball ? g.ball.serialize() : null,
    monitor: g.monitor ? g.monitor.serialize() : null,
    items: g.items.map(i => i.serialize()),
    props: g.props.map(p => p.state === 'up' ? 0 : 1),
    milks: g.milks.map(m => ({ id: m.id, k: m.kind || 'milk', x: r2(m.mesh.position.x), y: r2(m.kind === 'ammo' ? m.baseY + 0.05 : m.baseY), z: r2(m.mesh.position.z) })),
    dm: g.darts.serializeMoving(),
    ev: g.events,
  };
  const dl = g.darts.takeDeltas();
  if (g.fullSnapNext) snap.dr = g.darts.serializeResting(); else { if (dl.settled.length) snap.ds = dl.settled; if (dl.removed.length) snap.dx = dl.removed; }
  g.events = []; g.fullSnapNext = false;
  return snap;
}

// Guest side: create, update and remove local stand-ins so they match the host.
export function applySnapshot(g, s) {
  g.wave = s.wave; g.score = s.score; g.kills = s.kills; g.bossPhase = !!s.boss;
  g.ui.wave(s.wave); g.ui.score(s.score); g.ui.left(s.left);
  g.remoteSlow = !!s.slow;
  if (!g.hostFigure) g.hostFigure = new RemotePlayer(g, PLAYER_SKINS.host);
  g.hostFigure.applyInput(s.host);
  if (s.guest) {
    const me = g.player;
    if (s.guest.sit && !me.sitting) me.sitDown({ x: s.guest.sx, z: s.guest.sz }, s.guest.st);
    else if (!s.guest.sit && me.sitting) me.standUp(s.guest.hp);
    if (me.sitting) me.sitT = s.guest.st;
    if (s.guest.hp < me.hp && !me.sitting) { Audio.hurt(); g.ui.vignette(); }
    me.hp = s.guest.hp; if (s.guest.mh) me.maxHp = s.guest.mh; g.ui.hp(s.guest.hp, me.maxHp);
  }
  sync(g, 'students', s.students.map(Student.unpack), (st) => new Student(g, { x: st.x, z: st.z }, { remote: true, id: st.id, v: st.v }));
  const tc = s.tc || [];
  while (g.teachers.length > tc.length) g.teachers.pop().dispose();
  tc.forEach((ts, i) => {
    if (!g.teachers[i]) { g.teachers[i] = new Teacher(g, { x: ts.x, z: ts.z }, { remote: true, kind: ts.k }); if (i === 0) { g.ui.boss(true); Audio.teacher(); } g.bossName = tc.length > 1 ? '會考委員會' : g.teachers[0].def.name; g.ui.left(g.bossName); }
    g.teachers[i].applyState(ts);
  });
  if (tc.length) g.updateBossHud(); else g.ui.boss(false);
  if (s.bully && !g.bully) g.bully = new Bully(g, { remote: true, di: s.bully.di });
  if (!s.bully && g.bully) { g.bully.dispose(); g.bully = null; }
  if (g.bully) g.bully.applyState(s.bully);
  if (s.ball && !g.ball) g.ball = new Dodgeball(g, { remote: true, start: { x: s.ball.sx, z: s.ball.sz } });
  if (!s.ball && g.ball) { g.ball.dispose(); g.ball = null; }
  if (g.ball) g.ball.applyState(s.ball);
  if (s.monitor && !g.monitor) g.monitor = new Monitor(g, { remote: true, x: s.monitor.x, z: s.monitor.z });
  if (!s.monitor && g.monitor) { g.monitor.dispose(); g.monitor = null; }
  if (g.monitor) g.monitor.applyState(s.monitor);
  if (s.props) s.props.forEach((st, i) => { const p = g.props[i]; if (p) p.applyState(st ? 'down' : 'up'); });
  sync(g, 'items', s.items, (it) => new SpecialItem(g, BUFFS.find(b => b.id === it.b), g.world.layout.mounts[it.mi], { remote: true, id: it.id }));
  syncMilks(g, s.milks);
  g.darts.applyState(s.dm, s.ds, s.dx, s.dr);
  for (const e of s.ev || []) applyEvent(g, e);
  if ((s.st === 'over' || s.st === 'won') && g.state === 'playing') {
    g.state = s.st; const ov = g.pendingOver; if (s.st === 'won') { Audio.bellOut(); setTimeout(() => Audio.win(), 1800); } else Audio.lose();
    setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); g.showOver(ov ? ov.title : (s.st === 'won' ? '下課！老師投降了' : '全班被罰坐了'), ov ? ov.sub : '', s.st === 'won', ov ? ov.stats : null); }, s.st === 'won' ? 3200 : 0);
  }
}

function sync(g, key, list, make) {
  const byId = new Map(g[key].map(o => [o.id, o])), seen = new Set();
  for (const st of list) { seen.add(st.id); let o = byId.get(st.id); if (!o) { o = make(st); g[key].push(o); } o.applyState(st); }
  for (let i = g[key].length - 1; i >= 0; i--) if (!seen.has(g[key][i].id)) { g[key][i].dispose(); g[key].splice(i, 1); }
}
function syncMilks(g, list) {
  const seen = new Set(list.map(m => m.id));
  for (const m of list) if (!g.milks.some(x => x.id === m.id)) { const mk = g.makeMilk(m.x, m.y, m.z, m.k); mk.id = m.id; mk.kind = m.k; g.milks.push(mk); if (m.k === 'ammo') Audio.itemSpawn(); else Audio.milkSpawn(); }
  for (let i = g.milks.length - 1; i >= 0; i--) if (!seen.has(g.milks[i].id)) { g.scene.remove(g.milks[i].mesh); g.milks.splice(i, 1); }
}
function applyEvent(g, e) {
  switch (e.t) {
    case 'msg': g.ui.message(e.a, e.b, e.d); break;
    case 'debris': g.spawnDebris(new THREE.Vector3(...e.p), e.c, e.s, new THREE.Vector3(...e.v), e.l); break;
    case 'ring': g.spawnRing(new THREE.Vector3(...e.p), e.r, e.c); break;
    case 'sfx': if (e.n === 'footstepsLater') setTimeout(() => Audio.footsteps(), 3200); else if (typeof Audio[e.n] === 'function') Audio[e.n](); break;
    case 'hitmark': g.ui.hitmark(); g.player.hits++; break;
    case 'buff': g.myBuff = e.b; g.ui.buff(e.b); Audio.item(); break;
    case 'zone': g.addZone(new THREE.Vector3(e.p[0], 0, e.p[1]), e.r, e.l, e.k || 'acid'); break;
    case 'prop': { const p = g.props[e.id]; if (p) p.applyState(e.st); break; }
    case 'wave': g.spawnWave(new THREE.Vector3(e.p[0], 0, e.p[1]), e.r, e.d, e.c); break;
    case 'pickup': { const p = g.player; p.reserve = Math.min(p.reserveCap(), p.reserve + e.n); Audio.pickup(); g.ui.ammo(p.ammo, p.ammo === 0, p.reserve); g.ui.pickFlash(); break; }
    case 'drink': Audio.drink(); g.ui.message('咕嚕咕嚕，喝了鮮奶！', '+1 ♥', 1.6); break;
    case 'emote': { const text = EMOTES[e.n]; if (text && g.hostFigure) { g.hostFigure.say(text); g.ui.message(`${PLAYER_SKINS.host.name}：${text}`, '', 1.2); } break; }
    case 'over': g.pendingOver = e; break;
  }
}
