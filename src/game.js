import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';
import { World } from './world.js';
import { Darts } from './darts.js';
import { Student } from './student.js';
import { Teacher } from './teacher.js';
import { Bully } from './bully.js';
import { Dodgeball } from './dodgeball.js';
import { Monitor } from './monitor.js';
import { SpecialItem } from './item.js';
import { Player } from './player.js';
import { UI, $ } from './ui.js';
import { RemotePlayer } from './remoteplayer.js';
import { serializeSnapshot, applySnapshot, applyDelta } from './net/snapshot.js';
import { NetStats } from './net/stats.js';
import { PaperFigure } from './paperfigure.js';
import { NET, PLAYER_SKINS, PLAYERS, GUEST_SLOTS, skinOf, skinFor, COOP, EMOTES, DIFFICULTY, SIEGE, TOILET, LUNCH, MP } from './config.js';
import { LunchMode } from './lunch.js';
import { STORY, Progress, starsFor, starText } from './story.js';
import { Ach } from './achievements.js';
import { Badges } from './badges.js';
import { TEACHERS, BOSSES, COMMITTEE, GANG } from './teachers.js';
import { LAYOUTS, LAYOUT_IDS, layoutById } from './layouts.js';
import { Prop } from './props.js';
import { TouchControls } from './touch.js';
import { UPGRADES, offerFor, takeUpgrade, byId as upgradeById, freshUp as freshUpRemote } from './upgrades.js';

