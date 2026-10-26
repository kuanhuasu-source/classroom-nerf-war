import { Profile } from './profile.js';
import { $ } from './ui.js';

// 個人紀錄：每局結束存一筆摘要，更新最佳成績（每種玩法、每個難度一格，下課大戰再分地圖）、累計，和最近 20 局。
// 全部掛在目前的個人 ID 底下（Profile.key('records')）。
const MODE = { class: '下課大戰', siege: '守校門', toilet: '搶廁所', lunch: '午餐大作戰' };
const LEVEL = { easy: '小考', normal: '段考', hard: '模擬考', exam: '會考' };
const MAP = { classroom: '六年二班', lab: '自然教室', music: '音樂教室', hall: '活動中心', yard: '操場', toilet: '廁所', corridor: '走廊' };
// what counts as a best in each mode: max or min, and whether only wins count
const BESTS = {
  class: [{ f: 'score', label: '最高分', dir: 'max' }, { f: 'acc', label: '最高命中率', dir: 'max', fmt: v => Math.round(v * 100) + '%' }, { f: 'time', label: '最快下課', dir: 'min', win: true, fmt: v => secs(v) }],
  siege: [{ f: 'wave', label: '守到第幾波', dir: 'max', fmt: v => `第 ${v} 波` }, { f: 'time', label: '最快守完', dir: 'min', win: true, fmt: v => secs(v) }, { f: 'score', label: '最高分', dir: 'max' }],
  toilet: [{ f: 'timeLeft', label: '剩最多秒', dir: 'max', win: true, fmt: v => `${v} 秒` }, { f: 'score', label: '最高分', dir: 'max' }],
  lunch: [{ f: 'soup', label: '湯剩最多', dir: 'max', win: true, fmt: v => `${v}%` }, { f: 'time', label: '最快回來', dir: 'min', win: true, fmt: v => secs(v) }, { f: 'kills', label: '打倒最多搶菜的', dir: 'max' }],
};
const secs = (v) => { const m = Math.floor(v / 60), s = Math.round(v % 60); return m ? `${m} 分 ${s} 秒` : `${s} 秒`; };
const fmtOf = (b, v) => b.fmt ? b.fmt(v) : String(v);

