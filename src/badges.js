import { $ } from './ui.js';
import { Audio } from './audio.js';
import { Ach } from './achievements.js';
import { Profile } from './profile.js';

// 徽章：每打完一場抽一枚（贏一定抽，輸一半機率安慰抽，稀有度降一級）。稀有度看這場的難度，多人再加一點。
// 一枚一種效果，數值在稀有度的範圍內隨機。首頁最多佩戴三枚（破完故事開第二格，全章三星或 12 張貼紙開第三格）。
// 收藏上限 40，三枚同類同級可合成一枚同類型高一級的。
// 每一種徽章是一位校園傳奇：四個稀有度是那個人留下的東西，傳說級就是本人。戴著的徽章湊成指定的兩種類型就是一組套裝，給一個固定的小加成。
export const TIERS = [
  { id: 0, name: '普通', color: '#9aa0a6' },
  { id: 1, name: '精良', color: '#2f6fd1' },
  { id: 2, name: '稀有', color: '#8e44ad' },
  { id: 3, name: '傳說', color: '#d4a017' },
];
// value per tier (null: this type does not come in that tier); jitter: ± random added on top
export const TYPES = {
  hp: { icon: '🐕', name: '愛心', legend: '校犬小黑', line: '守了校門十二年，颱風天也不走', tiers: ['小黑的腳印', '小黑的項圈', '小黑的狗牌', '校犬小黑'], desc: (v) => `愛心上限 +${v}`, vals: [1, 1, 2, 2], jitter: 0 },
  mag: { icon: '🍞', name: '大彈匣', legend: '福利社陳阿姨', line: '永遠說「還有，後面還有」', tiers: ['福利社收據', '福利社零錢包', '陳阿姨的圍裙', '福利社陳阿姨'], desc: (v) => `彈匣 +${v} 發`, vals: [2, 4, 6, 9], jitter: 1 },
  rate: { icon: '🎹', name: '快手', legend: '天才鋼琴家林小妍', line: '全校唯一彈得動〈野蜂飛舞〉的人', tiers: ['斷掉的琴弦', '節拍器', '小妍的樂譜', '天才鋼琴家林小妍'], desc: (v) => `射速 +${Math.round(v * 100)}%`, vals: [0.06, 0.10, 0.15, 0.22], jitter: 0.02 },
  multi: { icon: '🏐', name: '連發', legend: '躲避球王阿豪', line: '一次丟三顆球，裁判吹哨都來不及', tiers: ['洩氣的躲避球', '阿豪的護腕', '校隊球衣 7 號', '躲避球王阿豪'], desc: (v) => `每次射擊多 ${v} 顆（不耗彈，散得開；同一個人一次只算一下）`, vals: [null, null, 1, 2], jitter: 0 },
  regenHp: { icon: '🩹', name: '慢慢回血', legend: '保健室王阿姨', line: '「擦一下就好了」，然後真的好了', tiers: ['OK 繃', '冰敷袋', '王阿姨的聽診器', '保健室王阿姨'], desc: (v) => `每 ${v} 秒回 1 顆心`, vals: [null, 40, 30, 20], jitter: 5 },
  regenAmmo: { icon: '🧹', name: '自動補彈', legend: '工友阿勇伯', line: '掃地掃到的泡棉彈都放在警衛室窗台', tiers: ['掃把頭', '畚箕', '阿勇伯的鑰匙串', '工友阿勇伯'], desc: (v) => `每 ${v} 秒備用彈 +5`, vals: [null, 25, 18, 12], jitter: 3 },
  speed: { icon: '👟', name: '快腿', legend: '飛毛腿張飛翔', line: '校運會百米紀錄 13 秒 1，至今沒人破', tiers: ['磨平的釘鞋', '接力棒', '飛翔的號碼布', '飛毛腿張飛翔'], desc: (v) => `移動速度 +${Math.round(v * 100)}%`, vals: [null, 0.05, 0.08, 0.12], jitter: 0.01 },
};
// 套裝：戴著的徽章裡同時有這兩種類型就啟動（不限稀有度）；畢業生代表要三種不同、全部稀有以上。加成固定、不隨稀有度變強。
export const SETS = [
  { id: 'dodge', name: '躲避球校隊', need: ['rate', 'multi'], line: '小妍跟阿豪同一隊，沒人接得到', bonus: '連發多出的子彈散得比較集中', fx: { spreadMul: 0.5 } },
  { id: 'nurse', name: '保健室常客', need: ['hp', 'regenHp'], line: '王阿姨看到你就先拿 OK 繃', bonus: '被打中後的保護時間多 0.5 秒', fx: { invulnBonus: 0.5 } },
  { id: 'shop', name: '福利社 VIP', need: ['mag', 'regenAmmo'], line: '阿勇伯撿的，陳阿姨賣的，都給你', bonus: '換彈快 30%', fx: { reloadMul: 0.7 } },
  { id: 'pe', name: '體育股長', need: ['speed', 'hp'], line: '跑最快、跌倒最多、哭最少', bonus: '蹲著走跟走路一樣快', fx: { crouchFull: 1 } },
  { id: 'late', name: '遲到大王', need: ['speed', 'rate'], line: '鐘響衝進教室，手上還在寫作業', bonus: '每一波開始的 5 秒跑得超快', fx: { bellRush: 5 } },
  { id: 'duty', name: '值日生', need: ['regenAmmo', 'regenHp'], line: '擦黑板、倒垃圾、順便撿子彈', bonus: '兩種回復的秒數都少 20%', fx: { regenMul: 0.8 } },
  { id: 'grad', name: '畢業生代表', need: 3, line: '小黑陪你上台領獎', bonus: '開場 10 秒跑得超快，每清一波回 1 顆心', fx: { grad: 1 } },
];
export const setById = (id) => SETS.find(s => s.id === id);
// chance of each tier by difficulty (普通 / 精良 / 稀有 / 傳說)
const ODDS = { easy: [70, 25, 5, 0], normal: [50, 35, 13, 2], hard: [30, 40, 24, 6], exam: [15, 40, 33, 12] };
export const CAP = 40;