// ============================================================
//  Game
// ============================================================
export class Game {
  constructor(opts = {}) {
    // role: 'solo' (default), 'host' (runs the simulation and streams it) or 'guest' (renders snapshots)
    this.role = opts.role || 'solo'; this.isHost = this.role !== 'guest'; this.transport = opts.transport || null;
    this.seq = 0; this.events = []; this.snapTimer = 0; this.inputTimer = 0; this.pending = []; this.hostFigure = null;
    // host side: one RemotePlayer per guest slot (g1..g3); conns maps a transport connection to its slot, pids remembers slots across reconnects
    this.remotes = new Map(); this.conns = new Map(); this.pids = new Map(); this.goneTimers = new Map();
    // guest side: the host's figure plus the other guests
    this.others = new Map(); this.mySlot = 'host'; this.buffs = {};
    this.pid = opts.pid || Game.persistentId();
    this.profile = { name: '', look: '' }; // what this player typed and picked on the front page (the lobby fills it)
    try { this.profile.name = localStorage.getItem('cnw-name') || ''; this.profile.look = localStorage.getItem('cnw-look') || ''; } catch (e) { /* ignore */ }
    this.net = new NetStats(); this.showNet = true; this.pvSeq = 0; this.snapSeq = 0; this.pingT = 0; this.acc = 0;
    PaperFigure.renderTime = () => performance.now() - (this.isHost ? 100 : this.net.delay); // guests from inputs: 100 ms behind; snapshots: adaptive
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    $('game').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xfbf6e6);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 60);
    this.scene.add(this.camera);
    // light: afternoon sun from the windows (-x side) + soft fill
    const hemi = new THREE.HemisphereLight(0xfff4dc, 0xc9b79a, 0.9); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0c8, 1.4); sun.position.set(-7, 6, 1); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7; sun.shadow.camera.near = 1; sun.shadow.camera.far = 25; sun.shadow.bias = -0.0015;
    this.scene.add(sun);
    this.world = new World(this.scene, 'classroom'); this.mapChoice = 'random';
    this.darts = new Darts(this.scene, this.world);
    this.ui = new UI();
    this.player = new Player(this);
    this.students = []; this.teachers = []; this.slowT = 0; this.bellT = 0; this.bell = null; this.bossName = ''; this.milks = []; this.milkTimer = 0; this.milkTex = Draw.tex(Draw.milkCarton());
    this.bully = null; this.ball = null; this.monitor = null; this.debris = []; this.rings = [];
    this.items = []; this.itemTimer = 0; this.zones = []; this.props = [];
    this.state = 'menu'; this.wave = 0; this.score = 0; this.kills = 0; this.spawnQueue = []; this.spawnTimer = 0; this.waveTimer = 0; this.difficultySpread = 1;
    this.level = 'normal'; this.diff = DIFFICULTY.normal; this.offer = null; this.offerTimer = 0; this.supplyTimer = 0;
    this.mode = 'class'; this.siege = false; this.bossDue = 0; this.bossDef = null; // 守校門模式
    this.toilet = false; this.timeLeft = 0; this.refillT = 0; // 搶廁所模式
    this.lunch = false; this.lunchMode = null; // 午餐大作戰
    this.story = null; this.damageTaken = 0; this.wetCount = 0; this.dustHit = false; this.hornHits = 0; this.bumps = 0; this.roundDone = false; this.clockT = 0; this.hintsShown = {}; // 故事與成就用的計數
    this.forceTeacher = new URLSearchParams(location.search).get('teacher'); // debug: ?teacher=pe
    this.clock = new THREE.Clock(); this.hasLock = false; this.lockSupported = 'requestPointerLock' in document.body;
    this.touchCtl = new TouchControls(this); this.touch = this.touchCtl.on;
    this.bindInput(); this.resize(); window.addEventListener('resize', () => this.resize());
    // iOS reports the new size a moment after rotating or hiding the toolbar
    window.addEventListener('orientationchange', () => { this.resize(); setTimeout(() => this.resize(), 350); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
    if (this.transport) this.attachTransport(this.role, this.transport); else this.darts.localWho = 'host';
    this.renderer.setAnimationLoop(() => this.frame());
  }
  // ---------- connection lifecycle (called by the lobby) ----------
  static persistentId() {
    try { let id = localStorage.getItem('cnw-pid'); if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('cnw-pid', id); } return id; } catch (e) { return Math.random().toString(36).slice(2, 10); }
  }
  attachTransport(role, transport) {
    this.role = role; this.isHost = role !== 'guest'; this.transport = transport;
    this.mySlot = 'host'; this.darts.localWho = 'host'; this.net.reset();
    const raw = transport.send.bind(transport); transport.send = (str, to, fast) => { this.net.bytesOut += str.length; raw(str, to, fast); };
    transport.onMessage((str, from) => { this.net.bytesIn += str.length; this.onNet(str, from); });
    if (!this.isHost) this.sendHello();
  }
  detachTransport() {
    if (this.transport && this.transport.close) this.transport.close();
    this.transport = null; this.role = 'solo'; this.isHost = true; this.mySlot = 'host'; this.darts.localWho = 'host';
    for (const r of this.remotes.values()) r.dispose(); this.remotes.clear(); this.conns.clear(); this.pids.clear();
    for (const t of this.goneTimers.values()) clearTimeout(t); this.goneTimers.clear();
    for (const o of this.others.values()) o.dispose(); this.others.clear();
    if (this.hostFigure) { this.hostFigure.dispose(); this.hostFigure = null; }
  }
  // ---- who is who ----
  get remote() { return this.remotes.values().next().value || null; } // the first guest (two-player code paths and tests)
  remoteBySlot(slot) { return this.remotes.get(slot) || null; }
  remoteList() { return [...this.remotes.values()].filter(r => r.group.visible && !r.offline); }
  connOf(slot) { for (const [c, s] of this.conns) if (s === slot) return c; return null; }
  sendTo(slot, msg) { const c = this.connOf(slot); if (c && this.transport) this.transport.send(JSON.stringify(msg), c); }
  lobbyNames() { return [...this.remotes.values()].filter(r => !r.offline && this.connOf(r.slot)).map(r => r.skin.name + (r.touch ? '📱' : '')); }
  sendHello() { if (this.transport && !this.isHost) this.transport.send(JSON.stringify({ t: 'hello', pid: this.pid, touch: this.touch ? 1 : 0, name: this.profile.name, look: this.profile.look, badge: Badges.effects() })); }
  badgeSlots() { return Badges.slots(Progress.finished()); }
  badgeHud() { this.ui.badge(Badges.worn().map(b => Badges.label(b)).join('・')); }
  mySkin() { return skinFor(this.mySlot, this.profile.name, this.profile.look); }
  touchOf(who) { if (!who || who === 'host') return !!this.touch; const r = this.remotes.get(who); return !!(r && r.touch); }
  hitMul(who) { return this.touchOf(who) ? CFG.assist.hitMul : 1; }
  baseHp(pl) { return (this.toilet ? TOILET.hp : CFG.player.hp) + (pl && pl.touch ? CFG.assist.extraHp : 0); }
  // a guest said hello on a connection: give it its slot (the same one if it came back) and catch it up
  onHello(from, pid, touch = false, name = '', look = '', badge = null) {
    let slot = this.pids.get(pid);
    if (!slot) {
      const used = new Set(this.pids.values());
      slot = GUEST_SLOTS.slice(0, COOP.maxGuests).find(s => !used.has(s));
      if (!slot) { this.transport.send(JSON.stringify({ t: 'full' }), from); return; }
      this.pids.set(pid, slot);
    }
    for (const [c, s] of [...this.conns]) if (s === slot && c !== from) this.conns.delete(c);
    this.conns.set(from, slot);
    let r = this.remotes.get(slot); const back = !!r;
    const skin = skinFor(slot, name, look);
    if (!r) { r = new RemotePlayer(this, skin); this.remotes.set(slot, r); } else r.applySkin(skin);
    r.offline = false; r.group.visible = true; r.touch = touch; r.badge = badge || null; if (!back) { r.maxHp = this.baseHp(r) + this.badgeHp(r.badge); r.hp = r.maxHp; }
    if (this.goneTimers.has(slot)) { clearTimeout(this.goneTimers.get(slot)); this.goneTimers.delete(slot); }
    this.transport.send(JSON.stringify({ t: 'welcome', slot, name: r.skin.name }), from);
    this.fullSnapNext = true;
    if (this.state === 'playing' || this.state === 'paused') {
      this.transport.send(JSON.stringify({ t: 'start', map: this.world.layout.id, coop: 1, resume: 1, siege: this.siege ? 1 : 0, toilet: this.toilet ? 1 : 0, lunch: this.lunch ? 1 : 0 }), from);
      this.transport.send(JSON.stringify({ t: 'restore', taken: r.up.taken, ammo: r.ammo, res: r.reserve, hp: r.hp, buff: this.buffs[slot] || null }), from);
      if (!this.stats[slot]) this.stats[slot] = { kills: 0, hits: 0, revives: 0, strokes: 0, milk: 0 };
      this.message(back ? `${r.skin.name}回來了！` : `${r.skin.name}中途加入了！`, '', 1.5);
    }
    if (this.onLobbyChange) this.onLobbyChange();
  }
  onPeerOpen() { this.fullSnapNext = true; } // the hello that follows does the rest
  onPeerClosed(connId) {
    if (this.isHost) {
      const slot = this.conns.get(connId); if (!slot) return; this.conns.delete(connId);
      const r = this.remotes.get(slot); if (!r) return; r.offline = true;
      if (this.state === 'playing') this.message(`${r.skin.name}斷線了`, '30 秒內可以回來', 2.5);
      this.goneTimers.set(slot, setTimeout(() => this.onPeerGone(slot), 30000));
      if (this.onLobbyChange) this.onLobbyChange();
    } else if (this.state === 'playing' || this.state === 'paused') { this.message('房主離開了教室', '回到首頁', 2.5); setTimeout(() => location.reload(), 2500); }
  }
  onPeerGone(slot) { const r = this.remotes.get(slot); if (this.isHost && r && r.offline) { r.group.visible = false; this.message(`${r.skin.name}回不來了`, '剩下的人撐住', 2.5); } }
  nextId() { return ++this.seq; }
  // ---------- rooms ----------
  setLayout(id, siege = false) {
    if (this.world.layout.id === id && !!this.world.siege === !!siege) return;
    this.world.dispose(); this.world = new World(this.scene, id, { siege }); this.darts.world = this.world;
  }
  waveLabel(n) { return this.lunch ? (this.lunchMode ? (this.lunchMode.roleOf(this.mySlot) === 'driver' ? '推車手' : '射手') : '—') : this.toilet ? `剩 ${this.cansLeft()}` : this.siege ? `${n}/${SIEGE.waves.length}` : n; }
  cansLeft() { return (this.world.cans || []).filter(c => c.alive).length; }
  // ---------- 午餐大作戰 ----------
  // ---------- 故事模式與成就 ----------
  unlock(id) { Ach.unlock(id); }
  toiletTime() { return this.story && this.story.time ? this.story.time : TOILET.time; }
  storyHint(key) { if (!this.story || !this.story.hints || !this.story.hints[key] || this.hintsShown[key]) return; this.hintsShown[key] = true; const text = this.story.hints[key]; if (this.lunchMode && this.lunchMode.buddy) this.lunchMode.buddySay(text); this.ui.buddy(text); }
  startStory(ch) {
    if (this.state !== 'menu') return;
    this.story = ch; this.savedLevel = this.level; this.savedMode = this.mode; this.storyProfile = { ...this.profile };
    this.profile = { name: 'Jason', look: 'jason' }; this.setDifficulty(ch.level || 'normal'); this.mode = ch.mode; this.mapChoice = ch.map || 'random'; this.forceTeacher = ch.teacher || null;
    this.start();
    if (this.state !== 'playing') { this.story = null; this.profile = this.storyProfile; this.setDifficulty(this.savedLevel); this.mode = this.savedMode; return; }
    setTimeout(() => { if (this.story === ch && this.state === 'playing') this.storyHint('start'); }, 4500);
  }
  // end of any round: stickers and story stars
  afterRound(win) {
    if (this.roundDone) return; this.roundDone = true;
    this.drawnBadge = Badges.roll(this.level, win, this.coop || !this.isHost); this.drawnDropped = this.drawnBadge ? Badges.add(this.drawnBadge) : null;
    if (!this.isHost) { if (win) { Ach.unlock('first_win'); if (this.damageTaken === 0) Ach.unlock('untouched'); } return; }
    const p = this.player, acc = p.shots ? p.hits / p.shots : 0, plain = !this.siege && !this.toilet && !this.lunch;
    if (this.kills) Ach.add('kills', this.kills);
    if (win) {
      Ach.unlock('first_win');
      if (p.shots >= 30 && acc >= 0.5) Ach.unlock('sharp');
      if (this.damageTaken === 0) Ach.unlock('untouched');
      if (this.siege) Ach.unlock('siege_win');
      if (this.toilet) { Ach.unlock('toilet_win'); if (this.wetCount === 0) Ach.unlock('dry'); if (this.toiletTime() - this.timeLeft <= 60) Ach.unlock('cans_fast'); }
      if (this.lunch && this.lunchMode) { if (this.lunchMode.stars() === 3) Ach.unlock('lunch3'); if (this.bumps === 0) Ach.unlock('no_bump'); }
      if (plain) {
        if (this.level === 'exam') Ach.unlock('exam_win');
        if (this.teachers.length && !this.dustHit) Ach.unlock('no_dust');
        for (const t of this.teachers) { const id = t.def.id; if (id === 'dean') Ach.unlock('dean'); else if (id === 'principal') Ach.unlock('principal'); else if (t.def.group === 'committee') Ach.unlock('committee'); else Ach.teacher(id); }
      }
    }
    if (this.lunch && this.hornHits >= 5) Ach.unlock('horn5');
    if (this.story) {
      this.storyStars = win ? starsFor(this.story, this) : 0;
      if (win) { Progress.setStars(this.story.id, this.storyStars); if (this.story.finale) Ach.unlock('grad'); if (this.story.id === 'secret') Ach.unlock('secret'); if (Progress.allThree()) Ach.unlock('all3'); }
    }
  }
  driveInput() { const k = this.player.keys, tc = this.touchCtl, tm = tc && tc.on ? tc.move : null; return { f: (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0) + (tm ? -tm.z : 0), t: (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) + (tm ? tm.x : 0) }; }
  horn() { if (!this.lunch || !this.lunchMode) return; if (this.isHost) this.lunchMode.horn('host'); else { this.hornSeq = (this.hornSeq || 0) + 1; Audio.whistle(); } }
  refillShooter() { const LM = this.lunchMode, slot = LM.shooterSlot(); if (slot === 'ai') return; if (slot === 'host') { const p = this.player; p.ammo = p.magSize(); p.reserve = LUNCH.ammo; this.ui.ammo(p.ammo, false, p.reserve); this.ui.pickFlash(); } else { const r = this.remoteBySlot(slot); if (r) r.reserve = LUNCH.ammo; this.netEvent({ t: 'ammoSet', n: LUNCH.ammo }, slot); } }
  onBucket(i) { this.netEvent({ t: 'bucket', i }); this.message('撞倒水桶了！', '地上都是水，轉彎會滑', 1.5); Audio.thud(); }
  onSpill(n, why) { const c = this.lunchMode.cart; this.ui.soup(c.soup); this.spillT = this.spillT || 0; if (why === 'impact' || why === 'bucket') this.bumps++; if (why === 'impact') this.message('撞到了！湯灑出來', `湯剩 ${Math.round(c.soup)}%`, 1.5); else if (why === 'grab' && this.spillT <= 0) { this.spillT = 2; this.message('搶菜王在挖菜！', '射手回頭打他', 1.5); } }
  // 搶廁所：一罐被打破。飛散、計分、同步給隊友；最後一罐就贏
  breakCan(i, who = 'host') {
    const c = this.world.cans[i]; if (!c || !c.alive) return;
    c.alive = false; c.mesh.visible = false;
    const at = new THREE.Vector3(c.x, c.y - 0.2, c.z);
    for (let k = 0; k < 4; k++) this.spawnDebris(at, c.color, [0.08, 0.1, 0.08], new THREE.Vector3(rand(-1.5, 1.5), rand(2.5, 4), rand(-1.5, 1.5)), 2.5);
    Audio.thud(); this.netEvent({ t: 'sfx', n: 'thud' }); this.lastShooter = who; this.addScore(CFG.score.hit * 5); this.hitmark(); this.lastShooter = null; this.stat(who, 'cans');
    const left = this.cansLeft(); this.ui.wave(this.waveLabel(0));
    if (left === 0) { this.onWin(); return; }
    this.message(`罐子破了！還剩 ${left} 個`, left <= 2 ? '快，時間不多' : '', 1.2); if (left <= 2) this.storyHint('low');
  }
  // 守校門：第 i 個惡霸從哪裡進來。帶頭的一定走校門；其他人輪流校門、爬牆、水溝蓋
  siegeEntry(i, leader) {
    const L = this.world.layout, S = L.siege || { drains: [], climbs: [] }, kind = leader ? 'gate' : SIEGE.entries[i % SIEGE.entries.length];
    if (kind === 'wall' && S.climbs.length) { const k = i % S.climbs.length, [x, z] = S.climbs[k]; return { at: { x, z }, entry: { kind, index: k }, leader }; }
    if (kind === 'drain' && S.drains.length) { const k = i % S.drains.length, [x, z] = S.drains[k]; return { at: { x, z }, entry: { kind, index: k }, leader }; }
    const door = L.doors[i % 2]; return { at: { x: door.x - 0.3, z: door.z }, entry: { kind: 'gate' }, leader };
  }
  pickLayout() { return this.mapChoice && this.mapChoice !== 'random' && LAYOUTS[this.mapChoice] ? this.mapChoice : pick(LAYOUT_IDS); }
  // a slow shockwave ring (the dean's broadcast)
  spawnWave(at, radius, dur, color) {
    this.netEvent({ t: 'wave', p: [+at.x.toFixed(2), +at.z.toFixed(2)], r: radius, d: dur, c: color });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, this.world.heightAt(at.x, at.z) + 0.05, at.z); this.scene.add(m); this.rings.push({ mesh: m, t: 0, radius, slow: dur });
  }
  setDifficulty(level) { if (DIFFICULTY[level]) { this.level = level; this.diff = DIFFICULTY[level]; } }
  // how many students are currently firing; the difficulty caps this
  extraPlayers() { return this.coop ? Math.max(0, this.players().length - 1) : 0; } // 多人加碼的基準：比單人多幾個人
  shootersBusy() { let n = 0; for (const s of this.students) if (s.alive && s.state === 'shoot') n++; return n >= this.diff.maxShooters + Math.round(MP.shooters * this.extraPlayers()) + (this.leaderAlive() ? 1 : 0); }
  leaderAlive() { return this.students.some(s => s.alive && s.leader); }
  // the wave leader (班長) fell: the rest panic for a while
  onLeaderDown(s) {
    this.addScore(CFG.score.leader); this.panicT = CFG.leader.panicSeconds;
    for (const o of this.students) if (o.alive && o !== s && o.state !== 'flyOut') { o.state = 'hide'; o.timer = rand(1.5, 2.5); o.alert.visible = false; }
    this.message('班長出局了！', '被叫去辦公室，其他人慌了，趁現在', 2);
  }
  // everyone the enemies can go after (host side); the guest counts once connected and not sitting
  players() { return this.isHost ? [this.player, ...this.remoteList()] : [this.player]; }
  activeTargets() { const l = this.players().filter(p => !p.sitting); return l.length ? l : [this.player]; }
  stat(who, key, n = 1) { if (!this.stats) return; if (!this.stats[who]) this.stats[who] = { kills: 0, hits: 0, revives: 0, strokes: 0, milk: 0 }; this.stats[who][key] = (this.stats[who][key] || 0) + n; }
  // one player ran out of hearts
  onPlayerDown(p) {
    if (this.lunch) { p.sitDown({ x: p.pos.x, z: p.pos.z }, LUNCH.downSeconds); const name = p === this.player ? '你' : p.skin.name; this.message(`${name}被打倒了`, `${LUNCH.downSeconds} 秒後自己爬起來`, 2); return; }
    if (!this.coop) { if (p === this.player) this.onLose(); return; }
    const near = this.world.desks.filter(d => !d.occupant).sort((a, b) => Math.hypot(a.seat.x - p.pos.x, a.seat.z - p.pos.z) - Math.hypot(b.seat.x - p.pos.x, b.seat.z - p.pos.z));
    const seat = near.length ? near[0].seat : { x: p.pos.x, z: p.pos.z };
    p.sitDown(seat);
    const name = p === this.player ? '你' : p.skin.name;
    this.message(`${name}被打到回座位了`, '隊友走過去按 E 可以救', 2);
    if (this.players().every(x => x.sitting)) this.onLose();
  }
  // someone standing at `at` pulls up the nearest sitting player within reach; returns that player
  reviveNear(at, except) {
    const sitting = this.players().filter(x => x !== except && x.sitting && Math.hypot(x.pos.x - at.x, x.pos.z - at.z) < COOP.reviveRadius);
    if (!sitting.length) return null;
    sitting.sort((a, b) => Math.hypot(a.pos.x - at.x, a.pos.z - at.z) - Math.hypot(b.pos.x - at.x, b.pos.z - at.z));
    const t = sitting[0]; t.standUp(COOP.reviveHp); return t;
  }
  tryRevive() {
    if (this.state !== 'playing') return;
    if (this.isHost) {
      if (this.player.sitting) return;
      const r = this.reviveNear(this.player.pos, this.player);
      if (r) { this.stat('host', 'revives'); this.addScore(200); this.message(`你把${r.skin.name}拉起來了！`, '+200', 1.6); this.netEvent({ t: 'sfx', n: 'wave' }); }
    } else if (this.transport) this.transport.send(JSON.stringify({ t: 'revive' }));
  }
  emote(n) {
    const text = EMOTES[n]; if (!text || this.state !== 'playing') return;
    if (this.emoteCd > performance.now()) return; this.emoteCd = performance.now() + 1500;
    this.ui.message(`你：${text}`, '', 1.2);
    if (this.isHost) this.netEvent({ t: 'emote', who: 'host', n });
    else if (this.transport) this.transport.send(JSON.stringify({ t: 'emote', n }));
  }
  netEvent(e, to) { if (this.isHost && this.transport) { if (to) e.to = to; this.events.push(e); } }
  // ---------- network ----------
  onNet(str, from = 'peer') {
    let m; try { m = JSON.parse(str); } catch (e) { return; }
    if (this.isHost) {
      if (m.t === 'hello') { this.onHello(from, m.pid, !!m.touch, m.name, m.look, m.badge); return; }
      if (m.t === 'ping') { this.transport.send(JSON.stringify({ t: 'pong', ts: m.ts }), from); return; }
      const slot = this.conns.get(from), r = slot ? this.remotes.get(slot) : null; if (!r) return;
      if (m.t === 'input') { PaperFigure.stamp = performance.now(); r.applyInput(m); PaperFigure.stamp = undefined; if (m.cf !== undefined) r.cartIn = { f: m.cf, t: m.ct || 0 }; if (m.hn && m.hn !== r.hornSeq) { r.hornSeq = m.hn; if (this.lunchMode) this.lunchMode.horn(slot); } if (m.rtt !== undefined) this.net.peers[slot] = m.rtt; }
      else if (m.t === 'fire') { if (r.sitting) return; const d = this.darts.fire(new THREE.Vector3(...m.p), new THREE.Vector3(...m.d), m.s || CFG.gun.speed, 'player'); d.who = slot; d.pv = m.pv || 0; if (m.vy) d.volley = slot + m.vy; if (this.monitor) this.monitor.noticeShot(r); }
      else if (m.t === 'pick') { { const u = takeUpgrade(r.up, m.id); if (u && r.up.healFull) { r.maxHp = this.baseHp(r) + r.up.maxHpBonus + this.badgeHp(r.badge); r.hp = r.maxHp; r.up.healFull = false; } if (r.up.refill) { r.reserve += r.up.refill; r.up.refill = 0; } } if (this.offer) { this.offer.picked[slot] = true; this.maybeCloseOffer(); } }
      else if (m.t === 'revive') {
        if (r.sitting) return; const t = this.reviveNear(r.pos, r);
        if (t) { this.stat(slot, 'revives'); this.addScore(200); this.message(`${r.skin.name}把${t === this.player ? '你' : t.skin.name}拉起來了！`, '+200', 1.6); this.netEvent({ t: 'sfx', n: 'wave' }); }
      }
      else if (m.t === 'emote') { const text = EMOTES[m.n]; if (text) { r.say(text); this.ui.message(`${r.skin.name}：${text}`, '', 1.2); this.netEvent({ t: 'emote', who: slot, n: m.n }); } }
    } else {
      if (m.t === 'welcome') { this.mySlot = m.slot; this.darts.localWho = m.slot; if (this.onWelcome) this.onWelcome(m); }
      else if (m.t === 'full') { if (this.onFull) this.onFull(); }
      else if (m.t === 'start') { this.siege = !!m.siege; this.toilet = !!m.toilet; this.lunch = !!m.lunch; if (m.level) this.setDifficulty(m.level); if (m.map) this.setLayout(m.map, this.siege); this.startGuest(); if (m.coop && !m.resume) this.giveStarter(this.mySlot); }
      else if (m.t === 'restore') { // back after a disconnect: the host remembers what we had
        const p = this.player;
        for (const [id, n] of Object.entries(m.taken || {})) for (let i = 0; i < n; i++) { const u = takeUpgrade(p.up, id); if (u) { p.up.refill = 0; p.up.healFull = false; p.applyUpgrade(u); } }
        if (m.ammo !== undefined) { p.ammo = m.ammo; p.reserve = m.res; } p.hp = m.hp; p.maxHp = this.baseHp(p) + p.up.maxHpBonus; this.ui.hp(p.hp, p.maxHp); this.ui.ammo(p.ammo, p.ammo === 0, p.reserve);
        this.ui.upgrades(Object.entries(p.up.taken).map(([k, n]) => upgradeById(k).name + (n > 1 ? '×' + n : '')));
        if (m.buff) { this.myBuff = m.buff; this.ui.buff(m.buff); }
        this.message('歡迎回來，升級和彈藥都還在', '', 2);
      }
      else if (m.t === 'offer') this.showOfferFromHost(m.ids);
      else if (m.t === 'snap') { if (this.net.onSnapshot(m.seq, m.ts, performance.now())) { this.pending.push(m); if (this.pending.length > 30) this.pending.shift(); } }
      else if (m.t === 'delta') { this.pending.push(m); }
      else if (m.t === 'pong') this.net.onPong(m.ts, performance.now());
    }
  }
  startGuest() {
    Audio.init(); Audio.resume();
    this.guestReset(); this.markTouchPlayer();
    this.state = 'playing';
    $('menu').hidden = true; $('pause').hidden = true; $('over').hidden = true; $('hud').hidden = false;
    this.ui.infinite = this.siege; this.ui.timer(this.toilet ? this.toiletTime() : this.lunch ? LUNCH.time : null); this.ui.leftLabel(this.toilet ? '清潔隊' : this.lunch ? '搶菜' : this.siege ? '惡霸' : '同學'); this.ui.waveLabelText(this.toilet ? '罐子' : this.lunch ? '角色' : '波次'); this.ui.wet(false); this.ui.soup(null);
    if (this.lunch) { this.lunchMode = new LunchMode(this); this.message('抬午餐囉！', '推車手：W/S 推煞、A/D 轉彎、F 喇叭。射手：擋住探頭的同學', 4); }
    this.ui.hp(this.player.hp, this.player.maxHp); this.ui.ammo(this.player.ammo, false, this.player.reserve); this.ui.score(0); this.ui.wave(this.waveLabel(1)); this.ui.left(0); this.ui.boss(false); this.ui.buff(null);
    if (this.lockSupported && !this.touch) this.requestLock(); else if (this.touch) this.enterFullscreen();
    Audio.bellOut();
    this.clock.getDelta();
  }
  badgeHp(fx) { return fx ? (this.toilet ? Math.min(1, fx.hp) : fx.hp) : 0; }
  markTouchPlayer() { const p = this.player; p.touch = !!this.touch; p.badge = Badges.effects(); p.maxHp = this.baseHp(p) + p.up.maxHpBonus + this.badgeHp(p.badge); p.hp = p.maxHp; this.badgeHud(); }
  guestReset() {
    if (this.lunchMode) { this.lunchMode.dispose(); this.lunchMode = null; }
    for (const c of this.world.cans || []) { c.alive = true; c.mesh.visible = true; }
    this.dustT = 0; this.ui.dust(0, this.renderer.domElement);
    this.students.forEach(s => s.dispose()); this.students = [];
    this.teachers.forEach(t => t.dispose()); this.teachers = [];
    if (this.bully) { this.bully.dispose(); this.bully = null; } if (this.monitor) { this.monitor.dispose(); this.monitor = null; } if (this.ball) { this.ball.dispose(); this.ball = null; }
    this.items.forEach(i => i.dispose()); this.items = []; this.milks.forEach(m => this.scene.remove(m.mesh)); this.milks = [];
    this.debris.forEach(d => this.scene.remove(d.mesh)); this.debris = []; this.rings.forEach(r => this.scene.remove(r.mesh)); this.rings = [];
    this.darts.clear(); this.world.setTally(0); this.zones.forEach(z => { this.scene.remove(z.mesh); (z.puffs || []).forEach(p => this.scene.remove(p)); }); this.zones = [];
    this.props.forEach(p => p.dispose()); this.props = (this.world.layout.props || []).map((d, i) => new Prop(this, d, i));
    this.camera.remove(this.player.gun); this.player = new Player(this); this.markTouchPlayer();
    this.wave = 0; this.score = 0; this.kills = 0; this.buffs = {}; this.bossPhase = false; this.pending = []; this.ui.closeOffer(); this.ui.upgrades([]); this.ui.buff(null);
  }
  guestStep(dt) {
    this.player.update(dt); this.aimAssist(dt);
    // apply every snapshot that arrived since the last frame, in order: the deltas inside depend on it
    if (this.pending.length) { const list = this.pending; this.pending = []; for (const m of list) { if (m.t === 'delta') applyDelta(this, m); else applySnapshot(this, m); } }
    this.pingT -= dt; if (this.pingT <= 0 && this.transport) { this.pingT = 1; this.transport.send(JSON.stringify({ t: 'ping', ts: Math.round(performance.now()) })); }
    for (const s of this.students) s.update(dt);
    for (let i = this.students.length - 1; i >= 0; i--) if (this.students[i].gone) { this.students[i].dispose(); this.students.splice(i, 1); } // leaders who left for the office
    for (const t of this.teachers) t.update(dt);
    if (this.lunchMode) for (const k of this.lunchMode.kids) k.update(dt);
    if (this.bully) this.bully.update(dt); if (this.monitor) this.monitor.update(dt); if (this.ball) this.ball.update(dt);
    if (this.hostFigure) this.hostFigure.update(dt);
    for (const o of this.others.values()) o.update(dt);
    for (const i of this.items) i.update(dt);
    if (this.myBuff) { this.myBuff.t -= dt; if (this.myBuff.t <= 0) { this.myBuff = null; this.ui.buff(null); } else this.ui.buff(this.myBuff); }
    for (const m of this.milks) { m.t += dt; m.mesh.position.y = m.baseY + Math.sin(m.t * 3) * 0.02; m.mesh.rotation.y = m.t * 1.2; }
    this.updateDebris(dt); this.updateZones(dt); for (const p of this.props) p.update(dt); this.world.tick(dt);
    // our own preview darts stop at the kids they visibly reach; the host decides whether it counted
    this.darts.remoteUpdate(dt, (p) => this.students.some(s => s.alive && Math.abs(p.x - s.group.position.x) < 0.36 && Math.abs(p.z - s.group.position.z) < 0.36 && p.y > s.group.position.y && p.y < s.group.position.y + 1.45 * s.group.scale.y));
    this.inputTimer -= dt;
    if (this.transport && this.inputTimer <= 0) {
      this.inputTimer = 1 / NET.inputHz; const p = this.player;
      const msg = { t: 'input', x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(2), eye: +p.eye.toFixed(2), c: p.crouching ? 1 : 0, ammo: p.ammo, res: p.reserve, sh: p.shots, rtt: Math.round(this.net.rtt) };
      if (this.lunch && this.lunchMode && this.lunchMode.driver === this.mySlot) { const di = this.driveInput(); msg.cf = +di.f.toFixed(2); msg.ct = +di.t.toFixed(2); msg.hn = this.hornSeq || 0; }
      this.transport.send(JSON.stringify(msg), undefined, true);
    }
  }
  resize() {
    const vv = window.visualViewport, w = Math.round(vv ? vv.width : innerWidth), h = Math.round(vv ? vv.height : innerHeight);
    if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    // phones are much wider than 16:9: keep the horizontal field of view of a 16:9 screen (vertical 75°) instead of
    // letting the vertical 75° turn into a fisheye that is mostly ceiling and floor
    const base = 75, wideAspect = 16 / 9;
    this.camera.fov = this.camera.aspect <= wideAspect ? base : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base / 2)) * wideAspect / this.camera.aspect));
    this.camera.updateProjectionMatrix();
  }
  // ---------- input ----------
  bindInput() {
    const canvas = this.renderer.domElement;
    document.addEventListener('keydown', e => {
      if (e.code === 'F11') { e.preventDefault(); this.toggleFullscreen(); return; }
      if (e.code === 'Escape') { if (this.state === 'playing') this.pause(); return; }
      if (this.ui.offerOpen && /^Digit[1-3]$/.test(e.code)) { const b = $('upgrade-cards').children[+e.code[5] - 1]; if (b) this.pickUpgrade(b.dataset.id); return; }
      if (this.state !== 'playing') return;
      this.player.keys[e.code] = true;
      if (e.code === 'KeyR') this.player.reload();
      if (e.code === 'KeyE') this.tryRevive();
      if (e.code === 'KeyF' && this.lunch) this.horn();
      if (e.code === 'KeyN') { this.showNet = !this.showNet; if (!this.showNet) this.ui.net(''); }
      if (/^Digit[1-4]$/.test(e.code)) this.emote(+e.code[5]);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlLeft', 'ShiftLeft'].includes(e.code)) e.preventDefault();
      // Ctrl is crouch, so Ctrl+S / Ctrl+D / Ctrl+A... must not reach the browser's own shortcuts
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    });
    // Ctrl+W / Ctrl+T / Ctrl+N can't be blocked by a page; at least ask before crouch+forward closes the tab
    window.addEventListener('beforeunload', e => { if (this.state === 'playing') { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('keyup', e => { this.player.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.player.keys = {}; this.player.firing = false; });
    document.addEventListener('mousemove', e => {
      if (this.state !== 'playing') return;
      if (this.hasLock || !this.lockSupported || this.lockFailed) this.player.look(e.movementX, e.movementY);
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (this.state === 'playing') {
        if (this.lockSupported && !this.hasLock && !this.lockFailed && !this.touch) this.requestLock();
        this.player.firing = true; this.player.tryFire();
      }
    });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.player.firing = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.hasLock = document.pointerLockElement === canvas;
      if (this.hasLock) { this.lockFailed = false; this.lockFails = 0; this.lockPending = false; }
      else if (this.ignoreUnlock) this.ignoreUnlock = false; // we let go of the mouse on purpose (upgrade cards)
      else if (this.state === 'playing' && !this.ui.offerOpen) this.pause();
    });
    document.addEventListener('pointerlockerror', () => this.onLockFailed());
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) this.pause(); });
    // the start button belongs to the lobby (lobby.js), which decides between solo and a room
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-restart-pause').addEventListener('click', () => this.start());
    $('btn-again').addEventListener('click', () => this.start());
    if (!this.touch && !this.lockSupported) $('menu-note').textContent = '這台裝置沒有滑鼠鎖定，改用移動滑鼠轉視角。';
  }
  requestLock() {
    // without a click/key press behind it the browser always says no (the upgrade-card timer, the partner closing the offer):
    // don't count that as a failure, just ask for a click
    if (navigator.userActivation && !navigator.userActivation.isActive) { this.ui.message('點一下畫面', '鎖定滑鼠繼續瞄準', 2); return; }
    this.enterFullscreen();
    this.lockPending = true;
    try {
      const p = this.renderer.domElement.requestPointerLock();
      if (p && p.catch) p.catch(() => this.onLockFailed());
    } catch (e) { this.onLockFailed(); }
  }
  // fullscreen + Keyboard Lock (Chrome/Edge) is the only way a page receives Ctrl+W / Ctrl+T / Ctrl+N,
  // so crouch+forward can't close the tab. Leaving fullscreen (F11 or holding Esc) pauses; a short Esc still pauses too.
  enterFullscreen(fromButton = false) {
    const el = document.documentElement;
    if (document.fullscreenElement) { if (fromButton) document.exitFullscreen().catch(() => {}); return; }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { if (this.touch) this.ui.message('這個瀏覽器不支援全螢幕', 'iPhone：Safari 分享 → 加入主畫面，從主畫面開就是全螢幕', 4); return; }
    const p = req.call(el); if (!p || !p.then) return;
    p.then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {});
    }).catch(() => {}); // no user gesture (e.g. offer closed by the partner) or refused: just stay windowed
  }
  // F11 out = pause, F11 in = resume. Resuming runs inside the key press so the mouse can be locked again too.
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (this.state === 'paused') this.resume();
    else if (!this.touch) this.enterFullscreen();
  }
  // a refused lock is usually temporary (Chrome refuses for about a second after Esc, or mid fullscreen switch),
  // so the next click tries again; only a browser that keeps refusing (e.g. a sandboxed iframe) gets the free-cursor mode
  onLockFailed() {
    if (this.hasLock || this.lockFailed || !this.lockPending) return; // promise rejection + pointerlockerror: count once
    this.lockPending = false;
    this.lockFails = (this.lockFails || 0) + 1;
    if (this.lockFails >= 3) { this.lockFailed = true; this.ui.message('無法鎖定滑鼠', '改用移動滑鼠轉視角', 2.5); }
    else this.ui.message('滑鼠沒鎖住', '點一下畫面再試一次', 2);
  }
  // ---------- flow ----------
  start() {
    if (!this.isHost) return this.startGuest();
    Audio.init(); Audio.resume();
    if (this.story && this.remoteList().length) { this.ui.message('故事模式是單人的', '先離開房間再開始', 3); const el = $('lobby-status'); if (el) el.textContent = '故事模式是單人的，先離開房間。'; return; }
    if (this.mode === 'lunch' && this.remoteList().length !== 1 && !this.story) { const n = this.remoteList().length; const txt = n ? '午餐大作戰只能兩個人：房間裡只留一位隊友' : '午餐大作戰要兩個人：開房間找一位隊友再按開始'; this.ui.message(txt, '', 3); const el = $('lobby-status'); if (el) el.textContent = txt; const mn = $('menu-note'); if (mn && !n) mn.textContent = txt; return; }
    this.siege = this.mode === 'siege'; this.toilet = this.mode === 'toilet'; this.lunch = this.mode === 'lunch'; this.ui.infinite = this.siege;
    this.diff = this.siege ? { ...DIFFICULTY[this.level], waves: SIEGE.waves } : DIFFICULTY[this.level]; // 守校門：十波，其餘照難度
    if (this.story && this.story.waves) this.diff = { ...this.diff, waves: this.story.waves }; // 故事：章節自己的波次表
    this.setLayout(this.lunch ? 'corridor' : this.toilet ? 'toilet' : this.siege ? 'yard' : this.pickLayout(), this.siege);
    this.reset(); this.markTouchPlayer();
    this.coop = this.isHost && this.remoteList().length > 0; this.fullSnapNext = true; this.sentRestVersion = -1;
    this.stats = { host: { kills: 0, hits: 0, revives: 0, strokes: 0, milk: 0 } };
    for (const r of this.remotes.values()) { this.stats[r.slot] = { kills: 0, hits: 0, revives: 0, strokes: 0, milk: 0 }; r.hp = r.maxHp; r.sitting = false; r.setTex('normal'); r.targetSy = 1; }
    if (this.transport) this.transport.send(JSON.stringify({ t: 'start', map: this.world.layout.id, coop: this.coop ? 1 : 0, siege: this.siege ? 1 : 0, toilet: this.toilet ? 1 : 0, lunch: this.lunch ? 1 : 0, level: this.level }));
    if (this.coop) { this.giveStarter('host'); for (const r of this.remotes.values()) { const u = takeUpgrade(r.up, COOP.starters[r.slot]); if (u) { r.up.refill = 0; r.up.healFull = false; } } }
    this.state = 'playing';
    $('menu').hidden = true; $('pause').hidden = true; $('over').hidden = true; $('hud').hidden = false;
    this.ui.hp(this.player.hp, this.player.maxHp); this.ui.ammo(this.player.ammo, false, this.player.reserve); this.ui.score(0); this.ui.wave(this.waveLabel(1)); this.ui.left(0); this.ui.boss(false);
    if (this.lockSupported && !this.touch) this.requestLock(); else if (this.touch) this.enterFullscreen();
    Audio.bellOut();
    this.ui.timer(this.toilet ? this.toiletTime() : null); this.ui.leftLabel(this.toilet ? '清潔隊' : this.siege ? '惡霸' : '同學'); this.ui.waveLabelText(this.toilet ? '罐子' : '波次'); this.ui.wet(false);
    if (this.lunch) { // 午餐大作戰：餐車在六年二班門口，開房的人先推
      this.lunchMode = new LunchMode(this); this.ui.timer(LUNCH.time); this.ui.soup(null); this.ui.leftLabel('搶菜'); this.ui.waveLabelText('角色'); this.ui.wave(this.waveLabel(0));
      this.message('抬午餐囉！', '推車手：W/S 推煞、A/D 轉彎、F 喇叭。射手：擋住探頭的同學', 4);
      this.nextWavePending = false; this.ui.left(0);
    } else if (this.toilet) { // 搶廁所：清潔隊已經在裡面打掃；倒數開始
      this.message('下課了，快去廁所！', `清潔隊在打掃……${this.toiletTime()} 秒內射破全部 ${this.world.cans.length} 個罐子`, 3.5);
      this.timeLeft = this.toiletTime(); this.refillT = TOILET.refill;
      const spots = (this.world.layout.crewSpots || []).slice(); for (let i = 0; i < TOILET.crew + MP.crew * this.extraPlayers() && spots.length; i++) { const [x, z] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0]; this.students.push(new Student(this, { x, z })); }
      this.ui.left(this.students.length); this.nextWavePending = false;
    } else {
      if (this.siege) this.message('隔壁學校的惡霸軍團來了！', `守住${this.world.layout.name}十波，彈藥無限`, 3.5);
      else this.message('叮咚叮咚，下課了！', `${this.world.layout.name}變成戰場`, 3.5);
      this.waveTimer = 4.6; this.nextWavePending = true;
    }
    this.clock.getDelta();
  }
  reset() {
    this.students.forEach(s => s.dispose()); this.students = [];
    this.teachers.forEach(t => t.dispose()); this.teachers = []; this.slowT = 0; this.bellT = 0; this.bell = null;
    this.darts.clear(); this.world.desks.forEach(d => { d.occupant = null; d.covered = null; });
    this.milks.forEach(m => this.scene.remove(m.mesh)); this.milks = []; this.milkTimer = CFG.milk.interval;
    this.debris.forEach(d => this.scene.remove(d.mesh)); this.debris = []; this.rings.forEach(r => this.scene.remove(r.mesh)); this.rings = [];
    if (this.bully) this.bully.dispose(); if (this.monitor) this.monitor.dispose(); if (this.ball) this.ball.dispose();
    this.bully = null; this.monitor = null; this.ball = null;
    if (this.lunchMode) { this.lunchMode.dispose(); this.lunchMode = null; }
    const f = this.toilet || this.lunch ? { bully: false, ball: false, monitor: false } : this.siege ? { bully: false, ball: Math.random() < CFG.features.ball, monitor: false } : { bully: Math.random() < CFG.features.bully, ball: Math.random() < CFG.features.ball, monitor: Math.random() < CFG.features.monitor };
    const enabled = this.siege || this.toilet || this.lunch ? [] : Object.keys(f).filter(k => CFG.features[k] > 0);
    if (enabled.length && !enabled.some(k => f[k])) f[pick(enabled)] = true; // at least one surprise per game, but never a switched-off one
    this.features = f;
    if (f.bully) this.bully = new Bully(this);
    if (f.monitor) this.monitor = new Monitor(this);
    if (f.ball) this.ball = new Dodgeball(this);
    this.items.forEach(i => i.dispose()); this.items = []; this.itemTimer = rand(8, 20); this.buffs = {}; this.ui.buff(null);
    this.zones.forEach(z => { this.scene.remove(z.mesh); (z.puffs || []).forEach(p => this.scene.remove(p)); }); this.zones = [];
    this.props.forEach(p => p.dispose()); this.props = (this.world.layout.props || []).map((d, i) => new Prop(this, d, i));
    this.camera.remove(this.player.gun);
    this.player = new Player(this);
    this.wave = 0; this.score = 0; this.kills = 0; this.spawnQueue = []; this.difficultySpread = 1; this.bossPhase = false; this.events = []; this.panicT = 0; this.overInfo = null; this.bossDue = 0; this.bossDef = null; this.timeLeft = 0; this.refillT = 0; this.hintT = 0; this.ui.wet(false); this.ui.soup(null);
    this.damageTaken = 0; this.wetCount = 0; this.dustHit = false; this.hornHits = 0; this.bumps = 0; this.roundDone = false; this.clockT = 0; this.hintsShown = {}; this.storyStars = 0; this.bossTimer = 0;
    for (const c of this.world.cans || []) { c.alive = true; c.mesh.visible = true; }
    this.offer = null; this.offerTimer = 0; this.supplyTimer = 0; this.ui.closeOffer(); this.ui.upgrades([]); if (this.touchCtl) this.touchCtl.reset();
    this.dustT = 0; this.ui.dust(0, this.renderer.domElement);
    for (const r of this.remotes.values()) { r.up = freshUpRemote(); r.maxHp = this.baseHp(r) + this.badgeHp(r.badge); }
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; $('pause').hidden = false; this.player.keys = {}; this.player.firing = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing'; $('pause').hidden = true; this.clock.getDelta();
    if (this.lockSupported && !this.lockFailed && !this.touch) this.requestLock();
    else if (!this.touch) this.enterFullscreen();
    Audio.resume();
  }
  toMenu() { // from the pause or game-over screen; the lobby then hangs up any room
    if (this.story) { if (this.storyProfile) this.profile = this.storyProfile; this.story = null; this.forceTeacher = null; if (this.savedLevel) this.setDifficulty(this.savedLevel); if (this.savedMode) this.mode = this.savedMode; }
    if (this.isHost) this.reset(); else this.guestReset();
    this.state = 'menu';
    $('pause').hidden = true; $('over').hidden = true; $('hud').hidden = true; $('menu').hidden = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  startWave() {
    this.wave++; this.ui.wave(this.waveLabel(this.wave)); Audio.wave();
    for (const p of this.props) if (p.kind === 'bucket' && p.state !== 'up') { p.reset(); this.netEvent({ t: 'prop', id: p.id, st: 'up' }); }
    const ex = this.extraPlayers(), base = this.diff.waves[this.wave - 1], count = Math.round(base * (1 + MP.count * ex));
    this.difficultySpread = Math.max(this.diff.minSpread * (1 - MP.spread * ex), (this.diff.spread - (this.wave - 1) * 0.1) * (1 - MP.spread * ex));
    const doors = this.world.layout.doors;
    if (this.siege) { // 守校門：三種入口輪流；第 3、6、9、10 波的頭目晚幾秒跟進
      const bossId = (this.story && this.story.bosses ? this.story.bosses : SIEGE.bosses)[this.wave];
      this.message(`第 ${this.wave}/${SIEGE.waves.length} 波`, `${count} 個惡霸闖進來了${bossId ? '，頭目也來了' : ''}`, 2);
      this.spawnQueue = Array.from({ length: count }, (_, i) => this.siegeEntry(i, i === count - 1));
      if (bossId) { this.bossDef = GANG.find(x => x.id === bossId); this.bossDue = SIEGE.bossDelay; }
    } else {
      this.message(`第 ${this.wave} 波`, `${count} 位同學衝進來了`, 2);
      this.spawnQueue = Array.from({ length: count }, (_, i) => ({ door: doors[i % 2], leader: i === count - 1 }));
    }
    this.spawnTimer = 0.4; this.waveCount = count;
  }
  startBoss() {
    this.bossPhase = true;
    Audio.bellIn(); this.netEvent({ t: 'sfx', n: 'bellIn' });
    this.message('上課鐘響了……', '走廊傳來腳步聲，拿好你的槍', 4);
    setTimeout(() => Audio.footsteps(), 3200); this.netEvent({ t: 'sfx', n: 'footstepsLater' });
    this.bossTimer = 6.0;
    // everyone sneaks a bite of chocolate before the teacher walks in
    setTimeout(() => { if (this.state !== 'playing' || !this.bossPhase) return;
      const p = this.player; p.hp = Math.min(p.maxHp, p.hp + CFG.choco.heal); p.reserve = Math.min(p.reserveCap(), p.reserve + CFG.choco.ammo); this.ui.hp(p.hp, p.maxHp); this.ui.ammo(p.ammo, p.ammo === 0, p.reserve); this.ui.pickFlash();
      for (const r of this.remoteList()) { r.hp = Math.min(r.maxHp, r.hp + CFG.choco.heal); r.reserve = Math.min(CFG.gun.reserveMax + r.up.reserveBonus, r.reserve + CFG.choco.ammo); this.netEvent({ t: 'pickup', n: CFG.choco.ammo }, r.slot); }
      Audio.drink(); this.netEvent({ t: 'sfx', n: 'drink' }); this.message('趁老師還沒進來偷吃巧克力！', `回血 +${CFG.choco.heal}、補彈 +${CFG.choco.ammo}`, 3);
    }, 1500);
  }
  get teacher() { return this.teachers[0] || null; } // the first boss; the committee has three
  // the committee only comes to the hall (it needs a stage), and only for hard rounds or a pair
  pickBoss() {
    if (this.forceTeacher) return [...TEACHERS, ...BOSSES, COMMITTEE].find(x => x.id === this.forceTeacher) || pick(TEACHERS);
    if (Math.random() >= this.diff.bossChance) return pick(TEACHERS);
    const stageOk = !!this.world.layout.stage && (this.level === 'hard' || this.level === 'exam' || this.coop);
    return stageOk && Math.random() < 0.5 ? COMMITTEE : pick(BOSSES);
  }
  spawnTeacher(def = this.pickBoss()) {
    const door = this.world.layout.doors[0], extra = Math.min(3, this.extraPlayers()) * MP.bossWp;
    if (def.members) { // the whole committee walks in together
      def.members.forEach((m, i) => this.teachers.push(new Teacher(this, { x: door.x, z: door.z + (i - 1) * 0.7 }, { def: m, wpHp: def.wpHp + extra })));
      this.bellT = CFG.committee.bellEvery;
    } else this.teachers.push(new Teacher(this, door, { def, wpHp: (def.wpHp || CFG.teacher.wpHp) + extra }));
    for (const t of this.teachers) if (t.spawnAt === undefined) t.spawnAt = this.clockT;
    this.storyHint('boss');
    this.bossName = def.name;
    Audio.teacher(); if (def.sfx && Audio[def.sfx] && def.sfx !== 'teacher') setTimeout(() => Audio[def.sfx](), 500);
    this.message(def.intro[0], def.intro[1], 3.5);
    this.ui.boss(true); this.updateBossHud(); if (!this.siege) this.ui.left(def.name);
  }
  updateBossHud() { if (this.teachers.length) this.ui.bossWp(this.teachers.map(t => ({ name: t.def.short || t.def.name, entries: t.hudEntries(), max: t.wpMax, defeated: t.defeated }))); }
  // one boss fell; with the committee the others carry on, faster
  onTeacherDefeated(t) {
    const alive = this.teachers.filter(x => !x.defeated);
    this.updateBossHud();
    if (this.siege) { // 守校門：頭目倒了就退場
      if (t.def.id === 'gang1' && this.clockT - (t.spawnAt || 0) <= 20) Ach.unlock('siege_fast'); // 這波的小弟清光才算過；大王倒了也要等小弟清光（都倒了由波次判定收尾）
      this.addScore(CFG.score.leader);
      for (const o of this.students) if (o.alive && o.state !== 'flyOut') { o.state = 'hide'; o.timer = rand(1.5, 2.5); o.alert.visible = false; }
      this.message(`${t.def.name}倒了！`, this.wave >= SIEGE.waves.length ? '剩下的惡霸嚇壞了，清光他們就守住了' : '小弟們嚇壞了，趁現在', 2.5);
      t.goneT = 3.5; // leaves the field after the collapse (game time, see step)
      return;
    }
    if (!alive.length) return this.onWin();
    for (const o of alive) { o.overtime = true; if (alive.length === 1) o.alone = true; }
    this.message(`${t.def.name}崩潰了！`, alive.length === 1 ? `只剩${alive[0].def.name}，要下台追人了` : '剩下的監考官加班，更快更兇', 2.5);
  }
  // the committee's joint move: the bell rings, everybody must duck, the standing get three papers at once
  updateBell(dt) {
    if (this.bell) {
      this.bell.t -= dt;
      if (this.bell.t <= 0) {
        for (const pl of this.activeTargets()) if (!(pl.crouching || pl.crouch)) { pl.hurtCd = 0; pl.hurt(); this.message('沒蹲下，被三位監考一起丟！', '', 1.4); }
        Audio.blast(); this.netEvent({ t: 'sfx', n: 'blast' }); this.bell = null;
      }
      return;
    }
    if (this.teachers.length < 3 || this.teachers.some(t => t.defeated)) return;
    this.bellT -= dt;
    if (this.bellT <= 0) {
      this.bellT = CFG.committee.bellEvery; this.bell = { t: CFG.committee.bellWarn };
      Audio.bellIn(); this.netEvent({ t: 'sfx', n: 'bellIn' }); this.message('鐘響收卷！全部蹲下！', '站著的人會被三個監考一起丟', CFG.committee.bellWarn);
      const st = this.world.layout.stage; this.spawnWave(new THREE.Vector3(st ? (st.minX + st.maxX) / 2 : 0, 0, st ? (st.minZ + st.maxZ) / 2 : 0), 9, CFG.committee.bellWarn, 0xd8432b);
    }
  }
  // what the crosshair ray can land on besides the room: a kid's paper body, a teacher's sheet, a teammate
  aimHit(p) {
    for (const s of this.students) { if (!s.alive) continue; const sp = s.group.position; if (Math.abs(p.x - sp.x) < 0.36 && Math.abs(p.z - sp.z) < 0.36 && p.y > sp.y && p.y < sp.y + 1.45 * s.group.scale.y) return true; }
    for (const t of this.teachers) { if (t.defeated) continue; const tp = t.group.position, sc = t.group.scale.y; if (Math.abs(p.x - tp.x) < 0.6 * sc && Math.abs(p.z - tp.z) < 0.6 * sc && p.y > tp.y && p.y < tp.y + 2.3 * sc) return true; }
    return false;
  }
  // ---------- upgrades ----------
  // co-op: each kid brings one thing from home — 小明 a big magazine, 小美 magnet gloves
  giveStarter(who) {
    const id = COOP.starters[who] || COOP.starters.host, u = takeUpgrade(this.player.up, id); if (!u) return;
    this.player.up.refill = 0; this.player.up.healFull = false; this.player.applyUpgrade(u);
    this.ui.upgrades(Object.entries(this.player.up.taken).map(([k, n]) => upgradeById(k).name + (n > 1 ? '×' + n : '')));
    this.message(`你帶了${u.name}`, '每個人從家裡帶的東西都不一樣', 2.5);
  }
  openOffer() {
    if (!this.isHost) return;
    const mine = offerFor(this.player.up);
    const picked = { host: false };
    for (const r of this.remoteList()) { picked[r.slot] = false; this.sendTo(r.slot, { t: 'offer', ids: offerFor(r.up) }); }
    if (this.coop) { // no pause with partners: a compact panel and 10 seconds to decide, play goes on
      this.offer = { picked, t: COOP.offerSeconds, live: true };
      this.ui.offer(mine.map(upgradeById), (id) => this.pickUpgrade(id), COOP.offerSeconds);
      return;
    }
    this.offer = { picked: { host: false, guest: true }, t: 14 };
    this.state = 'upgrade'; this.player.keys = {}; this.player.firing = false;
    if (document.pointerLockElement) { this.ignoreUnlock = true; document.exitPointerLock(); }
    this.ui.offer(mine.map(upgradeById), (id) => this.pickUpgrade(id));
  }
  showOfferFromHost(ids) { this.guestOfferT = COOP.offerSeconds; this.ui.offer(ids.map(upgradeById), (id) => this.pickUpgrade(id), COOP.offerSeconds); }
  pickUpgrade(id) {
    if (!this.ui.offerOpen) return;
    const u = takeUpgrade(this.player.up, id); if (!u) return;
    this.player.applyUpgrade(u); this.ui.closeOffer(); Audio.item();
    this.ui.upgrades(Object.entries(this.player.up.taken).map(([k, n]) => upgradeById(k).name + (n > 1 ? '×' + n : '')));
    this.message(`拿到${u.name}！`, u.desc, 2);
    if (this.isHost) { if (this.offer) { this.offer.picked.host = true; this.maybeCloseOffer(); } }
    else if (this.transport) this.transport.send(JSON.stringify({ t: 'pick', id }));
  }
  // co-op panels count down on their own; when time is up the first card is taken
  tickLiveOffer(dt) {
    if (this.offer && this.offer.live) { this.offer.t -= dt; this.ui.offerTime(this.offer.t); if (this.offer.t <= 0) { if (!this.offer.picked.host && this.ui.offerOpen) this.pickUpgrade($('upgrade-cards').children[0].dataset.id); else this.closeOffer(); } }
    if (!this.isHost && this.ui.offerOpen) { this.guestOfferT -= dt; this.ui.offerTime(this.guestOfferT); if (this.guestOfferT <= 0) this.pickUpgrade($('upgrade-cards').children[0].dataset.id); }
  }
  maybeCloseOffer() {
    const o = this.offer; if (!o) return;
    if (Object.values(o.picked).every(Boolean)) this.closeOffer();
  }
  closeOffer() {
    const live = this.offer && this.offer.live;
    this.offer = null; this.ui.closeOffer();
    if (live) return; // nothing was paused
    this.state = 'playing';
    if (this.lockSupported && !this.lockFailed && !this.touch) this.requestLock();
    this.clock.getDelta();
  }
  // ---------- pencil-case ammo supply (boss fight only: no students means no darts flying in) ----------
  spawnSupply(nearPlayer = false) {
    if (!this.tables().length || this.lunch) return; // no tables (the corridor): no boxes
    // a box lands near whoever is running dry (in co-op that is often the partner, not the host)
    const who = nearPlayer ? this.players().slice().sort((x, y) => (x.ammo + x.reserve) - (y.ammo + y.reserve))[0] : this.player;
    const pp = who.pos;
    const ok = this.tables().filter(d => { const dd = Math.hypot(d.x - pp.x, d.z - pp.z); return Math.abs((d.floor || 0) - (pp.y || 0)) < 0.5 && (nearPlayer ? dd > 1.2 && dd < CFG.supply.near : dd > 2) && !this.milks.some(m => m.desk === d); });
    const desk = pick(ok.length ? ok : this.tables());
    const mk = this.makeMilk(desk.x + rand(-0.12, 0.12), (desk.floor || 0) + (desk.h || DESK.h) + 0.1, desk.z + rand(-0.05, 0.05), 'ammo');
    mk.desk = desk; mk.id = this.nextId(); mk.kind = 'ammo'; this.milks.push(mk);
    Audio.itemSpawn(); this.message('有人放了一盒泡棉彈在課桌上', `走過去撿 +${this.supplyAmount()} 發`, 2);
  }
  supplyAmount() { return this.coop ? COOP.supplyAmount : CFG.supply.amount; }
  // ---------- touch aim assist ----------
  // Near a kid or a weak point the view turns slower (friction) and drifts a little toward it (pull); the drift fades
  // with distance from the crosshair so it never fights a deliberate turn. Only for a touch device, only while playing.
  aimAssist(dt) {
    this.aimFriction = 1; if (!this.touch || this.state !== 'playing' || this.player.sitting) return;
    const p = this.player, eye = p.eyePos(), view = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let best = null, bestAng = CFG.assist.cone;
    const consider = (pt) => { const d = pt.clone().sub(eye); const dist = d.length(); if (dist < 0.8 || dist > 18) return; d.divideScalar(dist); const ang = Math.acos(Math.max(-1, Math.min(1, d.dot(view)))); if (ang < bestAng && !this.world.segmentBlocked(eye, pt)) { bestAng = ang; best = pt; } };
    for (const s of this.students) if (s.alive && s.state !== 'flyOut' && s.state !== 'sitting') consider(new THREE.Vector3(s.group.position.x, s.group.position.y + 0.95 * s.group.scale.y, s.group.position.z));
    for (const t of this.teachers) if (!t.defeated) { t.group.updateMatrixWorld(true); for (const k in t.wp) if (t.wp[k].hp > 0) consider(t.wpWorld(k)); }
    if (!best) return;
    this.aimFriction = CFG.assist.friction;
    const d = best.clone().sub(eye), wantYaw = Math.atan2(-d.x, -d.z), wantPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    let dy = wantYaw - p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const dp = wantPitch - p.pitch, strength = (1 - bestAng / CFG.assist.cone) * Math.min(1, CFG.assist.pull * dt);
    p.yaw += dy * strength; p.pitch += dp * strength;
  }
  // ---------- chalk dust (the eraser) ----------
  dustBurst(at) {
    this.addZone(at, CFG.teacher.dustRadius, CFG.teacher.dustLife, 'dust');
    Audio.puff(); this.netEvent({ t: 'sfx', n: 'puff' });
    for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2; this.spawnDebris(at, 0xf7f4ea, [0.08, 0.08, 0.08], new THREE.Vector3(Math.cos(a) * rand(0.5, 2), rand(1.5, 3), Math.sin(a) * rand(0.5, 2)), 1.5); }
  }
  dustOn(pl, secs) {
    if (pl === this.player) { this.dustT = Math.max(this.dustT || 0, secs); this.dustHit = true; return; }
    const now = performance.now(); if (!pl.dustSent || now - pl.dustSent > 600) { pl.dustSent = now; this.netEvent({ t: 'dust', d: secs }, pl.slot); }
  }
  // ---------- hazard zones (the science teacher's spills) ----------
  addZone(at, r, life, kind = 'acid') {
    this.netEvent({ t: 'zone', p: [+at.x.toFixed(2), +at.z.toFixed(2)], r, l: life, k: kind });
    const color = kind === 'stink' ? 0x9aa88a : kind === 'water' ? 0x6fb7ef : kind === 'fail' ? 0xe0463a : kind === 'dust' ? 0xf4f1e6 : 0x5fcf7a;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: kind === 'water' ? 0.6 : 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, this.world.heightAt(at.x, at.z) + 0.025, at.z); this.scene.add(m);
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 28 }, (_, i) => new THREE.Vector3(Math.cos(i / 28 * 6.283) * r, Math.sin(i / 28 * 6.283) * r, 0.001))), this.world.inkMat); m.add(edge);
    const z = { mesh: m, x: at.x, z: at.z, r, t: life, life, kind, puffs: [] };
    if (kind === 'dust') for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.35 + Math.random() * 0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf7f4ea, transparent: true, opacity: 0.6, depthWrite: false })); p.position.set(at.x + (Math.random() - 0.5) * r * 1.4, this.world.heightAt(at.x, at.z) + 0.3 + Math.random() * 1.2, at.z + (Math.random() - 0.5) * r * 1.4); p.userData.v = 0.15 + Math.random() * 0.2; this.scene.add(p); z.puffs.push(p); }
    if (kind === 'stink') for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.3 + Math.random() * 0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb5c2a6, transparent: true, opacity: 0.45, depthWrite: false })); p.position.set(at.x + (Math.random() - 0.5) * r, 0.4 + Math.random() * 0.8, at.z + (Math.random() - 0.5) * r); p.userData.v = 0.25 + Math.random() * 0.3; this.scene.add(p); z.puffs.push(p); }
    this.zones.push(z); return z;
  }
  inZone(pos, kind) { for (const z of this.zones) if (z.kind === kind && Math.hypot(pos.x - z.x, pos.z - z.z) < z.r) return true; return false; }
  updateZones(dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]; z.t -= dt; z.mesh.material.opacity = 0.5 * Math.min(1, z.t / 0.8); z.mesh.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.03);
      for (const p of z.puffs) { p.position.y += p.userData.v * dt; p.material.opacity = 0.45 * Math.min(1, z.t / 0.8); if (p.position.y > 2.2) p.position.y = 0.3; }
      if (z.t <= 0) { this.scene.remove(z.mesh); z.puffs.forEach(p => this.scene.remove(p)); this.zones.splice(i, 1); continue; }
      if (!this.isHost || this.state !== 'playing') continue;
      if (z.kind === 'acid' || z.kind === 'fail') { for (const pl of this.activeTargets()) if (Math.hypot(pl.pos.x - z.x, pl.pos.z - z.z) < z.r && Math.abs(pl.pos.y - this.world.heightAt(z.x, z.z)) < 0.6) { if (pl.hurtCd <= 0) { pl.hurt(); this.message(z.kind === 'fail' ? '站在不及格章上！' : '踩到藥水了！', z.kind === 'fail' ? '快離開紅色的圈' : '快離開綠色的地方', 1); } } }
      else if (z.kind === 'dust') { // chalk dust: whoever stands in it cannot see for a while, kids included
        const zy = this.world.heightAt(z.x, z.z);
        for (const pl of this.activeTargets()) if (Math.hypot(pl.pos.x - z.x, pl.pos.z - z.z) < z.r && Math.abs(pl.pos.y - zy) < 1.6) this.dustOn(pl, CFG.teacher.dustBlind);
        for (const s of this.students) if (s.alive && !s.remote && Math.hypot(s.group.position.x - z.x, s.group.position.z - z.z) < z.r && s.state !== 'hide' && s.state !== 'hurt') { s.state = 'hide'; s.timer = 0.6; s.alert.visible = false; }
      }
      else if (z.kind === 'stink') { for (const s of this.students) if (s.alive && !s.remote && Math.hypot(s.group.position.x - z.x, s.group.position.z - z.z) < z.r && s.state !== 'hide' && s.state !== 'hurt') { s.state = 'hide'; s.timer = 0.6; s.alert.visible = false; } }
      else if (z.kind === 'water') { for (const s of this.students) if (s.alive && Math.hypot(s.group.position.x - z.x, s.group.position.z - z.z) < z.r) { this.lastShooter = z.who || 'host'; s.hp = 1; if (s.hit()) { this.kills++; this.stat(z.who || 'host', 'kills'); this.message('同學踩進水坑，滑倒出局！', '', 1.2); } this.lastShooter = null; } }
    }
  }
  // ---------- small physics props ----------
  spawnDebris(at, color, size, vel, life) {
    this.netEvent({ t: 'debris', p: [+at.x.toFixed(2), +at.y.toFixed(2), +at.z.toFixed(2)], c: color, s: size, v: [+vel.x.toFixed(2), +vel.y.toFixed(2), +vel.z.toFixed(2)], l: life });
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshToonMaterial({ color, gradientMap: this.world.gradient }));
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), this.world.inkMat)); m.castShadow = true; m.position.copy(at); m.position.y += 0.2;
    this.scene.add(m); this.debris.push({ mesh: m, vel: vel.clone(), spin: rand(4, 10), life });
  }
  spawnRing(at, radius, color) {
    this.netEvent({ t: 'ring', p: [+at.x.toFixed(2), +at.y.toFixed(2), +at.z.toFixed(2)], r: radius, c: color });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.3, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, this.world.heightAt(at.x, at.z) + 0.03, at.z); this.scene.add(m); this.rings.push({ mesh: m, t: 0, radius });
  }
  updateProps(dt) {
    this.updateDebris(dt);
    if (this.bully) this.bully.update(dt);
    if (this.monitor) this.monitor.update(dt);
    if (this.ball) this.ball.update(dt);
  }
  updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.vel.y -= 9.8 * dt; d.mesh.position.addScaledVector(d.vel, dt); d.mesh.rotation.x += d.spin * dt; d.mesh.rotation.z += d.spin * 0.6 * dt; d.life -= dt;
      if (d.mesh.position.y < 0.03) { d.mesh.position.y = 0.03; d.vel.y = Math.abs(d.vel.y) * 0.3; d.vel.x *= 0.6; d.vel.z *= 0.6; d.spin *= 0.5; }
      if (d.life <= 0) { this.scene.remove(d.mesh); this.debris.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = Math.min(1, r.t / (r.slow || 0.45)); r.mesh.scale.setScalar(r.slow ? 0.2 + k * r.radius : 1 + k * r.radius * 3.2); r.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.scene.remove(r.mesh); this.rings.splice(i, 1); }
    }
  }
  // ---------- milk (healing) ----------
  // tables a carton or a box can land on: anything higher than 1.2 m (a tree, the swing frame, the slide tower) is out of reach from the floor
  tables() { return this.world.desks.filter(d => (d.h || DESK.h) <= 1.2); }
  spawnMilk() {
    if (this.milks.length >= CFG.milk.max || !this.tables().length) return;
    const pp = this.player.pos;
    const far = this.tables().filter(d => Math.abs((d.floor || 0) - (pp.y || 0)) < 0.5 && Math.hypot(d.x - pp.x, d.z - pp.z) > CFG.milk.minDistFromPlayer && Math.hypot(d.x - pp.x, d.z - pp.z) < 9 && !this.milks.some(m => m.desk === d));
    const desk = pick(far.length ? far : this.tables());
    const mk = this.makeMilk(desk.x + rand(-0.12, 0.12), (desk.floor || 0) + (desk.h || DESK.h) + 0.1, desk.z + rand(-0.05, 0.05));
    mk.desk = desk; mk.id = this.nextId(); this.milks.push(mk);
    Audio.milkSpawn();
    this.message('有人把鮮奶放在課桌上', '走過去喝一口回血', 2.2);
  }
  makeMilk(x, y, z, kind = 'milk') {
    const g = new THREE.Group();
    if (kind === 'ammo') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.14), new THREE.MeshToonMaterial({ color: 0xf28a1a, gradientMap: this.world.gradient }));
      box.castShadow = true; box.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), this.world.inkMat)); g.add(box);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.14), new THREE.MeshToonMaterial({ color: 0x2f6fd1, gradientMap: this.world.gradient })); lid.position.y = 0.055; lid.add(new THREE.LineSegments(new THREE.EdgesGeometry(lid.geometry), this.world.inkMat)); g.add(lid);
      for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(this.darts.geo, this.darts.matOrange); d.position.set(-0.07 + i * 0.07, 0.085, 0); d.rotation.y = Math.PI / 2; d.scale.setScalar(0.7); g.add(d); }
      g.position.set(x, y - 0.05, z); this.scene.add(g);
      return { mesh: g, desk: null, baseY: y - 0.05, t: Math.random() * 6, kind: 'ammo' };
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.13), new THREE.MeshToonMaterial({ map: this.milkTex, gradientMap: this.world.gradient }));
    box.castShadow = true; box.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), this.world.inkMat)); g.add(box);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), new THREE.MeshToonMaterial({ color: 0xd8432b, gradientMap: this.world.gradient }));
    straw.position.set(0.03, 0.14, 0.02); straw.rotation.z = -0.3; g.add(straw);
    g.position.set(x, y, z);
    this.scene.add(g);
    return { mesh: g, desk: null, baseY: y, t: Math.random() * 6 };
  }
  updateMilk(dt) {
    if (this.state === 'playing') {
      this.milkTimer -= dt;
      if (this.milkTimer <= 0) { this.milkTimer = CFG.milk.interval; if (this.player.hp < this.player.maxHp) this.spawnMilk(); }
      if (this.bossPhase && this.teachers.some(t => !t.defeated)) { this.supplyTimer -= dt; if (this.supplyTimer <= 0) { this.supplyTimer = CFG.supply.interval; if (!this.milks.some(m => m.kind === 'ammo')) this.spawnSupply(); } }
      else { // during the waves a pencil case shows up nearby whenever someone is running low
        this.lowTimer = (this.lowTimer || 0) - dt;
        const low = this.players().some(pl => pl.ammo + pl.reserve < CFG.supply.lowAt);
        if (low && this.lowTimer <= 0 && this.milks.filter(m => m.kind === 'ammo').length < this.players().length) { this.lowTimer = this.coop ? COOP.lowInterval : CFG.supply.lowInterval; this.spawnSupply(true); }
      }
    }
    const pp = this.player.pos;
    this.hintT = (this.hintT || 0) - dt;
    for (let i = this.milks.length - 1; i >= 0; i--) {
      const m = this.milks[i]; m.t += dt;
      m.mesh.position.y = m.baseY + Math.sin(m.t * 3) * 0.02; m.mesh.rotation.y = m.t * 1.2;
      if (this.state !== 'playing' || !this.isHost) continue;
      if (!this.canReach(pp, m)) continue;
      if (m.kind === 'ammo') {
        if (this.player.reserve >= this.player.reserveCap()) { if (this.hintT <= 0) { this.hintT = 6; this.message('備用彈已經滿了', '先打一些再來撿', 1.4); } continue; }
        this.scene.remove(m.mesh); this.milks.splice(i, 1);
        this.player.reserve = Math.min(this.player.reserveCap(), this.player.reserve + this.supplyAmount()); this.ui.ammo(this.player.ammo, this.player.ammo === 0, this.player.reserve); this.ui.pickFlash();
        Audio.pickup(); this.message('撿到一盒泡棉彈！', `+${this.supplyAmount()} 發`, 1.4);
      } else if (this.player.hp < this.player.maxHp) {
        this.scene.remove(m.mesh); this.milks.splice(i, 1);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + CFG.milk.heal); this.ui.hp(this.player.hp, this.player.maxHp);
        Audio.drink(); Ach.add('milk', 1); this.message('咕嚕咕嚕，喝了鮮奶！', '+1 ♥', 1.6);
      } else if (this.hintT <= 0) { this.hintT = 6; this.message('血是滿的', this.coop ? '鮮奶留給隊友' : '受傷再回來喝', 1.4); }
    }
  }
  // a carton or pencil case is within reach when the player is close to it, or close to the edge of the table it sits on
  canReach(pos, m) {
    const p = m.mesh.position; if (Math.abs(p.y - (pos.y || 0)) >= 1.6) return false;
    if (Math.hypot(p.x - pos.x, p.z - pos.z) < CFG.milk.pickupRadius) return true;
    const d = m.desk; if (!d) return false;
    const rx = Math.max(d.x - d.w / 2 - pos.x, 0, pos.x - (d.x + d.w / 2)), rz = Math.max(d.z - d.d / 2 - pos.z, 0, pos.z - (d.z + d.d / 2));
    return Math.hypot(rx, rz) < CFG.milk.reach;
  }
  addScore(n, who = this.lastShooter || 'host') { const b = this.buffs[who]; if (b && b.id === 'double') n *= 2; this.score += n; this.ui.score(this.score); }
  // buffs belong to the kid who shot the item (keyed by slot); slow motion is the exception, the whole room slows for everyone
  get myBuff() { return this.buffs[this.mySlot] || null; }
  set myBuff(v) { if (v) this.buffs[this.mySlot] = v; else delete this.buffs[this.mySlot]; }
  hasBuff(id, who = this.mySlot) { const b = this.buffs[who]; return !!(b && b.id === id); }
  worldSlow() { return Object.values(this.buffs).some(b => b.id === 'slow') || this.slowT > 0 || !!this.remoteSlow; }
  applyBuff(b, who = this.mySlot) {
    const buff = { id: b.id, name: b.name, effect: b.effect, t: b.dur };
    this.buffs[who] = buff;
    if (who !== this.mySlot) { const r = this.remotes.get(who); this.netEvent({ t: 'buff', b: buff }, who); this.message(`${r ? r.skin.name : '隊友'}射中${b.name}！`, `${b.effect} ${b.dur} 秒`, 2); return; }
    this.ui.buff(buff); Audio.item();
    this.message(`射中${b.name}！`, `${b.effect} ${b.dur} 秒`, 2);
  }
  spawnItem() {
    const used = new Set(this.items.map(i => i.mount));
    const mount = pick(this.world.layout.mounts.filter(m => !used.has(m)));
    const item = new SpecialItem(this, pick(BUFFS), mount); item.mount = mount; this.items.push(item);
    Audio.itemSpawn(); this.message('牆上出現了特殊物品', '射中它拿獎勵', 1.6);
  }
  updateItems(dt, realDt) {
    if (this.state === 'playing' && !this.lunch) { this.itemTimer -= dt; if (this.itemTimer <= 0 && this.items.length < 1) { this.itemTimer = rand(CFG.items.interval[0], CFG.items.interval[1]); this.spawnItem(); } }
    for (let i = this.items.length - 1; i >= 0; i--) if (!this.items[i].update(dt)) { this.items[i].dispose(); this.items.splice(i, 1); }
    for (const k of Object.keys(this.buffs)) { const b = this.buffs[k]; b.t -= realDt; if (b.t <= 0) { delete this.buffs[k]; if (k === this.mySlot) this.ui.buff(null); } else if (k === this.mySlot) this.ui.buff(b); }
    if (this.slowT > 0) this.slowT -= realDt;
  }
  message(a, b, d) { this.ui.message(a, b, d); this.netEvent({ t: 'msg', a, b, d }); }
  hitmark() { const who = this.lastShooter || 'host'; this.stat(who, 'hits'); if (who !== 'host') { const r = this.remotes.get(who); if (r) r.hits++; this.netEvent({ t: 'hitmark' }, who); } else { this.ui.hitmark(); this.player.hits++; } }
  onLose() { this.afterRound(false); this.onLoseInner(); }
  onLoseInner() {
    this.state = 'over'; Audio.lose();
    if (this.lunch) {
      const LM = this.lunchMode, timeUp = LM.timeLeft <= 0, dry = LM.cart.loaded && LM.cart.soup <= 0;
      const title = timeUp ? '午休鐘響了，午餐沒回來' : dry ? '湯全灑光了' : '兩個人都被打倒了', sub = timeUp ? '全班餓著肚子等。' : dry ? '回到班上只剩空桶，全班餓肚子。' : '餐車被搶菜的推走了。';
      this.overInfo = { win: 0, title, sub, stats: this.coopStats() }; this.netEvent({ t: 'over', ...this.overInfo });
      if (document.pointerLockElement) document.exitPointerLock();
      this.showOver(title, sub, false); return;
    }
    if (this.toilet) { // 搶廁所：時間到，或被趕出去
      const timeUp = this.timeLeft <= 0, title = timeUp ? '時間到，憋不住了……' : '被清潔隊趕出廁所了！', sub = timeUp ? `清潔隊還在拖地，罐子還剩 ${this.cansLeft()} 個。` : `三滴血用完，先去保健室。罐子還剩 ${this.cansLeft()} 個。`;
      this.overInfo = { win: 0, title, sub, stats: this.coopStats() }; this.netEvent({ t: 'over', ...this.overInfo });
      if (document.pointerLockElement) document.exitPointerLock();
      this.showOver(title, sub, false); return;
    }
    this.overInfo = { win: 0, title: this.coop ? '全部的人都被罰坐了' : '你被罰坐了！', sub: '沒有人能來救，全班歡呼。', stats: this.coopStats() }; this.netEvent({ t: 'over', ...this.overInfo });
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.coop) this.showOver('全部的人都被罰坐了', '沒有人能來救，全班歡呼。', false);
    else this.showOver('你被罰坐了！', pick(['泡棉彈打到五次，乖乖回座位。', '同學們歡呼，你默默舉起白旗。', '下次記得蹲在課桌後面。']), false);
  }
  onWin() { this.afterRound(true); this.onWinInner(); }
  onWinInner() {
    this.addScore(CFG.score.win); this.state = 'won'; Audio.bellOut(); setTimeout(() => Audio.win(), 1800);
    if (this.lunch) {
      const LM = this.lunchMode, soup = Math.round(LM.cart.soup), left = Math.ceil(LM.timeLeft), stars = LM.stars();
      this.addScore(soup * 50 + left * 10);
      const title = stars === 3 ? '全班吃飽了！★★★' : stars === 2 ? '半飽，★★' : '只剩白飯，★', sub = `湯剩 ${soup}%，剩 ${left} 秒，打倒 ${LM.kills} 個搶菜的。`;
      this.message('午餐送到了！！！', stars === 3 ? '全班歡呼' : stars === 2 ? '還夠吃' : '大家默默吃白飯', 4);
      this.overInfo = { win: 1, title, sub, stats: this.coopStats() }; this.netEvent({ t: 'over', ...this.overInfo });
      setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); this.showOver(title, sub, true); }, 3200);
      return;
    }
    if (this.toilet) {
      const left = Math.ceil(this.timeLeft); this.addScore(left * TOILET.timeBonus);
      const title = '搶到廁所了！', sub = `${this.world.cans.length} 個罐子全破，剩 ${left} 秒。清潔隊讓路，廁所是你的了。`;
      this.message('罐子全破了！！！', '清潔隊傻眼，廁所是你的了', 4);
      this.overInfo = { win: 1, title, sub, stats: this.coopStats() }; this.netEvent({ t: 'over', ...this.overInfo });
      setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); this.showOver(title, sub, true); }, 3200);
      return;
    }
    if (this.siege) {
      const title = '守住校門！惡霸軍團撤退了', sub = '十波都擋下來了，隔壁學校再也不敢來。';
      this.message('守住了！！！', '惡霸軍團夾著尾巴逃回隔壁學校', 4);
      this.overInfo = { win: 1, title, sub, stats: this.coopStats() }; this.netEvent({ t: 'over', ...this.overInfo });
      setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); this.showOver(title, sub, true); }, 3200);
      return;
    }
    const tn = this.bossName || '老師', trio = this.teachers.length > 1;
    const sub = trio ? '三位監考官同時崩潰，會考取消。你是全校的傳說。' : '三個道具全掉，全班自由。你是六年二班的傳說。';
    this.message('下課！！！', `${tn}崩潰，宣布今天不用上課`, 4);
    this.overInfo = { win: 1, title: `下課！${tn}${trio ? '全員' : ''}投降了`, sub, stats: this.coopStats() }; this.netEvent({ t: 'over', ...this.overInfo });
    setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); this.showOver(`下課！${tn}${trio ? '全員' : ''}投降了`, sub, true); }, 3200);
  }
  showOver(title, sub, win, remoteStats = null) {
    $('over').hidden = false; $('hud').hidden = true;
    $('over-title').textContent = title; $('over-title').classList.toggle('red-pen', !win); $('over-sub').textContent = sub;
    Badges.showDraw(this.drawnBadge, this.drawnDropped, this.badgeSlots(), () => this.badgeHud());
    const nb = $('btn-next'); if (nb) { nb.hidden = !(this.story && win); if (this.story && win) { const nx = Progress.next(this.story); nb.textContent = this.story.finale || this.story.hidden || !nx ? '翻開畢業紀念冊' : '下一章'; } }
    const ag = $('btn-again'); if (ag) ag.textContent = this.story ? (win ? '再玩這章' : '再試一次') : '再來一局';
    if (this.story && win) $('over-sub').textContent = `${this.story.end}　${starText(this.storyStars)}`;
    $('st-score').textContent = this.score; $('st-wave').textContent = this.lunch && this.lunchMode ? '★'.repeat(this.lunchMode.stars()) || '—' : this.bossPhase ? '老師' : this.waveLabel(this.wave);
    const st = remoteStats || this.coopStats();
    if (st) {
      const acc = (h, s) => s ? Math.min(100, Math.round(h / s * 100)) + '%' : '0%';
      $('st-kills').textContent = st.map(p => `${p.name} ${p.kills}`).join('・');
      $('st-acc').textContent = st.map(p => acc(p.hits, p.shots)).join('・');
      $('st-kills').style.fontSize = $('st-acc').style.fontSize = st.length > 2 ? '18px' : '';
      $('over-sub').textContent = sub + ` 互相救了 ${st.reduce((a, p) => a + p.revives, 0)} 次，被班長記了 ${st.reduce((a, p) => a + p.strokes, 0)} 筆。`;
    } else {
      $('st-kills').textContent = this.kills;
      $('st-acc').textContent = this.player.shots ? Math.min(100, Math.round(this.player.hits / this.player.shots * 100)) + '%' : '0%';
    }
  }
  coopStats() {
    if (!this.coop || !this.stats) return null;
    const h = this.stats.host, out = [{ slot: 'host', name: this.mySkin().name, kills: h.kills, hits: this.player.hits, shots: this.player.shots, revives: h.revives, strokes: h.strokes }];
    for (const r of this.remotes.values()) { const g = this.stats[r.slot] || { kills: 0, revives: 0, strokes: 0 }; out.push({ slot: r.slot, name: r.skin.name, kills: g.kills, hits: r.hits, shots: r.shots, revives: g.revives, strokes: g.strokes }); }
    return out;
  }
  // ---------- loop ----------
  frame() {
    const dt = Math.min(0.1, this.clock.getDelta());
    // the simulation runs in fixed 1/60 s steps however fast the screen refreshes, so a slow host does not slow the room
    if (this.state === 'playing' || this.state === 'won') { this.acc += dt; let n = 0; while (this.acc >= 1 / 60 && n < 6) { this.step(1 / 60); this.acc -= 1 / 60; n++; } if (n === 6) this.acc = 0; }
    else this.acc = 0;
    if (this.dustT > 0 || this.dustShown) { this.dustT = Math.max(0, (this.dustT || 0) - dt); this.ui.dust(this.dustT, this.renderer.domElement); this.dustShown = this.dustT > 0; }
    if (this.net.tick(dt) && this.transport) this.ui.net(this.showNet ? (this.isHost ? this.net.hostText(Object.fromEntries([...this.remotes.values()].map(r => [r.slot, r.skin.name]))) : this.net.guestText()) : '');
    if (this.state === 'upgrade' && this.offer) { this.offer.t -= dt; if (this.offer.t <= 0) { if (!this.offer.picked.host) this.pickUpgrade($('upgrade-cards').children[0].dataset.id); else this.closeOffer(); } }
    this.tickLiveOffer(dt);
    this.ui.tick(dt); this.touchCtl.update();
    this.renderer.render(this.scene, this.camera);
  }
  step(realDt) {
    if (!this.isHost) return this.guestStep(realDt);
    this.player.update(realDt); this.aimAssist(realDt);
    for (const r of this.remotes.values()) { r.update(realDt); if (r.badge && r.badge.regenHp && this.state === 'playing' && !r.sitting && r.group.visible) { r.regenT = (r.regenT || 0) + realDt; if (r.regenT >= r.badge.regenHp) { r.regenT = 0; if (r.hp < r.maxHp) r.hp++; } } }
    const dt = realDt * (this.worldSlow() ? CFG.items.slowScale : 1); // the world slows down, the players do not
    this.updateItems(dt, realDt);
    // spawning & waves
    if (this.state === 'playing') {
      if (this.lunch && this.lunchMode) { this.lunchMode.step(dt); if (this.lunchMode.cart.loaded) this.ui.soup(this.lunchMode.cart.soup); if (this.state !== 'playing') return; }
      if (this.toilet) { // 搶廁所：倒數；清潔隊少於四個就從側門再進一個
        this.timeLeft -= dt; this.ui.timer(this.timeLeft);
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.onLose(); return; }
        if (this.students.filter(s => s.alive).length + this.spawnQueue.length < TOILET.minCrew + MP.crew * this.extraPlayers()) { this.refillT -= dt; if (this.refillT <= 0) { this.refillT = TOILET.refill; const doors = this.world.layout.doors; this.spawnQueue.push({ door: doors[Math.random() < 0.5 ? 0 : 1] }); this.spawnTimer = Math.min(this.spawnTimer, 0.2); this.message('又來一個清潔隊員', '', 1.2); } }
      }
      if (this.bossDue > 0) { this.bossDue -= dt; if (this.bossDue <= 0 && this.bossDef) { this.spawnTeacher(this.bossDef); this.bossDef = null; } }
      for (let i = this.teachers.length - 1; i >= 0; i--) { const t = this.teachers[i]; if (t.goneT === undefined) continue; t.goneT -= dt; if (t.goneT <= 0) { t.dispose(); this.teachers.splice(i, 1); this.updateBossHud(); if (!this.teachers.length) this.ui.boss(false); } }
      if (this.spawnQueue.length) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { const e = this.spawnQueue.shift(), door = e.door || e, at = e.at || { x: door.x - 0.3, z: door.z }; this.students.push(new Student(this, at, { leader: !!e.leader, entry: e.entry || null })); if (e.leader) { if (this.siege) this.message('惡霸老大帶頭衝進來了！', '先打倒他，其他人會慌', 2); else this.message('班長帶隊進來了！', '先打倒她，其他人會慌', 2); Audio.tattle(); this.netEvent({ t: 'sfx', n: 'tattle' }); } this.spawnTimer = this.diff.spawnGap / (1 + MP.gap * this.extraPlayers()); this.ui.left(this.students.filter(s => s.alive).length + this.spawnQueue.length); }
      } else if (!this.bossPhase && !this.toilet && !this.lunch) {
        const alive = this.students.filter(s => s.alive).length, bossUp = this.bossDue > 0 || this.teachers.some(t => !t.defeated);
        if (alive === 0 && !bossUp) {
          if (this.nextWavePending) {
            this.waveTimer -= dt;
            if (this.waveTimer <= 0) { this.nextWavePending = false; if (this.wave >= this.diff.waves.length) { if (this.siege) this.onWin(); else this.startBoss(); } else this.startWave(); }
          } else if (this.siege && this.wave >= this.diff.waves.length) { this.onWin(); }
          else if (this.wave > 0) {
            this.addScore(CFG.score.wave); this.nextWavePending = true; this.waveTimer = 2.5;
            const heal = this.diff.healPerWave;
            this.message('這波清光了！', heal ? `+500，回 ${heal} ♥` : '+500', 1.8); this.storyHint('clear');
            if (heal) for (const pl of this.players()) { if (!pl.sitting) { pl.hp = Math.min(pl.maxHp, pl.hp + heal); if (pl === this.player) this.ui.hp(pl.hp, pl.maxHp); } }
            if (this.player.hp < this.player.maxHp) this.spawnMilk();
            this.offerTimer = 1.6; this.waveTimer = 6.5; // time to breathe: scavenge darts, drink milk, pick an upgrade
          }
        }
      } else if (this.bossPhase && !this.teachers.length) { // the teacher walks in a few seconds after the bell
        this.bossTimer -= dt; if (this.bossTimer <= 0) this.spawnTeacher();
      }
    }
    if (this.offerTimer > 0) { this.offerTimer -= dt; if (this.offerTimer <= 0) this.openOffer(); }
    this.panicT = Math.max(0, (this.panicT || 0) - dt); this.hintT = Math.max(0, (this.hintT || 0) - dt); this.spillT = Math.max(0, (this.spillT || 0) - dt); this.clockT += dt;
    this.updateMilk(dt); this.updateProps(dt); this.updateZones(dt); for (const p of this.props) p.update(dt); this.world.tick(dt);
    for (const s of this.students) s.update(dt);
    for (let i = this.students.length - 1; i >= 0; i--) if (this.students[i].gone) { this.students[i].dispose(); this.students.splice(i, 1); } // leaders who left for the office
    for (const t of this.teachers) t.update(dt);
    if (this.isHost) this.updateBell(dt);
    else { const left = this.students.filter(s => s.alive).length + this.spawnQueue.length; if (left !== this._left) { this._left = left; this.ui.left(left); } }
    // darts & hits
    const player = this.player;
    this.darts.update(dt, (d, prev) => {
      if (d.kind && d.kind.endsWith('Break')) { if (d.kind === 'tubeBreak') this.addZone(d.pos, 1.1, 4); else if (d.kind === 'eraserBreak') this.dustBurst(d.pos); return false; }
      const p = d.mesh.position;
      for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i].testDart(d)) { this.applyBuff(this.items[i].buff, d.who || 'host'); this.items[i].dispose(); this.items.splice(i, 1); return true; }
      for (const pr of this.props) if (pr.testDart(d)) return true;
      if (d.kind === 'dart' && this.ball && this.ball.testDart(d)) return true;
      if (d.kind === 'dart' && this.bully && this.bully.testHit(p)) { this.bully.poke(d.owner, d.shooter, d.who); return true; }
      if (d.owner === 'player' && this.monitor && this.monitor.testHit(p)) { this.monitor.hitByDart(); return true; }
      if (this.lunch && d.owner === 'player' && this.lunchMode.hitKid(p, d.who || 'host', d.volley)) return true;
      if (this.lunch && d.owner !== 'player' && this.lunchMode.hitPot(p)) return true;
      if (this.toilet && d.owner === 'player') { // 搶廁所：打破罐子；全部破了就贏
        for (let i = 0; i < this.world.cans.length; i++) { const c = this.world.cans[i]; if (!c.alive) continue; const dx = p.x - c.x, dz = p.z - c.z; if (dx * dx + dz * dz < TOILET.canRadius * TOILET.canRadius && Math.abs(p.y - c.y) < 0.26) { this.breakCan(i, d.who || 'host'); return true; } }
      }
      if (d.owner === 'player') {
        for (const s of this.students) {
          if (!s.alive) continue;
          const dx = p.x - s.group.position.x, dz = p.z - s.group.position.z;
          const h = 1.35 * s.group.scale.y;
          const hrr = 0.36 * this.hitMul(d.who);
          if (dx * dx + dz * dz < hrr * hrr && p.y > s.group.position.y && p.y < s.group.position.y + h) { if (d.volley && s.lastVolley === d.volley) return true; s.lastVolley = d.volley; this.lastShooter = d.who; if (s.hit()) { this.kills++; this.stat(d.who, 'kills'); this.ui.left(this.students.filter(x => x.alive).length + this.spawnQueue.length); } this.lastShooter = null; return true; }
        }
        for (const t of this.teachers) {
          if (d.volley && t.lastVolley === d.volley && t.testHit(p, prev, this.hitMul(d.who), true)) return true;
          this.lastShooter = d.who; const r = t.testHit(p, prev, this.hitMul(d.who)); this.lastShooter = null; if (r) t.lastVolley = d.volley;
          if (r === 'weak') return true;
          if (r === 'body') { if (!this.bodyHintShown) { this.bodyHintShown = true; this.message('打身體沒用！', '瞄準紅圈：眼鏡、粉筆、教案', 2.5); } Audio.thud(); return true; }
        }
      } else if (this.state === 'playing') {
        for (const pl of this.activeTargets()) {
          const dx = p.x - pl.pos.x, dz = p.z - pl.pos.z;
          const hr = 0.28 * (1 - (pl.up ? pl.up.dodge : 0));
          if (dx * dx + dz * dz < hr * hr && p.y > pl.pos.y && p.y < pl.pos.y + pl.eye + 0.2) {
            if (d.kind === 'eraser') this.dustBurst(p.clone());
            if (d.kind === 'water') { // 潑水：不扣血，慢 5 秒
              this.spawnRing(p.clone(), 0.6, 0x6fb7ef);
              if (pl === this.player) { pl.wet = TOILET.wetSeconds; this.wetCount++; this.ui.wet(true); this.message('被潑到水了！', '行動變慢 5 秒', 1.4); Audio.boing(); }
              else { pl.wet = TOILET.wetSeconds; this.netEvent({ t: 'wet', s: TOILET.wetSeconds }, pl.slot); }
              return true;
            }
            pl.hurt(); return true;
          }
        }
      }
      return false;
    });
    // the guest's scavenging and milk are judged here, where the darts and cartons live
    for (const rp of this.remoteList()) {
      if (rp.sitting || this.state !== 'playing') continue;
      const got = this.darts.pickupNear(rp.pos, CFG.gun.pickupRadius * rp.up.pickupMul, Math.max(0, CFG.gun.reserveMax + rp.up.reserveBonus - rp.reserve));
      if (got > 0) { rp.reserve += got; this.netEvent({ t: 'pickup', n: got }, rp.slot); }
      for (let i = this.milks.length - 1; i >= 0; i--) {
        const m = this.milks[i];
        if (!this.canReach(rp.pos, m)) continue;
        if (m.kind === 'ammo') { if (rp.reserve >= CFG.gun.reserveMax + rp.up.reserveBonus) continue; this.scene.remove(m.mesh); this.milks.splice(i, 1); rp.reserve += this.supplyAmount(); this.netEvent({ t: 'pickup', n: this.supplyAmount() }, rp.slot); break; }
        if (rp.hp < rp.maxHp) { this.scene.remove(m.mesh); this.milks.splice(i, 1); rp.hp = Math.min(rp.maxHp, rp.hp + CFG.milk.heal); this.stat(rp.slot, 'milk'); this.netEvent({ t: 'drink' }, rp.slot); break; }
      }
    }
    if (this.transport) {
      this.snapTimer -= realDt;
      if (this.snapTimer <= 0) { this.snapTimer = 1 / NET.snapHz; const { snap, delta } = serializeSnapshot(this); this.transport.send(JSON.stringify(snap), undefined, true); if (delta) this.transport.send(JSON.stringify(delta)); }
    }
  }
}
