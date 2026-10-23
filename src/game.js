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
import { serializeSnapshot, applySnapshot } from './net/snapshot.js';
import { NET, PLAYER_SKINS, COOP, EMOTES, DIFFICULTY } from './config.js';
import { TEACHERS, BOSSES, COMMITTEE } from './teachers.js';
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
    this.seq = 0; this.events = []; this.snapTimer = 0; this.inputTimer = 0; this.pending = []; this.remote = null; this.hostFigure = null;
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
    this.items = []; this.itemTimer = 0; this.myBuff = null; this.remoteBuff = null; this.zones = []; this.props = [];
    this.state = 'menu'; this.wave = 0; this.score = 0; this.kills = 0; this.spawnQueue = []; this.spawnTimer = 0; this.waveTimer = 0; this.difficultySpread = 1;
    this.level = 'normal'; this.diff = DIFFICULTY.normal; this.offer = null; this.offerTimer = 0; this.supplyTimer = 0;
    this.forceTeacher = new URLSearchParams(location.search).get('teacher'); // debug: ?teacher=pe
    this.clock = new THREE.Clock(); this.hasLock = false; this.lockSupported = 'requestPointerLock' in document.body;
    this.touchCtl = new TouchControls(this); this.touch = this.touchCtl.on;
    this.bindInput(); this.resize(); window.addEventListener('resize', () => this.resize());
    if (this.transport) this.attachTransport(this.role, this.transport); else this.darts.localWho = 'host';
    this.renderer.setAnimationLoop(() => this.frame());
  }
  // ---------- connection lifecycle (called by the lobby) ----------
  attachTransport(role, transport) {
    this.role = role; this.isHost = role !== 'guest'; this.transport = transport;
    this.darts.localWho = role === 'guest' ? 'guest' : 'host';
    transport.onMessage(str => this.onNet(str));
    if (this.isHost && !this.remote) this.remote = new RemotePlayer(this, PLAYER_SKINS.guest);
    if (!this.isHost && this.remote) { this.remote.dispose(); this.remote = null; }
  }
  detachTransport() {
    if (this.transport && this.transport.close) this.transport.close();
    this.transport = null; this.role = 'solo'; this.isHost = true; this.darts.localWho = 'host';
    if (this.remote) { this.remote.dispose(); this.remote = null; }
    if (this.hostFigure) { this.hostFigure.dispose(); this.hostFigure = null; }
  }
  onPeerOpen() { // the guest (re)connected: if we are already playing, pull them straight in
    this.fullSnapNext = true;
    if (this.isHost && this.transport && (this.state === 'playing' || this.state === 'paused')) {
      this.transport.send(JSON.stringify({ t: 'start', map: this.world.layout.id, coop: 1, resume: 1 }));
      if (this.remote) this.transport.send(JSON.stringify({ t: 'restore', taken: this.remote.up.taken, ammo: this.remote.ammo, res: this.remote.reserve, hp: this.remote.hp, buff: this.remoteBuff || null }));
      this.message('小美回來了！', '', 1.5);
    }
  }
  onPeerClosed() {
    if (this.isHost) { if (this.state === 'playing') this.message('小美斷線了', '30 秒內可以回來', 2.5); if (this.remote) this.remote.offline = true; }
    else { if (this.state === 'playing' || this.state === 'paused') { this.message('房主離開了教室', '回到首頁', 2.5); setTimeout(() => location.reload(), 2500); } }
  }
  onPeerGone() { if (this.isHost && this.remote) { this.remote.group.visible = false; this.message('小美回不來了', '你只好自己撐住', 2.5); } }
  nextId() { return ++this.seq; }
  // ---------- rooms ----------
  setLayout(id) {
    if (this.world.layout.id === id) return;
    this.world.dispose(); this.world = new World(this.scene, id); this.darts.world = this.world;
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
  shootersBusy() { let n = 0; for (const s of this.students) if (s.alive && s.state === 'shoot') n++; return n >= this.diff.maxShooters + (this.coop ? 1 : 0) + (this.leaderAlive() ? 1 : 0); }
  leaderAlive() { return this.students.some(s => s.alive && s.leader); }
  // the wave leader (班長) fell: the rest panic for a while
  onLeaderDown(s) {
    this.addScore(CFG.score.leader); this.panicT = CFG.leader.panicSeconds;
    for (const o of this.students) if (o.alive && o !== s && o.state !== 'flyOut') { o.state = 'hide'; o.timer = rand(1.5, 2.5); o.alert.visible = false; }
    this.message('班長出局了！', '其他人慌了，趁現在', 2);
  }
  // everyone the enemies can go after (host side); the guest counts once connected and not sitting
  players() { const l = [this.player]; if (this.isHost && this.remote && this.remote.group.visible && !this.remote.offline) l.push(this.remote); return l; }
  activeTargets() { const l = this.players().filter(p => !p.sitting); return l.length ? l : [this.player]; }
  stat(who, key, n = 1) { if (this.stats && this.stats[who]) this.stats[who][key] = (this.stats[who][key] || 0) + n; }
  // one player ran out of hearts
  onPlayerDown(p) {
    if (!this.coop) { if (p === this.player) this.onLose(); return; }
    const near = this.world.desks.filter(d => !d.occupant).sort((a, b) => Math.hypot(a.seat.x - p.pos.x, a.seat.z - p.pos.z) - Math.hypot(b.seat.x - p.pos.x, b.seat.z - p.pos.z));
    const seat = near.length ? near[0].seat : { x: p.pos.x, z: p.pos.z };
    p.sitDown(seat);
    const name = p === this.player ? '你' : this.remote.skin.name;
    this.message(`${name}被打到回座位了`, '隊友走過去按 E 可以救', 2);
    if (this.players().every(x => x.sitting)) this.onLose();
  }
  tryRevive() {
    if (this.state !== 'playing') return;
    if (this.isHost) {
      const r = this.remote;
      if (r && r.sitting && !this.player.sitting && Math.hypot(r.pos.x - this.player.pos.x, r.pos.z - this.player.pos.z) < COOP.reviveRadius) {
        r.standUp(COOP.reviveHp); this.stat('host', 'revives'); this.addScore(200); this.message(`你把${r.skin.name}拉起來了！`, '+200', 1.6); this.netEvent({ t: 'sfx', n: 'wave' });
      }
    } else if (this.transport) this.transport.send(JSON.stringify({ t: 'revive' }));
  }
  emote(n) {
    const text = EMOTES[n]; if (!text || this.state !== 'playing') return;
    if (this.emoteCd > performance.now()) return; this.emoteCd = performance.now() + 1500;
    this.ui.message(`你：${text}`, '', 1.2);
    if (this.isHost) this.netEvent({ t: 'emote', who: 'host', n });
    else if (this.transport) this.transport.send(JSON.stringify({ t: 'emote', n }));
  }
  netEvent(e) { if (this.isHost && this.transport) this.events.push(e); }
  // ---------- network ----------
  onNet(str) {
    let m; try { m = JSON.parse(str); } catch (e) { return; }
    if (this.isHost) {
      if (m.t === 'input' && this.remote) this.remote.applyInput(m);
      else if (m.t === 'fire') { if (this.remote && this.remote.sitting) return; const d = this.darts.fire(new THREE.Vector3(...m.p), new THREE.Vector3(...m.d), m.s || CFG.gun.speed, 'player'); d.who = 'guest'; if (this.monitor && this.remote) this.monitor.noticeShot(this.remote); }
      else if (m.t === 'pick') { if (this.remote) { const u = takeUpgrade(this.remote.up, m.id); if (u && this.remote.up.healFull) { this.remote.maxHp = CFG.player.hp + this.remote.up.maxHpBonus; this.remote.hp = this.remote.maxHp; this.remote.up.healFull = false; } if (this.remote.up.refill) { this.remote.reserve += this.remote.up.refill; this.remote.up.refill = 0; } } if (this.offer) { this.offer.picked.guest = true; this.maybeCloseOffer(); } }
      else if (m.t === 'revive') {
        const r = this.remote;
        if (r && this.player.sitting && !r.sitting && Math.hypot(r.pos.x - this.player.pos.x, r.pos.z - this.player.pos.z) < COOP.reviveRadius) { this.player.standUp(COOP.reviveHp); this.stat('guest', 'revives'); this.addScore(200); this.message(`${r.skin.name}把你拉起來了！`, '+200', 1.6); }
      }
      else if (m.t === 'emote') { const text = EMOTES[m.n]; if (text && this.remote) { this.remote.say(text); this.ui.message(`${this.remote.skin.name}：${text}`, '', 1.2); } }
    } else {
      if (m.t === 'start') { if (m.map) this.setLayout(m.map); this.startGuest(); if (m.coop && !m.resume) this.giveStarter('guest'); }
      else if (m.t === 'restore') { // back after a disconnect: the host remembers what we had
        const p = this.player;
        for (const [id, n] of Object.entries(m.taken || {})) for (let i = 0; i < n; i++) { const u = takeUpgrade(p.up, id); if (u) { p.up.refill = 0; p.up.healFull = false; p.applyUpgrade(u); } }
        if (m.ammo !== undefined) { p.ammo = m.ammo; p.reserve = m.res; } p.hp = m.hp; p.maxHp = CFG.player.hp + p.up.maxHpBonus; this.ui.hp(p.hp, p.maxHp); this.ui.ammo(p.ammo, p.ammo === 0, p.reserve);
        this.ui.upgrades(Object.entries(p.up.taken).map(([k, n]) => upgradeById(k).name + (n > 1 ? '×' + n : '')));
        if (m.buff) { this.myBuff = m.buff; this.ui.buff(m.buff); }
        this.message('歡迎回來，升級和彈藥都還在', '', 2);
      }
      else if (m.t === 'offer') this.showOfferFromHost(m.ids);
      else if (m.t === 'snap') { this.pending.push(m); if (this.pending.length > 30) this.pending.shift(); }
    }
  }
  startGuest() {
    Audio.init(); Audio.resume();
    this.guestReset();
    this.state = 'playing';
    $('menu').hidden = true; $('pause').hidden = true; $('over').hidden = true; $('hud').hidden = false;
    this.ui.hp(this.player.hp); this.ui.ammo(this.player.ammo, false, this.player.reserve); this.ui.score(0); this.ui.wave(1); this.ui.left(0); this.ui.boss(false); this.ui.buff(null);
    if (this.lockSupported && !this.touch) this.requestLock();
    Audio.bellOut();
    this.clock.getDelta();
  }
  guestReset() {
    this.students.forEach(s => s.dispose()); this.students = [];
    this.teachers.forEach(t => t.dispose()); this.teachers = [];
    if (this.bully) { this.bully.dispose(); this.bully = null; } if (this.monitor) { this.monitor.dispose(); this.monitor = null; } if (this.ball) { this.ball.dispose(); this.ball = null; }
    this.items.forEach(i => i.dispose()); this.items = []; this.milks.forEach(m => this.scene.remove(m.mesh)); this.milks = [];
    this.debris.forEach(d => this.scene.remove(d.mesh)); this.debris = []; this.rings.forEach(r => this.scene.remove(r.mesh)); this.rings = [];
    this.darts.clear(); this.world.setTally(0); this.zones.forEach(z => { this.scene.remove(z.mesh); (z.puffs || []).forEach(p => this.scene.remove(p)); }); this.zones = [];
    this.props.forEach(p => p.dispose()); this.props = (this.world.layout.props || []).map((d, i) => new Prop(this, d, i));
    this.camera.remove(this.player.gun); this.player = new Player(this);
    this.wave = 0; this.score = 0; this.kills = 0; this.myBuff = null; this.bossPhase = false; this.pending = []; this.ui.closeOffer(); this.ui.upgrades([]); this.ui.buff(null);
  }
  guestStep(dt) {
    this.player.update(dt);
    // apply every snapshot that arrived since the last frame, in order: the deltas inside depend on it
    if (this.pending.length) { const list = this.pending; this.pending = []; for (const m of list) applySnapshot(this, m); }
    for (const s of this.students) s.update(dt);
    for (const t of this.teachers) t.update(dt);
    if (this.bully) this.bully.update(dt); if (this.monitor) this.monitor.update(dt); if (this.ball) this.ball.update(dt);
    if (this.hostFigure) this.hostFigure.update(dt);
    for (const i of this.items) i.update(dt);
    if (this.myBuff) { this.myBuff.t -= dt; if (this.myBuff.t <= 0) { this.myBuff = null; this.ui.buff(null); } else this.ui.buff(this.myBuff); }
    for (const m of this.milks) { m.t += dt; m.mesh.position.y = m.baseY + Math.sin(m.t * 3) * 0.02; m.mesh.rotation.y = m.t * 1.2; }
    this.updateDebris(dt); this.updateZones(dt); for (const p of this.props) p.update(dt);
    this.darts.remoteUpdate(dt);
    this.inputTimer -= dt;
    if (this.transport && this.inputTimer <= 0) {
      this.inputTimer = 1 / NET.inputHz; const p = this.player;
      this.transport.send(JSON.stringify({ t: 'input', x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(2), eye: +p.eye.toFixed(2), c: p.crouching ? 1 : 0, ammo: p.ammo, res: p.reserve, sh: p.shots }));
    }
  }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
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
  enterFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen().then(() => {
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
    this.setLayout(this.pickLayout());
    this.reset();
    this.coop = !!(this.transport && this.transport.open); this.fullSnapNext = true; this.sentRestVersion = -1;
    this.stats = { host: { kills: 0, hits: 0, revives: 0, strokes: 0, milk: 0 }, guest: { kills: 0, hits: 0, revives: 0, strokes: 0, milk: 0 } };
    if (this.remote) { this.remote.hp = this.remote.maxHp; this.remote.sitting = false; this.remote.setTex('normal'); this.remote.targetSy = 1; }
    if (this.transport) this.transport.send(JSON.stringify({ t: 'start', map: this.world.layout.id, coop: this.coop ? 1 : 0 }));
    if (this.coop) { this.giveStarter('host'); if (this.remote) { const u = takeUpgrade(this.remote.up, COOP.starters.guest); if (u) { this.remote.up.refill = 0; this.remote.up.healFull = false; } } }
    this.state = 'playing';
    $('menu').hidden = true; $('pause').hidden = true; $('over').hidden = true; $('hud').hidden = false;
    this.ui.hp(this.player.hp, this.player.maxHp); this.ui.ammo(this.player.ammo, false, this.player.reserve); this.ui.score(0); this.ui.wave(1); this.ui.left(0); this.ui.boss(false);
    if (this.lockSupported && !this.touch) this.requestLock();
    Audio.bellOut();
    this.message('叮咚叮咚，下課了！', `${this.world.layout.name}變成戰場`, 3.5);
    this.waveTimer = 4.6; this.nextWavePending = true;
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
    const f = { bully: Math.random() < CFG.features.bully, ball: Math.random() < CFG.features.ball, monitor: Math.random() < CFG.features.monitor };
    const enabled = Object.keys(f).filter(k => CFG.features[k] > 0);
    if (enabled.length && !enabled.some(k => f[k])) f[pick(enabled)] = true; // at least one surprise per game, but never a switched-off one
    this.features = f;
    if (f.bully) this.bully = new Bully(this);
    if (f.monitor) this.monitor = new Monitor(this);
    if (f.ball) this.ball = new Dodgeball(this);
    this.items.forEach(i => i.dispose()); this.items = []; this.itemTimer = rand(8, 20); this.myBuff = null; this.remoteBuff = null; this.ui.buff(null);
    this.zones.forEach(z => { this.scene.remove(z.mesh); (z.puffs || []).forEach(p => this.scene.remove(p)); }); this.zones = [];
    this.props.forEach(p => p.dispose()); this.props = (this.world.layout.props || []).map((d, i) => new Prop(this, d, i));
    this.camera.remove(this.player.gun);
    this.player = new Player(this);
    this.wave = 0; this.score = 0; this.kills = 0; this.spawnQueue = []; this.difficultySpread = 1; this.bossPhase = false; this.events = []; this.panicT = 0;
    this.offer = null; this.offerTimer = 0; this.supplyTimer = 0; this.ui.closeOffer(); this.ui.upgrades([]); if (this.touchCtl) this.touchCtl.reset();
    if (this.remote) { this.remote.up = freshUpRemote(); this.remote.maxHp = CFG.player.hp; }
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
    if (this.isHost) this.reset(); else this.guestReset();
    this.state = 'menu';
    $('pause').hidden = true; $('over').hidden = true; $('hud').hidden = true; $('menu').hidden = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  startWave() {
    this.wave++; this.ui.wave(this.wave); Audio.wave();
    for (const p of this.props) if (p.kind === 'bucket' && p.state !== 'up') { p.reset(); this.netEvent({ t: 'prop', id: p.id, st: 'up' }); }
    const base = this.diff.waves[this.wave - 1], count = this.coop ? Math.round(base * COOP.waveMul) : base;
    this.difficultySpread = Math.max(this.diff.minSpread, this.diff.spread - (this.wave - 1) * 0.1);
    this.message(`第 ${this.wave} 波`, `${count} 位同學衝進來了`, 2);
    const doors = this.world.layout.doors;
    this.spawnQueue = Array.from({ length: count }, (_, i) => ({ door: doors[i % 2], leader: i === count - 1 })); this.spawnTimer = 0.4; this.waveCount = count;
  }
  startBoss() {
    this.bossPhase = true;
    Audio.bellIn(); this.netEvent({ t: 'sfx', n: 'bellIn' });
    this.message('上課鐘響了……', '走廊傳來腳步聲，拿好你的槍', 4);
    setTimeout(() => Audio.footsteps(), 3200); this.netEvent({ t: 'sfx', n: 'footstepsLater' });
    this.bossTimer = 6.0;
  }
  get teacher() { return this.teachers[0] || null; } // the first boss; the committee has three
  // the committee only comes to the hall (it needs a stage), and only for hard rounds or a pair
  pickBoss() {
    if (this.forceTeacher) return [...TEACHERS, ...BOSSES, COMMITTEE].find(x => x.id === this.forceTeacher) || pick(TEACHERS);
    if (Math.random() >= this.diff.bossChance) return pick(TEACHERS);
    const stageOk = !!this.world.layout.stage && (this.level === 'hard' || this.coop);
    return stageOk && Math.random() < 0.5 ? COMMITTEE : pick(BOSSES);
  }
  spawnTeacher(def = this.pickBoss()) {
    const door = this.world.layout.doors[0], extra = this.coop ? 1 : 0;
    if (def.members) { // the whole committee walks in together
      def.members.forEach((m, i) => this.teachers.push(new Teacher(this, { x: door.x, z: door.z + (i - 1) * 0.7 }, { def: m, wpHp: def.wpHp + extra })));
      this.bellT = CFG.committee.bellEvery;
    } else this.teachers.push(new Teacher(this, door, { def, wpHp: (def.wpHp || CFG.teacher.wpHp) + extra }));
    this.bossName = def.name;
    Audio.teacher(); if (def.sfx && Audio[def.sfx] && def.sfx !== 'teacher') setTimeout(() => Audio[def.sfx](), 500);
    this.message(def.intro[0], def.intro[1], 3.5);
    this.ui.boss(true); this.updateBossHud(); this.ui.left(def.name);
  }
  updateBossHud() { if (this.teachers.length) this.ui.bossWp(this.teachers.map(t => ({ name: t.def.short || t.def.name, entries: t.hudEntries(), max: t.wpMax, defeated: t.defeated }))); }
  // one boss fell; with the committee the others carry on, faster
  onTeacherDefeated(t) {
    const alive = this.teachers.filter(x => !x.defeated);
    this.updateBossHud();
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
  // ---------- upgrades ----------
  // co-op: each kid brings one thing from home — 小明 a big magazine, 小美 magnet gloves
  giveStarter(who) {
    const id = COOP.starters[who], u = takeUpgrade(this.player.up, id); if (!u) return;
    this.player.up.refill = 0; this.player.up.healFull = false; this.player.applyUpgrade(u);
    this.ui.upgrades(Object.entries(this.player.up.taken).map(([k, n]) => upgradeById(k).name + (n > 1 ? '×' + n : '')));
    const other = who === 'host' ? COOP.starters.guest : COOP.starters.host;
    this.message(`你帶了${u.name}`, `隊友帶的是${upgradeById(other).name}`, 2.5);
  }
  openOffer() {
    if (!this.isHost) return;
    const mine = offerFor(this.player.up);
    const guestIn = !!(this.remote && this.remote.group.visible && !this.remote.offline);
    if (guestIn) { const theirs = offerFor(this.remote.up); this.transport.send(JSON.stringify({ t: 'offer', ids: theirs })); }
    if (this.coop) { // no pause with a partner: a compact panel and 10 seconds to decide, play goes on
      this.offer = { picked: { host: false, guest: !guestIn }, t: COOP.offerSeconds, live: true };
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
    if (o.picked.host && o.picked.guest) this.closeOffer();
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
    // a box lands near whoever is running dry (in co-op that is often the partner, not the host)
    const who = nearPlayer ? this.players().slice().sort((x, y) => (x.ammo + x.reserve) - (y.ammo + y.reserve))[0] : this.player;
    const pp = who.pos;
    const ok = this.world.desks.filter(d => { const dd = Math.hypot(d.x - pp.x, d.z - pp.z); return (nearPlayer ? dd > 1.2 && dd < CFG.supply.near : dd > 2) && !this.milks.some(m => m.desk === d); });
    const desk = pick(ok.length ? ok : this.world.desks);
    const mk = this.makeMilk(desk.x + rand(-0.12, 0.12), (desk.floor || 0) + (desk.h || DESK.h) + 0.1, desk.z + rand(-0.05, 0.05), 'ammo');
    mk.desk = desk; mk.id = this.nextId(); mk.kind = 'ammo'; this.milks.push(mk);
    Audio.itemSpawn(); this.message('有人放了一盒泡棉彈在課桌上', `走過去撿 +${this.supplyAmount()} 發`, 2);
  }
  supplyAmount() { return this.coop ? COOP.supplyAmount : CFG.supply.amount; }
  // ---------- hazard zones (the science teacher's spills) ----------
  addZone(at, r, life, kind = 'acid') {
    this.netEvent({ t: 'zone', p: [+at.x.toFixed(2), +at.z.toFixed(2)], r, l: life, k: kind });
    const color = kind === 'stink' ? 0x9aa88a : kind === 'water' ? 0x6fb7ef : kind === 'fail' ? 0xe0463a : 0x5fcf7a;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: kind === 'water' ? 0.6 : 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, this.world.heightAt(at.x, at.z) + 0.025, at.z); this.scene.add(m);
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 28 }, (_, i) => new THREE.Vector3(Math.cos(i / 28 * 6.283) * r, Math.sin(i / 28 * 6.283) * r, 0.001))), this.world.inkMat); m.add(edge);
    const z = { mesh: m, x: at.x, z: at.z, r, t: life, life, kind, puffs: [] };
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
  spawnMilk() {
    if (this.milks.length >= CFG.milk.max) return;
    const pp = this.player.pos;
    const far = this.world.desks.filter(d => Math.hypot(d.x - pp.x, d.z - pp.z) > CFG.milk.minDistFromPlayer && !this.milks.some(m => m.desk === d));
    const desk = pick(far.length ? far : this.world.desks);
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
        if (low && this.lowTimer <= 0 && this.milks.filter(m => m.kind === 'ammo').length < (this.coop ? 2 : 1)) { this.lowTimer = this.coop ? COOP.lowInterval : CFG.supply.lowInterval; this.spawnSupply(true); }
      }
    }
    const pp = this.player.pos;
    for (let i = this.milks.length - 1; i >= 0; i--) {
      const m = this.milks[i]; m.t += dt;
      m.mesh.position.y = m.baseY + Math.sin(m.t * 3) * 0.02; m.mesh.rotation.y = m.t * 1.2;
      if (this.state !== 'playing' || !this.isHost) continue;
      const near = Math.hypot(m.mesh.position.x - pp.x, m.mesh.position.z - pp.z) < CFG.milk.pickupRadius && Math.abs(m.mesh.position.y - pp.y) < 1.6;
      if (!near) continue;
      if (m.kind === 'ammo') {
        if (this.player.reserve >= this.player.reserveCap()) continue;
        this.scene.remove(m.mesh); this.milks.splice(i, 1);
        this.player.reserve = Math.min(this.player.reserveCap(), this.player.reserve + this.supplyAmount()); this.ui.ammo(this.player.ammo, this.player.ammo === 0, this.player.reserve); this.ui.pickFlash();
        Audio.pickup(); this.message('撿到一盒泡棉彈！', `+${this.supplyAmount()} 發`, 1.4);
      } else if (this.player.hp < this.player.maxHp) {
        this.scene.remove(m.mesh); this.milks.splice(i, 1);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + CFG.milk.heal); this.ui.hp(this.player.hp, this.player.maxHp);
        Audio.drink(); this.message('咕嚕咕嚕，喝了鮮奶！', '+1 ♥', 1.6);
      }
    }
  }
  addScore(n, who = this.lastShooter || 'host') { const b = who === 'guest' ? this.remoteBuff : this.myBuff; if (b && b.id === 'double') n *= 2; this.score += n; this.ui.score(this.score); }
  // buffs belong to the kid who shot the item; slow motion is the exception, the whole room slows for everyone
  hasBuff(id, who = 'host') { const b = who === 'guest' ? this.remoteBuff : this.myBuff; return !!(b && b.id === id); }
  worldSlow() { return this.hasBuff('slow') || this.hasBuff('slow', 'guest') || this.slowT > 0; }
  applyBuff(b, who = 'host') {
    const buff = { id: b.id, name: b.name, effect: b.effect, t: b.dur };
    if (who === 'guest') { this.remoteBuff = buff; this.netEvent({ t: 'buff', b: buff }); this.message(`小美射中${b.name}！`, `${b.effect} ${b.dur} 秒`, 2); return; }
    this.myBuff = buff; this.ui.buff(buff); Audio.item();
    this.message(`射中${b.name}！`, `${b.effect} ${b.dur} 秒`, 2);
  }
  spawnItem() {
    const used = new Set(this.items.map(i => i.mount));
    const mount = pick(this.world.layout.mounts.filter(m => !used.has(m)));
    const item = new SpecialItem(this, pick(BUFFS), mount); item.mount = mount; this.items.push(item);
    Audio.itemSpawn(); this.message('牆上出現了特殊物品', '射中它拿獎勵', 1.6);
  }
  updateItems(dt, realDt) {
    if (this.state === 'playing') { this.itemTimer -= dt; if (this.itemTimer <= 0 && this.items.length < 1) { this.itemTimer = rand(CFG.items.interval[0], CFG.items.interval[1]); this.spawnItem(); } }
    for (let i = this.items.length - 1; i >= 0; i--) if (!this.items[i].update(dt)) { this.items[i].dispose(); this.items.splice(i, 1); }
    if (this.myBuff) { this.myBuff.t -= realDt; if (this.myBuff.t <= 0) { this.myBuff = null; this.ui.buff(null); } else this.ui.buff(this.myBuff); }
    if (this.remoteBuff) { this.remoteBuff.t -= realDt; if (this.remoteBuff.t <= 0) this.remoteBuff = null; }
    if (this.slowT > 0) this.slowT -= realDt;
  }
  message(a, b, d) { this.ui.message(a, b, d); this.netEvent({ t: 'msg', a, b, d }); }
  hitmark() { const who = this.lastShooter || 'host'; this.stat(who, 'hits'); if (who === 'guest') { if (this.remote) this.remote.hits++; this.netEvent({ t: 'hitmark' }); } else { this.ui.hitmark(); this.player.hits++; } }
  onLose() {
    this.state = 'over'; Audio.lose();
    this.netEvent({ t: 'over', win: 0, title: this.coop ? '兩個人都被罰坐了' : '你被罰坐了！', sub: '沒有人能來救，全班歡呼。', stats: this.coopStats() });
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.coop) this.showOver('兩個人都被罰坐了', '沒有人能來救，全班歡呼。', false);
    else this.showOver('你被罰坐了！', pick(['泡棉彈打到五次，乖乖回座位。', '同學們歡呼，你默默舉起白旗。', '下次記得蹲在課桌後面。']), false);
  }
  onWin() {
    this.addScore(CFG.score.win); this.state = 'won'; Audio.bellOut(); setTimeout(() => Audio.win(), 1800);
    const tn = this.bossName || '老師', trio = this.teachers.length > 1;
    const sub = trio ? '三位監考官同時崩潰，會考取消。你是全校的傳說。' : '三個道具全掉，全班自由。你是三年二班的傳說。';
    this.message('下課！！！', `${tn}崩潰，宣布今天不用上課`, 4);
    this.netEvent({ t: 'over', win: 1, title: `下課！${tn}${trio ? '全員' : ''}投降了`, sub, stats: this.coopStats() });
    setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); this.showOver(`下課！${tn}${trio ? '全員' : ''}投降了`, sub, true); }, 3200);
  }
  showOver(title, sub, win, remoteStats = null) {
    $('over').hidden = false; $('hud').hidden = true;
    $('over-title').textContent = title; $('over-title').classList.toggle('red-pen', !win); $('over-sub').textContent = sub;
    $('st-score').textContent = this.score; $('st-wave').textContent = this.bossPhase ? '老師' : this.wave;
    const st = remoteStats || this.coopStats();
    if (st) {
      const acc = (h, s) => s ? Math.min(100, Math.round(h / s * 100)) + '%' : '0%';
      $('st-kills').textContent = `${st.host.name} ${st.host.kills}・${st.guest.name} ${st.guest.kills}`;
      $('st-acc').textContent = `${acc(st.host.hits, st.host.shots)}・${acc(st.guest.hits, st.guest.shots)}`;
      $('over-sub').textContent = sub + ` 互相救了 ${st.host.revives + st.guest.revives} 次，被班長記了 ${st.host.strokes + st.guest.strokes} 筆。`;
    } else {
      $('st-kills').textContent = this.kills;
      $('st-acc').textContent = this.player.shots ? Math.min(100, Math.round(this.player.hits / this.player.shots * 100)) + '%' : '0%';
    }
  }
  coopStats() {
    if (!this.coop || !this.stats) return null;
    const h = this.stats.host, g = this.stats.guest;
    return { host: { name: PLAYER_SKINS.host.name, kills: h.kills, hits: this.player.hits, shots: this.player.shots, revives: h.revives, strokes: h.strokes },
      guest: { name: PLAYER_SKINS.guest.name, kills: g.kills, hits: this.remote ? this.remote.hits : 0, shots: this.remote ? this.remote.shots : 0, revives: g.revives, strokes: g.strokes } };
  }
  // ---------- loop ----------
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.state === 'playing' || this.state === 'won') this.step(dt);
    if (this.state === 'upgrade' && this.offer) { this.offer.t -= dt; if (this.offer.t <= 0) { if (!this.offer.picked.host) this.pickUpgrade($('upgrade-cards').children[0].dataset.id); else this.closeOffer(); } }
    this.tickLiveOffer(dt);
    this.ui.tick(dt); this.touchCtl.update();
    this.renderer.render(this.scene, this.camera);
  }
  step(realDt) {
    if (!this.isHost) return this.guestStep(realDt);
    this.player.update(realDt);
    if (this.remote) this.remote.update(realDt);
    const dt = realDt * (this.worldSlow() ? CFG.items.slowScale : 1); // the world slows down, the players do not
    this.updateItems(dt, realDt);
    // spawning & waves
    if (this.state === 'playing') {
      if (this.spawnQueue.length) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { const e = this.spawnQueue.shift(), door = e.door || e; this.students.push(new Student(this, { x: door.x - 0.3, z: door.z }, { leader: !!e.leader })); if (e.leader) { this.message('班長帶隊進來了！', '先打倒她，其他人會慌', 2); Audio.tattle(); this.netEvent({ t: 'sfx', n: 'tattle' }); } this.spawnTimer = this.diff.spawnGap; this.ui.left(this.students.filter(s => s.alive).length + this.spawnQueue.length); }
      } else if (!this.bossPhase) {
        const alive = this.students.filter(s => s.alive).length;
        if (alive === 0) {
          if (this.nextWavePending) {
            this.waveTimer -= dt;
            if (this.waveTimer <= 0) { this.nextWavePending = false; if (this.wave >= this.diff.waves.length) this.startBoss(); else this.startWave(); }
          } else if (this.wave > 0) {
            this.addScore(CFG.score.wave); this.nextWavePending = true; this.waveTimer = 2.5;
            const heal = this.diff.healPerWave;
            this.message('這波清光了！', heal ? `+500，回 ${heal} ♥` : '+500', 1.8);
            if (heal) for (const pl of this.players()) { if (!pl.sitting) { pl.hp = Math.min(pl.maxHp, pl.hp + heal); if (pl === this.player) this.ui.hp(pl.hp, pl.maxHp); } }
            if (this.player.hp < this.player.maxHp) this.spawnMilk();
            this.offerTimer = 1.6; this.waveTimer = 6.5; // time to breathe: scavenge darts, drink milk, pick an upgrade
          }
        }
      } else if (!this.teachers.length) {
        this.bossTimer -= dt; if (this.bossTimer <= 0) this.spawnTeacher();
      }
    }
    if (this.offerTimer > 0) { this.offerTimer -= dt; if (this.offerTimer <= 0) this.openOffer(); }
    this.panicT = Math.max(0, (this.panicT || 0) - dt);
    this.updateMilk(dt); this.updateProps(dt); this.updateZones(dt); for (const p of this.props) p.update(dt);
    for (const s of this.students) s.update(dt);
    for (const t of this.teachers) t.update(dt);
    if (this.isHost) this.updateBell(dt);
    else { const left = this.students.filter(s => s.alive).length + this.spawnQueue.length; if (left !== this._left) { this._left = left; this.ui.left(left); } }
    // darts & hits
    const player = this.player;
    this.darts.update(dt, (d, prev) => {
      if (d.kind && d.kind.endsWith('Break')) { if (d.kind === 'tubeBreak') this.addZone(d.pos, 1.1, 4); return false; }
      const p = d.mesh.position;
      for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i].testDart(d)) { this.applyBuff(this.items[i].buff, d.who === 'guest' ? 'guest' : 'host'); this.items[i].dispose(); this.items.splice(i, 1); return true; }
      for (const pr of this.props) if (pr.testDart(d)) return true;
      if (d.kind === 'dart' && this.ball && this.ball.testDart(d)) return true;
      if (d.kind === 'dart' && this.bully && this.bully.testHit(p)) { this.bully.poke(d.owner, d.shooter, d.who); return true; }
      if (d.owner === 'player' && this.monitor && this.monitor.testHit(p)) { this.monitor.hitByDart(); return true; }
      if (d.owner === 'player') {
        for (const s of this.students) {
          if (!s.alive) continue;
          const dx = p.x - s.group.position.x, dz = p.z - s.group.position.z;
          const h = 1.35 * s.group.scale.y;
          if (dx * dx + dz * dz < 0.36 * 0.36 && p.y > s.group.position.y && p.y < s.group.position.y + h) { this.lastShooter = d.who; if (s.hit()) { this.kills++; this.stat(d.who, 'kills'); this.ui.left(this.students.filter(x => x.alive).length + this.spawnQueue.length); } this.lastShooter = null; return true; }
        }
        for (const t of this.teachers) {
          this.lastShooter = d.who; const r = t.testHit(p, prev); this.lastShooter = null;
          if (r === 'weak') return true;
          if (r === 'body') { if (!this.bodyHintShown) { this.bodyHintShown = true; this.message('打身體沒用！', '瞄準紅圈：眼鏡、粉筆、教案', 2.5); } Audio.thud(); return true; }
        }
      } else if (this.state === 'playing') {
        for (const pl of this.activeTargets()) {
          const dx = p.x - pl.pos.x, dz = p.z - pl.pos.z;
          const hr = 0.28 * (1 - (pl.up ? pl.up.dodge : 0));
          if (dx * dx + dz * dz < hr * hr && p.y > pl.pos.y && p.y < pl.pos.y + pl.eye + 0.2) { pl.hurt(); return true; }
        }
      }
      return false;
    });
    // the guest's scavenging and milk are judged here, where the darts and cartons live
    if (this.remote && this.remote.group.visible && !this.remote.sitting && this.state === 'playing') {
      const got = this.darts.pickupNear(this.remote.pos, CFG.gun.pickupRadius * this.remote.up.pickupMul, Math.max(0, CFG.gun.reserveMax + this.remote.up.reserveBonus - this.remote.reserve));
      if (got > 0) { this.remote.reserve += got; this.netEvent({ t: 'pickup', n: got }); }
      for (let i = this.milks.length - 1; i >= 0; i--) {
        const m = this.milks[i];
        if (Math.hypot(m.mesh.position.x - this.remote.pos.x, m.mesh.position.z - this.remote.pos.z) >= CFG.milk.pickupRadius || Math.abs(m.mesh.position.y - this.remote.pos.y) >= 1.6) continue;
        if (m.kind === 'ammo') { if (this.remote.reserve >= CFG.gun.reserveMax + this.remote.up.reserveBonus) continue; this.scene.remove(m.mesh); this.milks.splice(i, 1); this.remote.reserve += this.supplyAmount(); this.netEvent({ t: 'pickup', n: this.supplyAmount() }); break; }
        if (this.remote.hp < this.remote.maxHp) { this.scene.remove(m.mesh); this.milks.splice(i, 1); this.remote.hp = Math.min(this.remote.maxHp, this.remote.hp + CFG.milk.heal); this.stat('guest', 'milk'); this.netEvent({ t: 'drink' }); break; }
      }
    }
    if (this.transport) {
      this.snapTimer -= realDt;
      if (this.snapTimer <= 0) { this.snapTimer = 1 / NET.snapHz; this.transport.send(JSON.stringify(serializeSnapshot(this))); }
    }
  }
}