const r2 = (v) => Math.round(v * 100) / 100;
export const Badges = {
  data: null,
  load() { if (this.data) return this.data; this.data = Profile.get('badges') || {}; this.data.list = this.data.list || []; this.data.worn = this.data.worn || []; this.data.seq = this.data.seq || 0; return this.data; },
  save() { Profile.put('badges', this.data); },
  slots(storyDone, third) { return 1 + (storyDone ? 1 : 0) + (storyDone && third ? 1 : 0); },
  // roll a badge for a finished round; null when the loss coin flip fails
  roll(level, win, multiplayer) {
    if (!win && Math.random() < 0.5) return null;
    const odds = ODDS[level] || ODDS.normal; let r = Math.random() * 100, tier = 0;
    for (let i = 0; i < 4; i++) { r -= odds[i]; if (r <= 0) { tier = i; break; } }
    if (multiplayer && tier < 3 && Math.random() < 0.1) tier++;
    if (!win) tier = Math.max(0, tier - 1);
    return this.make(tier, level);
  },
  // type given: that type (merging keeps the type); otherwise a random type that comes in this tier
  make(tier, src = '', type = null) {
    const pool = Object.keys(TYPES).filter(k => TYPES[k].vals[tier] !== null);
    if (!type || !pool.includes(type)) type = pool[Math.floor(Math.random() * pool.length)];
    const T = TYPES[type];
    let val = T.vals[tier]; if (T.jitter) { const j = (Math.random() * 2 - 1) * T.jitter; val = Number.isInteger(T.vals[tier]) ? Math.max(1, Math.round(val + j)) : r2(Math.max(0.01, val + j)); }
    const d = this.load(); return { id: 'b' + (++d.seq) + Math.random().toString(36).slice(2, 5), type, tier, val, ts: Date.now(), src };
  },
  // keep it; when the box is full the oldest, lowest badge that is not worn goes
  add(b) {
    const d = this.load(); let dropped = null;
    if (d.list.length >= CAP) { const cand = d.list.filter(x => !d.worn.includes(x.id)).sort((a, c) => a.tier - c.tier || a.ts - c.ts)[0]; if (cand) { dropped = cand; d.list = d.list.filter(x => x !== cand); } }
    d.list.push(b); this.save(); return dropped;
  },
  remove(id) { const d = this.load(); d.list = d.list.filter(b => b.id !== id); d.worn = d.worn.filter(w => w !== id); this.save(); },
  wear(id, slots) { const d = this.load(); if (d.worn.includes(id)) { d.worn = d.worn.filter(w => w !== id); this.save(); return; } if (d.worn.length >= slots) d.worn.shift(); d.worn.push(id); this.save(); if (this.activeSets().length) Ach.unlock('hall'); },
  worn() { const d = this.load(); return d.worn.map(id => d.list.find(b => b.id === id)).filter(Boolean); },
  // three of the same type and tier become one of the next tier; returns how many merges happened
  merge() {
    const d = this.load(); let n = 0;
    for (let guard = 0; guard < 50; guard++) {
      const groups = {}; for (const b of d.list) if (b.tier < 3) (groups[b.type + ':' + b.tier] = groups[b.type + ':' + b.tier] || []).push(b);
      const g = Object.values(groups).find(x => x.length >= 3); if (!g) break;
      const three = g.sort((a, c) => a.ts - c.ts).slice(0, 3); d.list = d.list.filter(b => !three.includes(b)); d.worn = d.worn.filter(w => !three.some(t => t.id === w));
      d.list.push(this.make(three[0].tier + 1, 'merge', three[0].type)); n++;
    }
    if (n) this.save(); return n;
  },
  // which sets the worn badges complete
  activeSets(list = this.worn()) {
    const types = new Set(list.map(b => b.type));
    return SETS.filter(s => s.need === 3 ? (types.size >= 3 && list.length >= 3 && list.every(b => b.tier >= 2)) : s.need.every(t => types.has(t)));
  },
  // the sum of what the worn badges give, plus the set bonuses
  effects(list = this.worn()) {
    const e = { hp: 0, mag: 0, rate: 0, multi: 0, regenHp: 0, regenAmmo: 0, speed: 0, sets: [] };
    for (const b of list) { if (b.type === 'regenHp' || b.type === 'regenAmmo') e[b.type] = e[b.type] ? Math.min(e[b.type], b.val) : b.val; else e[b.type] += b.val; }
    e.multi = Math.min(2, e.multi);
    for (const s of this.activeSets(list)) { e.sets.push(s.id); Object.assign(e, s.fx); }
    if (e.regenMul) { if (e.regenHp) e.regenHp = Math.round(e.regenHp * e.regenMul); if (e.regenAmmo) e.regenAmmo = Math.round(e.regenAmmo * e.regenMul); }
    return e;
  },
  label(b) { const T = TYPES[b.type]; return `${T.icon} ${T.tiers[b.tier]}`; },
  name(b) { return TYPES[b.type].tiers[b.tier]; },
  desc(b) { return TYPES[b.type].desc(b.val); },
  // the badge box on the home page
  render(slots, onChange) {
    const box = $('badge-list'); if (!box) return; box.innerHTML = '';
    const d = this.load(), worn = d.worn;
    this.renderSets();
    $('badge-count').textContent = `${d.list.length} / ${CAP}　佩戴 ${worn.length} / ${slots}`;
    const sorted = d.list.slice().sort((a, c) => (worn.includes(c.id) - worn.includes(a.id)) || c.tier - a.tier || c.ts - a.ts);
    if (!sorted.length) { box.innerHTML = '<p class="note">還沒有徽章。打完一場就會抽到一枚。</p>'; }
    for (const b of sorted) {
      const T = TYPES[b.type], on = worn.includes(b.id), el = document.createElement('div'); el.className = 'badge' + (on ? ' on' : ''); el.style.setProperty('--tier', TIERS[b.tier].color);
      el.innerHTML = '<span class="icon"></span><div class="txt"><b></b><small></small></div><div class="acts"><button type="button" class="mini wear"></button><button type="button" class="mini drop">丟掉</button></div>';
      el.querySelector('.icon').textContent = T.icon; el.querySelector('b').textContent = T.tiers[b.tier]; el.querySelector('small').textContent = `${TIERS[b.tier].name}・${T.desc(b.val)}`;
      const w = el.querySelector('.wear'); w.textContent = on ? '取下' : '佩戴'; w.addEventListener('click', () => { this.wear(b.id, slots); this.render(slots, onChange); if (onChange) onChange(); });
      el.querySelector('.drop').addEventListener('click', () => { this.remove(b.id); this.render(slots, onChange); if (onChange) onChange(); });
      box.appendChild(el);
    }
    const mergeable = Object.values(d.list.filter(b => b.tier < 3).reduce((m, b) => { (m[b.type + ':' + b.tier] = m[b.type + ':' + b.tier] || []).push(b); return m; }, {})).some(g => g.length >= 3);
    $('btn-badge-merge').disabled = !mergeable;
  },
  // the set list under the badges: done, or what is still missing
  renderSets() {
    const box = $('badge-sets'); if (!box) return; box.innerHTML = '';
    const worn = this.worn(), types = new Set(worn.map(b => b.type)), active = this.activeSets(worn).map(s => s.id);
    for (const s of SETS) {
      const on = active.includes(s.id), el = document.createElement('div'); el.className = 'bset' + (on ? ' on' : '');
      const need = s.need === 3 ? '三種不同類型、全部稀有以上' : s.need.map(t => `${TYPES[t].icon}${TYPES[t].name}`).join('＋');
      const missing = s.need === 3 ? '' : s.need.filter(t => !types.has(t)).map(t => TYPES[t].name).join('、');
      el.innerHTML = '<b></b><small class="need"></small><small class="bonus"></small><small class="st"></small>';
      el.querySelector('b').textContent = (on ? '✅ ' : '') + s.name; el.querySelector('.need').textContent = need; el.querySelector('.bonus').textContent = s.bonus;
      el.querySelector('.st').textContent = on ? s.line : (missing && missing.length < need.length ? `還缺：${missing}` : '');
      box.appendChild(el);
    }
  },
  // the face-down card on the result screen
  showDraw(b, dropped, slots, onWear) {
    const wrap = $('badge-draw'); if (!wrap) return; wrap.hidden = !b; if (!b) return;
    const card = $('badge-card'), T = TYPES[b.type]; card.className = 'badge-card'; card.style.setProperty('--tier', TIERS[b.tier].color);
    $('badge-card-icon').textContent = T.icon; $('badge-card-name').textContent = T.tiers[b.tier]; $('badge-card-desc').textContent = `${TIERS[b.tier].name}・${T.desc(b.val)}` + (b.tier >= 3 ? `\n「${T.line}」` : '');
    // what wearing it would complete: the oldest worn badge makes room when the slots are full
    const worn = this.worn(), after = worn.length >= slots ? worn.slice(1).concat([b]) : worn.concat([b]);
    const newSets = this.activeSets(after).filter(s => !this.activeSets(worn).includes(s));
    const notes = []; if (dropped) notes.push(`收藏滿了，丟掉了一枚${this.name(dropped)}`); if (newSets.length) notes.push(`佩戴後湊到套裝：${newSets.map(s => s.name).join('、')}`);
    $('badge-card-note').textContent = notes.join('　');
    const wearBtn = $('btn-badge-wear'); wearBtn.hidden = true; wearBtn.textContent = '佩戴這枚';
    card.onclick = () => { if (card.classList.contains('open')) return; card.classList.add('open'); Audio.item(); if (b.tier >= 2) card.classList.add('shine'); wearBtn.hidden = false; };
    wearBtn.onclick = () => { const d = this.load(); if (!d.worn.includes(b.id)) this.wear(b.id, slots); wearBtn.textContent = '已佩戴'; wearBtn.disabled = true; if (onWear) onWear(); };
    wearBtn.disabled = false;
  },
};
Profile.onSwitch(() => { Badges.data = null; });
