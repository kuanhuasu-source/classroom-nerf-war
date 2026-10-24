import * as THREE from 'three';
import { CFG, DESK, DESK_COLS, DESK_ROWS, DOORS, PLAYER_START, BUFFS, MOUNTS, rand, pick, clamp } from './config.js';
import { Audio } from './audio.js';
import { Draw } from './draw.js';

// ============================================================
//  UI
// ============================================================
export const $ = (id) => document.getElementById(id);
export class UI {
  constructor() {
    this.msgTimer = 0; this.msgEl = $('msg');
  }
  wave(n) { $('wave').textContent = n; }
  timer(t) { const el = $('hud-time'); if (t === null || t === undefined) { el.hidden = true; return; } el.hidden = false; $('time').textContent = Math.max(0, Math.ceil(t)); el.classList.toggle('low', t <= 10); }
  leftLabel(text) { $('left').previousElementSibling.textContent = text; }
  wet(on) { $('wet').classList.toggle('on', !!on); }
  score(n) { $('score').textContent = n; }
  left(n) { $('left').textContent = n; }
  hp(n, max = CFG.player.hp) { let s = ''; for (let i = 0; i < max; i++) s += i < n ? '♥' : '<span class="lost">♥</span>'; $('hud-hp').innerHTML = s; }
  offer(list, onPick, seconds = 0) { // list: [{id,name,desc}] ; onPick(id); seconds > 0 = compact live panel with a countdown
    const box = $('upgrade'); const cards = $('upgrade-cards'); cards.innerHTML = '';
    box.classList.toggle('compact', seconds > 0); $('upgrade-note').textContent = seconds > 0 ? `${seconds} 秒內按 1、2、3，沒選自動拿第一張` : '下一波馬上來。';
    list.forEach((u, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'card-up'; b.dataset.id = u.id;
      b.innerHTML = `<kbd>${i + 1}</kbd><b></b><span></span>`; b.querySelector('b').textContent = u.name; b.querySelector('span').textContent = u.desc;
      b.addEventListener('click', () => onPick(u.id)); cards.appendChild(b);
    });
    box.hidden = false; this.offerOpen = true;
  }
  closeOffer() { $('upgrade').hidden = true; this.offerOpen = false; }
  offerTime(t) { if (this.offerOpen) $('upgrade-note').textContent = `${Math.max(0, Math.ceil(t))} 秒內按 1、2、3，沒選自動拿第一張`; }
  upgrades(names) { const el = $('hud-up'); if (!names.length) { el.classList.remove('on'); return; } el.classList.add('on'); el.textContent = names.join('・'); }
  ammo(n, empty, reserve) { $('ammo').textContent = n; $('hud-ammo').classList.toggle('empty', !!empty); $('hud-ammo').classList.remove('reloading'); if (reserve !== undefined) { $('reserve').textContent = this.infinite ? '∞' : reserve; $('reserve').parentElement.classList.toggle('low', !this.infinite && reserve <= 5); } }
  pickFlash() { const el = $('hud-ammo'); el.classList.remove('pick'); void el.offsetWidth; el.classList.add('pick'); }
  reloading(on) { $('hud-ammo').classList.toggle('reloading', on); $('reload-bar').style.width = '0%'; }
  reloadProgress(t) { $('reload-bar').style.width = (t * 100).toFixed(0) + '%'; }
  message(main, sub, dur) {
    this.msgEl.innerHTML = ''; const t = document.createTextNode(main); this.msgEl.appendChild(t);
    if (sub) { const s = document.createElement('small'); s.textContent = sub; this.msgEl.appendChild(s); }
    this.msgEl.classList.add('show'); this.msgTimer = dur;
  }
  tick(dt) { if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) this.msgEl.classList.remove('show'); } }
  hitmark() { const h = $('hitmark'); h.classList.add('show'); clearTimeout(this._hm); this._hm = setTimeout(() => h.classList.remove('show'), 60); }
  vignette() { const v = $('vignette'); v.classList.add('hit'); clearTimeout(this._vg); this._vg = setTimeout(() => v.classList.remove('hit'), 80); }
  dust(t, canvas) { const el = $('dust'); el.style.opacity = t > 0 ? Math.min(0.85, t / 1.4).toFixed(2) : 0; canvas.style.filter = t > 0 ? `blur(${Math.min(6, t * 4).toFixed(1)}px)` : ''; }
  net(text) { const el = $('hud-net'); if (!text) { el.classList.remove('on'); return; } el.classList.add('on'); el.textContent = text; }
  boss(on) { $('hud-boss').classList.toggle('on', on); }
  buff(b) { const el = $('hud-buff'); if (!b) { el.classList.remove('on'); return; } el.classList.add('on'); $('buff-name').textContent = b.name; $('buff-effect').textContent = b.effect; $('buff-time').textContent = Math.ceil(b.t); }
  // groups: [{ name, entries: [{label, hp}], max, defeated }] — one boss gives three stickers, the committee one sticker per examiner
  bossWp(groups) {
    const pips = (hp, max) => '●'.repeat(Math.min(Math.max(0, hp), max)) + '○'.repeat(Math.max(0, max - Math.max(0, hp)));
    let html;
    if (groups.length === 1) html = groups[0].entries.map(e => `<div class="sticker${e.hp <= 0 ? ' gone' : ''}"><span class="label">${e.label}</span> <span class="pips">${pips(e.hp, groups[0].max)}</span></div>`).join('');
    else html = groups.map(gp => `<div class="sticker${gp.defeated ? ' gone' : ''}"><b>${gp.name}</b>${gp.entries.map(e => `<span class="item${e.hp <= 0 ? ' gone' : ''}"><span class="label">${e.label}</span> <span class="pips">${pips(e.hp, gp.max)}</span></span>`).join('<span class="dot">·</span>')}</div>`).join('');
    const box = $('hud-boss'); box.classList.toggle('many', groups.length > 1);
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  }
}
