import { $ } from './ui.js';
import { Audio } from './audio.js';

// 徽章：每打完一場抽一枚（贏一定抽，輸一半機率安慰抽，稀有度降一級）。稀有度看這場的難度，多人再加一點。
// 一枚一種效果，數值在稀有度的範圍內隨機。首頁佩戴一枚（破完故事開第二格）。收藏上限 40，三枚同類同級可合成高一級。
export const TIERS = [
  { id: 0, name: '普通', color: '#9aa0a6' },
  { id: 1, name: '精良', color: '#2f6fd1' },
  { id: 2, name: '稀有', color: '#8e44ad' },
  { id: 3, name: '傳說', color: '#d4a017' },
];
// value per tier (null: this type does not come in that tier); jitter: ± random added on top
export const TYPES = {
  hp: { icon: '❤️', name: '愛心', desc: (v) => `愛心上限 +${v}`, vals: [1, 1, 2, 2], jitter: 0 },
  mag: { icon: '📦', name: '大彈匣', desc: (v) => `彈匣 +${v} 發`, vals: [2, 4, 6, 9], jitter: 1 },
  rate: { icon: '⚡', name: '快手', desc: (v) => `射速 +${Math.round(v * 100)}%`, vals: [0.06, 0.10, 0.15, 0.22], jitter: 0.02 },
  multi: { icon: '🔱', name: '連發', desc: (v) => `每次射擊多 ${v} 顆（不耗彈，散得開）`, vals: [null, null, 1, 2], jitter: 0 },
  regenHp: { icon: '💚', name: '慢慢回血', desc: (v) => `每 ${v} 秒回 1 顆心`, vals: [null, 40, 30, 20], jitter: 5 },
  regenAmmo: { icon: '🔄', name: '自動補彈', desc: (v) => `每 ${v} 秒備用彈 +5`, vals: [null, 25, 18, 12], jitter: 3 },
  speed: { icon: '👟', name: '快腿', desc: (v) => `移動速度 +${Math.round(v * 100)}%`, vals: [null, 0.05, 0.08, 0.12], jitter: 0.01 },
};
// chance of each tier by difficulty (普通 / 精良 / 稀有 / 傳說)
const ODDS = { easy: [70, 25, 5, 0], normal: [50, 35, 13, 2], hard: [30, 40, 24, 6], exam: [15, 40, 33, 12] };
export const CAP = 40;

