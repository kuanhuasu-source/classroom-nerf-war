import * as THREE from 'three';

// ============================================================
//  Config
// ============================================================
export const CFG = {
  room: { w: 12, d: 9, h: 3.2 },
  player: { eye: 1.25, crouchEye: 0.62, radius: 0.28, walk: 3.2, run: 5.0, crouchSpeed: 1.7, hp: 5 },
  gun: { restCap: 90, mag: 15, reloadEmpty: 1.3, reloadPartial: 0.85, speed: 32, gravity: 6, fireInterval: 0.18, reserveStart: 90, reserveMax: 150, autoReloadDelay: 0.35, pickupRadius: 1.4, floorLife: 40, dropOnKnockout: 8 },
  choco: { heal: 3, ammo: 20 },
  // touch (phone / tablet) help: a magnet near targets, bigger hit circles for that player's darts, enemies a little kinder, one more heart. Per player, never advertised.
  assist: { cone: 0.12, friction: 0.55, pull: 4.5, hitMul: 1.3, enemySpreadMul: 1.3, enemyDartMul: 0.9, extraHp: 1, gyroSens: 1.0 }, // a sneaky bite of chocolate when the bell rings for the boss: hearts and darts back
  supply: { interval: 12, amount: 20, lowInterval: 12, lowAt: 40, near: 4 },
  enemy: { hp: 3, speed: 2.6, dartSpeed: 19, spread: 0.13 },
  waves: [3, 4, 5, 6],
  teacher: { wpHp: 3, throwInterval: 1.6, chalkSpeed: 17, eraserEvery: 11, eraserSpeed: 11, eraserRetaliate: 2.5, dustRadius: 1.5, dustLife: 5, dustBlind: 2.2 }, // eraserRetaliate: a hit on a weak point draws an eraser at once, at most once per this many seconds // the eraser: every teacher throws one now and then; its chalk dust blinds whoever stands in it
  committee: { wpHp: 2, bellEvery: 25, bellWarn: 2.2, collectHold: 3, countdown: 5, stampLife: 7, stampRadius: 1.4 },
  score: { hit: 50, out: 300, wave: 500, weakpoint: 1000, win: 5000, leader: 600 },
  leader: { hpBonus: 3, peekMul: 0.9, panicSeconds: 5, panicSpreadMul: 2.2, drop: 10 },
  milk: { heal: 1, interval: 18, max: 2, pickupRadius: 0.9, reach: 0.55, minDistFromPlayer: 2.5 }, // reach: how close to the table's edge counts (player radius 0.28 + slack)
  bully: { windup: 1.0, blastRadius: 1.7, grumble: 1.6, hitRadius: 0.55, deepSleep: 20 },
  ball: { radius: 0.22, launch: 9.5, hurtSpeed: 3.5, start: { x: -0.5, z: 0.55 } },
  monitor: { sight: 8, strokeCooldown: 2.5, reinforcements: 2, rageSeconds: 8, speed: 1.6, rest: 25 },
  items: { interval: [20, 35], life: 15, hitRadius: 0.34, slowScale: 0.35, speedMul: 1.6 },
  // which classroom elements show up is rolled once per game
  features: { bully: 0.6, ball: 0.6, monitor: 0 }, // the roaming monitor is off: 班長 now leads each wave instead
};
export const DESK = { w: 0.62, d: 0.46, h: 0.72 };
export const DESK_COLS = [-4.5, -2.9, -1.3, 0.3, 1.9, 3.5];
export const DESK_ROWS = [-2.2, -1.1, 0.0, 1.1, 2.2];
export const DOORS = [{ x: 5.6, z: -3.3 }, { x: 5.6, z: 3.3 }];
export const PLAYER_START = new THREE.Vector3(-5.0, 0, 3.7);
export const NET = { snapHz: 15, inputHz: 20 };
// up to four kids in a room: the host and three guests, each with a fixed look and name
export const PLAYERS = [
  { slot: 'host', name: '小明', v: { skin: '#f6d6b8', shirt: '#9fd3f2', hair: 0, hairColor: '#2b2622' } },
  { slot: 'g1', name: '小美', v: { skin: '#f3c9ad', shirt: '#f4e27a', hair: 1, hairColor: '#4a2f1d' } },
  { slot: 'g2', name: '阿強', v: { skin: '#e9c39c', shirt: '#b7e3a1', hair: 2, hairColor: '#2b2622' } },
  { slot: 'g3', name: '小芳', v: { skin: '#f6d6b8', shirt: '#f7a8c4', hair: 0, hairColor: '#5a3a1e' } },
];
export const skinOf = (slot) => PLAYERS.find(p => p.slot === slot) || PLAYERS[0];
// looks a player can pick for a room (name is typed separately); the slot defaults above stay as fallbacks
export const LOOKS = [
  { id: 'l1', label: '藍衣', v: { skin: '#f6d6b8', shirt: '#9fd3f2', hair: 0, hairColor: '#2b2622' } },
  { id: 'l2', label: '黃衣', v: { skin: '#f3c9ad', shirt: '#f4e27a', hair: 1, hairColor: '#4a2f1d' } },
  { id: 'l3', label: '綠衣', v: { skin: '#e9c39c', shirt: '#b7e3a1', hair: 2, hairColor: '#2b2622' } },
  { id: 'l4', label: '粉衣', v: { skin: '#f6d6b8', shirt: '#f7a8c4', hair: 0, hairColor: '#5a3a1e' } },
  { id: 'l5', label: '白衣', v: { skin: '#f0cfae', shirt: '#ffffff', hair: 2, hairColor: '#6b3a1e' } },
  { id: 'l6', label: '紫衣', v: { skin: '#f3c9ad', shirt: '#c9b6f2', hair: 1, hairColor: '#2b2622' } },
  { id: 'l7', label: '橘衣', v: { skin: '#e9c39c', shirt: '#f6a85a', hair: 0, hairColor: '#2b2622' } },
  { id: 'l8', label: '紅衣', v: { skin: '#f6d6b8', shirt: '#e0463a', hair: 1, hairColor: '#8a8a8a' } },
];
export const lookById = (id) => LOOKS.find(l => l.id === id) || null;
// the skin a player ends up with: typed name and picked look, else the slot's default kid
export const skinFor = (slot, name, look) => { const base = skinOf(slot), l = lookById(look); return { slot, name: (name || '').trim().slice(0, 6) || base.name, v: l ? l.v : base.v }; };
export const GUEST_SLOTS = ['g1', 'g2', 'g3'];
export const PLAYER_SKINS = { host: PLAYERS[0], guest: PLAYERS[1] };
// Difficulty presets. maxShooters is the big one: how many students may be firing at once.
export const DIFFICULTY = {
  easy:   { label: '小考', waves: [2, 3, 3, 4, 4, 5], enemyHp: 2, spread: 1.8, minSpread: 1.4, maxShooters: 1, spawnGap: 2.0, healPerWave: 2, burstMax: 2, teacherMul: 1.5, peekDelay: 0.9, dartSpeed: 12, firstShotMul: 2.5, bossChance: 0.1, hideMul: 1.5 },
  normal: { label: '段考', waves: [3, 4, 4, 5, 5, 6], enemyHp: 2, spread: 1.5, minSpread: 1.0, maxShooters: 2, spawnGap: 1.5, healPerWave: 1, burstMax: 2, teacherMul: 1.2, peekDelay: 0.7, dartSpeed: 14, firstShotMul: 2.0, bossChance: 0.25, hideMul: 1.3 },
  hard:   { label: '模擬考', waves: [3, 4, 5, 6, 7, 8], enemyHp: 3, spread: 1.1, minSpread: 0.7, maxShooters: 3, spawnGap: 0.9, healPerWave: 0, burstMax: 3, teacherMul: 1.0, peekDelay: 0.5, dartSpeed: 18, firstShotMul: 1.3, bossChance: 0.4, hideMul: 1.0 },
  exam:   { label: '會考', waves: [4, 5, 6, 7, 8, 9], enemyHp: 3, spread: 1.0, minSpread: 0.6, maxShooters: 4, spawnGap: 0.8, healPerWave: 0, burstMax: 3, teacherMul: 0.85, peekDelay: 0.45, dartSpeed: 19, firstShotMul: 1.25, bossChance: 0.6, hideMul: 0.9 }, // 會考：給已經能穩過模擬考的人
};
// 守校門：隔壁學校的惡霸軍團從校門、圍牆、水溝蓋闖進操場，守十波。彈藥無限；第 3、6、9 波有頭目，第 10 波是大王。
export const SIEGE = { waves: [4, 5, 6, 7, 8, 9, 10, 11, 12, 10], bosses: { 3: 'gang1', 6: 'gang2', 9: 'gang3', 10: 'king' }, hpBonus: 1, entries: ['gate', 'drain', 'wall', 'gate'], bossDelay: 2.5 };
// 搶廁所：下課要去廁所，清潔隊正在打掃。三滴血、倒數 90 秒；潑水中了慢 5 秒、通馬桶連發 3 到 5 支；射中小便斗裡的紅心就贏
export const TOILET = { time: 90, hp: 3, crew: 5, minCrew: 4, refill: 6, wetSeconds: 5, wetSpeed: 0.5, plungerBurst: [3, 5], plungerGap: 0.25, waterChance: 0.4, waterSpeed: 13, bull: 0.15, target: 0.45, timeBonus: 20 };
export const COOP = { offerSeconds: 10, waveMul: 1.4, supplyAmount: 30, lowInterval: 8, maxGuests: 3, starters: { host: 'mag', g1: 'magnet', g2: 'rapid', g3: 'bag' }, waves: [4, 6, 6, 8, 8, 9], teacherWpHp: 4, reinforcements: 3, sitSeconds: 12, reviveRadius: 1.2, reviveHp: 2, invuln: 1.5 };
export const EMOTES = ['', '掩護我！', '我沒彈了！', '惡霸醒了！', '班長來了！'];
export const BUFFS = [
  { id: 'double', name: '滿分考卷', effect: '分數雙倍', dur: 12 },
  { id: 'infinite', name: '老師的糖果罐', effect: '彈匣不會減少', dur: 8 },
  { id: 'speed', name: '貼紙獎勵', effect: '跑得超快', dur: 10 },
  { id: 'slow', name: '教室時鐘', effect: '全教室慢動作', dur: 5 },
];
// where a special item can hang: position + facing (rotation about Y)
export const MOUNTS = [
  { x: -2.0, y: 2.0, z: -4.41, ry: 0 }, { x: -0.6, y: 1.35, z: -4.41, ry: 0 }, { x: 1.6, y: 1.25, z: -4.41, ry: 0 }, { x: 2.3, y: 2.05, z: -4.41, ry: 0 },
  { x: -3.2, y: 1.85, z: 4.41, ry: Math.PI }, { x: -1.9, y: 1.5, z: 4.41, ry: Math.PI },
  { x: 4.3, y: 1.55, z: 3.93, ry: Math.PI },
  { x: -5.96, y: 2.75, z: -1.3, ry: Math.PI / 2 }, { x: -5.96, y: 2.75, z: 1.3, ry: Math.PI / 2 },
  { x: 5.96, y: 1.7, z: 0, ry: -Math.PI / 2 },
];

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