export const Records = {
  data: null,
  load() { if (this.data) return this.data; this.data = Profile.get('records') || {}; this.data.totals = this.data.totals || {}; this.data.best = this.data.best || {}; this.data.recent = this.data.recent || []; return this.data; },
  save() { Profile.put('records', this.data); },
  keyFor(r) { return r.mode === 'class' ? `class:${r.level}:${r.map}` : `${r.mode}:${r.level}`; },
  label(key) { const [mode, level, map] = key.split(':'); return `${MODE[mode] || mode}・${LEVEL[level] || level}${map ? '・' + (MAP[map] || map) : ''}`; },
  bump(name, n = 1) { const t = this.load().totals; t[name] = (t[name] || 0) + n; this.save(); },
  // store one finished round; returns the bests it broke (empty on the very first round of that key, that is not a record, that is a baseline)
  record(r) {
    const d = this.load(), t = d.totals, key = this.keyFor(r);
    t.games = (t.games || 0) + 1; if (r.win) t.wins = (t.wins || 0) + 1;
    t.shots = (t.shots || 0) + (r.shots || 0); t.hits = (t.hits || 0) + (r.hits || 0); t.kills = (t.kills || 0) + (r.kills || 0); t.teachers = (t.teachers || 0) + (r.teachers || 0); t.time = (t.time || 0) + (r.time || 0);
    const best = d.best[key] || (d.best[key] = {}), first = !Object.keys(best).length, broken = [];
    for (const b of BESTS[r.mode] || []) {
      if (b.win && !r.win) continue; const v = r[b.f]; if (v === undefined || v === null) continue;
      if (b.f === 'acc' && (r.shots || 0) < 20) continue;
      const old = best[b.f];
      if (old === undefined || (b.dir === 'max' ? v > old : v < old)) { best[b.f] = v; if (old !== undefined) broken.push({ label: b.label, old: fmtOf(b, old), now: fmtOf(b, v) }); }
    }
    d.recent.unshift({ ts: r.ts || Date.now(), mode: r.mode, level: r.level, map: r.map, win: r.win ? 1 : 0, score: r.score || 0, story: r.story || '', stars: r.stars || 0, wave: r.wave || 0, soup: r.soup, timeLeft: r.timeLeft });
    d.recent = d.recent.slice(0, 20); this.save();
    return first ? [] : broken;
  },
  accuracy() { const t = this.load().totals; return t.shots ? t.hits / t.shots : 0; },
  // the records page
  render(profile, extra = {}) {
    const d = this.load(), t = d.totals;
    $('rec-id').textContent = Profile.id; $('rec-name').textContent = profile.name && profile.name !== Profile.id ? profile.name : '';
    const totals = [['局數', t.games || 0], ['贏', t.wins || 0], ['勝率', t.games ? Math.round((t.wins || 0) / t.games * 100) + '%' : '—'], ['射擊', t.shots || 0], ['命中率', t.shots ? Math.round(this.accuracy() * 100) + '%' : '—'],
      ['打倒同學', t.kills || 0], ['打倒老師', t.teachers || 0], ['遊玩時間', secs(t.time || 0)], ['抽到徽章', t.badges || 0], ['合成', t.merges || 0], ['貼紙', extra.stickers || 0], ['故事星星', extra.stars || 0]];
    const tb = $('rec-totals'); tb.innerHTML = ''; for (const [k, v] of totals) { const el = document.createElement('div'); el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = v; el.querySelector('span').textContent = k; tb.appendChild(el); }
    const bb = $('rec-best'); bb.innerHTML = '';
    const keys = Object.keys(d.best).sort();
    if (!keys.length) bb.innerHTML = '<p class="note">還沒有成績，打一局就有。</p>';
    for (const key of keys) {
      const mode = key.split(':')[0], row = document.createElement('div'); row.className = 'rec-row';
      const parts = (BESTS[mode] || []).filter(b => d.best[key][b.f] !== undefined).map(b => `${b.label} ${fmtOf(b, d.best[key][b.f])}`);
      row.innerHTML = '<b></b><span></span>'; row.querySelector('b').textContent = this.label(key); row.querySelector('span').textContent = parts.join('　'); bb.appendChild(row);
    }
    const rb = $('rec-recent'); rb.innerHTML = '';
    if (!d.recent.length) rb.innerHTML = '<p class="note">還沒有打過。</p>';
    for (const r of d.recent) {
      const el = document.createElement('div'); el.className = 'rec-row' + (r.win ? ' win' : '');
      const dt = new Date(r.ts), when = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      const what = r.story ? `故事・${r.story}` : `${MODE[r.mode] || r.mode}・${LEVEL[r.level] || r.level}${r.mode === 'class' && r.map ? '・' + (MAP[r.map] || r.map) : ''}`;
      const res = r.win ? (r.stars ? '★'.repeat(r.stars) : '贏') : '輸';
      const detail = r.mode === 'lunch' && r.soup !== undefined ? `湯 ${r.soup}%` : r.mode === 'toilet' && r.timeLeft !== undefined ? `剩 ${r.timeLeft} 秒` : r.mode === 'siege' ? `第 ${r.wave} 波` : `${r.score} 分`;
      el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = `${when}　${what}`; el.querySelector('span').textContent = `${res}　${detail}`; rb.appendChild(el);
    }
  },
  // 成績卡：一張紙片風的圖，手機長按存圖；round 給了就是這一局的卡，否則是總成績卡
  card({ profile, kidCanvas, stickers, stars, worn, round = null, broken = [] }) {
    const W = 640, H = 1000, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fbf6e6'; x.fillRect(0, 0, W, H); x.strokeStyle = '#cfe0f0'; x.lineWidth = 2; for (let y = 60; y < H; y += 34) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    x.strokeStyle = '#2b2622'; x.lineWidth = 5; x.strokeRect(22, 22, W - 44, H - 44);
    x.fillStyle = 'rgba(242,138,26,.6)'; x.fillRect(W / 2 - 60, 8, 120, 30);
    const font = (px, bold) => { x.font = `${bold ? 'bold ' : ''}${px}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif`; };
    x.fillStyle = '#2b2622'; font(46, true); x.textAlign = 'left'; x.fillText('課桌大戰', 56, 100); x.fillStyle = '#f28a1a'; x.fillText(round ? '這一局' : '成績卡', 250, 100);
    if (kidCanvas) x.drawImage(kidCanvas, W - 180, 60, 110, 220);
    x.fillStyle = '#2b2622'; font(30, true); x.fillText(`ID ${Profile.id}`, 56, 160); font(22, false); x.fillStyle = '#5d564f';
    if (profile.name && profile.name !== Profile.id) x.fillText(profile.name, 56, 195);
    const dt = new Date(); x.fillText(`${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`, 56, 228);
    const d = this.load(), t = d.totals; let y = 300;
    const line = (k, v) => { font(24, false); x.fillStyle = '#5d564f'; x.fillText(k, 56, y); font(28, true); x.fillStyle = '#2f6fd1'; x.textAlign = 'right'; x.fillText(String(v), W - 56, y); x.textAlign = 'left'; y += 44; };
    if (round) {
      font(26, true); x.fillStyle = '#2b2622'; x.fillText(round.title, 56, y); y += 48;
      for (const [k, v] of round.lines) line(k, v);
      if (broken.length) { font(24, true); x.fillStyle = '#d8432b'; for (const b of broken) { x.fillText(`新紀錄！${b.label} ${b.now}（舊 ${b.old}）`, 56, y); y += 36; } }
      y += 20;
    }
    font(26, true); x.fillStyle = '#2b2622'; x.fillText('總成績', 56, y); y += 44;
    line('局數 / 贏', `${t.games || 0} / ${t.wins || 0}`); line('命中率', t.shots ? Math.round(this.accuracy() * 100) + '%' : '—'); line('打倒同學 / 老師', `${t.kills || 0} / ${t.teachers || 0}`); line('貼紙 / 故事星星', `${stickers} / ${stars}`);
    const keys = Object.keys(d.best).sort().slice(0, 4);
    if (keys.length) { y += 10; font(26, true); x.fillStyle = '#2b2622'; x.fillText('最佳成績', 56, y); y += 40; font(20, false); for (const key of keys) { const mode = key.split(':')[0], b = (BESTS[mode] || [])[0]; if (!b || d.best[key][b.f] === undefined) continue; x.fillStyle = '#5d564f'; x.fillText(`${this.label(key)}　${b.label} ${fmtOf(b, d.best[key][b.f])}`, 56, y); y += 32; } }
    if (worn.length) { y += 16; font(22, false); x.fillStyle = '#5d564f'; x.fillText('佩戴：' + worn.join('　'), 56, Math.min(y, H - 60)); }
    return c.toDataURL('image/png');
  },
};
Profile.onSwitch(() => { Records.data = null; });