const r2 = (v) => Math.round(v * 100) / 100;
export const Badges = {
  data: null,
  load() { if (this.data) return this.data; try { this.data = JSON.parse(localStorage.getItem('cnw-badges') || 'null') || {}; } catch (e) { this.data = {}; } this.data.list = this.data.list || []; this.data.worn = this.data.worn || []; this.data.seq = this.data.seq || 0; return this.data; },
  save() { try { localStorage.setItem('cnw-badges', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
  slots(storyDone) { return storyDone ? 2 : 1; },
  // roll a badge for a finished round; null when the loss coin flip fails
  roll(level, win, multiplayer) {
    if (!win && Math.random() < 0.5) return null;
    const odds = ODDS[level] || ODDS.normal; let r = Math.random() * 100, tier = 0;
    for (let i = 0; i < 4; i++) { r -= odds[i]; if (r <= 0) { tier = i; break; } }
    if (multiplayer && tier < 3 && Math.random() < 0.1) tier++;
    if (!win) tier = Math.max(0, tier - 1);
    return this.make(tier, level);
  },
  make(tier, src = '') {
    const pool = Object.keys(TYPES).filter(k => TYPES[k].vals[tier] !== null);
    const type = pool[Math.floor(Math.random() * pool.length)], T = TYPES[type];
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
  wear(id, slots) { const d = this.load(); if (d.worn.includes(id)) { d.worn = d.worn.filter(w => w !== id); this.save(); return; } if (d.worn.length >= slots) d.worn.shift(); d.worn.push(id); this.save(); },
  worn() { const d = this.load(); return d.worn.map(id => d.list.find(b => b.id === id)).filter(Boolean); },
  // three of the same type and tier become one of the next tier; returns how many merges happened
  merge() {
    const d = this.load(); let n = 0;
    for (let guard = 0; guard < 50; guard++) {
      const groups = {}; for (const b of d.list) if (b.tier < 3) (groups[b.type + ':' + b.tier] = groups[b.type + ':' + b.tier] || []).push(b);
      const g = Object.values(groups).find(x => x.length >= 3); if (!g) break;
      const three = g.sort((a, c) => a.ts - c.ts).slice(0, 3); d.list = d.list.filter(b => !three.includes(b)); d.worn = d.worn.filter(w => !three.some(t => t.id === w));
      d.list.push(this.make(three[0].tier + 1, 'merge')); n++;
    }
    if (n) this.save(); return n;
  },
  // the sum of what the worn badges give
  effects(list = this.worn()) {
    const e = { hp: 0, mag: 0, rate: 0, multi: 0, regenHp: 0, regenAmmo: 0, speed: 0 };
    for (const b of list) { if (b.type === 'regenHp' || b.type === 'regenAmmo') e[b.type] = e[b.type] ? Math.min(e[b.type], b.val) : b.val; else e[b.type] += b.val; }
    e.multi = Math.min(2, e.multi); return e;
  },
  label(b) { const T = TYPES[b.type]; return `${T.icon} ${TIERS[b.tier].name}${T.name}`; },
  desc(b) { return TYPES[b.type].desc(b.val); },
  // the badge box on the home page
  render(slots, onChange) {
    const box = $('badge-list'); if (!box) return; box.innerHTML = '';
    const d = this.load(), worn = d.worn;
    $('badge-count').textContent = `${d.list.length} / ${CAP}　佩戴 ${worn.length} / ${slots}`;
    const sorted = d.list.slice().sort((a, c) => (worn.includes(c.id) - worn.includes(a.id)) || c.tier - a.tier || c.ts - a.ts);
    if (!sorted.length) { box.innerHTML = '<p class="note">還沒有徽章。打完一場就會抽到一枚。</p>'; }
    for (const b of sorted) {
      const T = TYPES[b.type], on = worn.includes(b.id), el = document.createElement('div'); el.className = 'badge' + (on ? ' on' : ''); el.style.setProperty('--tier', TIERS[b.tier].color);
      el.innerHTML = '<span class="icon"></span><div class="txt"><b></b><small></small></div><div class="acts"><button type="button" class="mini wear"></button><button type="button" class="mini drop">丟掉</button></div>';
      el.querySelector('.icon').textContent = T.icon; el.querySelector('b').textContent = `${TIERS[b.tier].name}・${T.name}`; el.querySelector('small').textContent = T.desc(b.val);
      const w = el.querySelector('.wear'); w.textContent = on ? '取下' : '佩戴'; w.addEventListener('click', () => { this.wear(b.id, slots); this.render(slots, onChange); if (onChange) onChange(); });
      el.querySelector('.drop').addEventListener('click', () => { this.remove(b.id); this.render(slots, onChange); if (onChange) onChange(); });
      box.appendChild(el);
    }
    const mergeable = Object.values(d.list.filter(b => b.tier < 3).reduce((m, b) => { (m[b.type + ':' + b.tier] = m[b.type + ':' + b.tier] || []).push(b); return m; }, {})).some(g => g.length >= 3);
    $('btn-badge-merge').disabled = !mergeable;
  },
  // the face-down card on the result screen
  showDraw(b, dropped, slots, onWear) {
    const wrap = $('badge-draw'); if (!wrap) return; wrap.hidden = !b; if (!b) return;
    const card = $('badge-card'), T = TYPES[b.type]; card.className = 'badge-card'; card.style.setProperty('--tier', TIERS[b.tier].color);
    $('badge-card-icon').textContent = T.icon; $('badge-card-name').textContent = `${TIERS[b.tier].name}・${T.name}`; $('badge-card-desc').textContent = T.desc(b.val);
    $('badge-card-note').textContent = dropped ? `收藏滿了，丟掉了一枚${TIERS[dropped.tier].name}${TYPES[dropped.type].name}` : '';
    const wearBtn = $('btn-badge-wear'); wearBtn.hidden = true; wearBtn.textContent = '佩戴這枚';
    card.onclick = () => { if (card.classList.contains('open')) return; card.classList.add('open'); Audio.item(); if (b.tier >= 2) card.classList.add('shine'); wearBtn.hidden = false; };
    wearBtn.onclick = () => { const d = this.load(); if (!d.worn.includes(b.id)) this.wear(b.id, slots); wearBtn.textContent = '已佩戴'; wearBtn.disabled = true; if (onWear) onWear(); };
    wearBtn.disabled = false;
  },
};
