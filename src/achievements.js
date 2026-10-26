import { $ } from './ui.js';
import { Audio } from './audio.js';

// 成就貼紙簿：25 張貼紙。解鎖與累計計數都存在瀏覽器；解鎖時右下角跳一張貼紙。
export const ACH = [
  // 通用
  { id: 'first_win', icon: '🔔', name: '第一次下課', hint: '任何玩法贏一局' },
  { id: 'sharp', icon: '🎯', name: '百發百中', hint: '一局至少 30 發、命中率 50% 以上' },
  { id: 'untouched', icon: '🛡️', name: '毫髮無傷', hint: '一局沒掉過血就贏' },
  { id: 'milk5', icon: '🥛', name: '牛奶控', hint: '累計喝 5 杯鮮奶', counter: 'milk', goal: 5 },
  { id: 'scavenger', icon: '🧹', name: '撿破爛達人', hint: '累計撿起 300 發地上的泡棉彈', counter: 'darts', goal: 300 },
  { id: 'kills500', icon: '😈', name: '同學們的惡夢', hint: '累計打倒 500 個同學', counter: 'kills', goal: 500 },
  // 下課大戰
  { id: 'teachers4', icon: '🍎', name: '全科制霸', hint: '數學、體育、音樂、自然老師都打倒過' },
  { id: 'dean', icon: '📢', name: '主任，再見', hint: '打倒教務主任' },
  { id: 'principal', icon: '🏆', name: '校長，再見', hint: '打倒校長' },
  { id: 'committee', icon: '📝', name: '會考狀元', hint: '打倒會考委員會三人組' },
  { id: 'exam_win', icon: '💯', name: '會考過關', hint: '會考難度贏一局下課大戰' },
  { id: 'no_dust', icon: '🌪️', name: '板擦閃避王', hint: '老師階段沒被粉筆灰罩到就贏' },
  // 守校門
  { id: 'siege_win', icon: '🚧', name: '守門員', hint: '守校門守住全部波次' },
  { id: 'crown', icon: '👑', name: '摘皇冠', hint: '惡霸大王的皇冠第一個被打掉' },
  { id: 'siege_fast', icon: '⚡', name: '速戰速決', hint: '惡霸老大進場 20 秒內倒下' },
  // 搶廁所
  { id: 'toilet_win', icon: '🚽', name: '來得及', hint: '搶到廁所' },
  { id: 'dry', icon: '☂️', name: '乾爽', hint: '沒被潑到水就搶到廁所' },
  { id: 'cans_fast', icon: '🥫', name: '神射手', hint: '60 秒內射破全部罐子' },
  // 午餐大作戰
  { id: 'lunch3', icon: '🍛', name: '全班吃飽', hint: '午餐大作戰三顆星' },
  { id: 'no_bump', icon: '🛒', name: '平穩駕駛', hint: '回程沒撞到牆也沒撞倒水桶' },
  { id: 'horn5', icon: '📯', name: '叭叭王', hint: '一趟按喇叭嚇到人五次' },
  // 故事
  { id: 'grad', icon: '🎓', name: '畢業快樂', hint: '破完故事模式' },
  { id: 'all3', icon: '🌟', name: '全勤優等', hint: '故事每一章都三顆星' },
  { id: 'secret', icon: '🎤', name: '校長的對手', hint: '打贏隱藏章「校長親自出馬」' },
  // 徽章
  { id: 'hall', icon: '🏛️', name: '校園名人堂', hint: '第一次湊到徽章套裝' },
];
export const achById = (id) => ACH.find(a => a.id === id);

export const Ach = {
  data: null, queue: [], showing: false,
  load() { if (this.data) return this.data; try { this.data = JSON.parse(localStorage.getItem('cnw-ach') || 'null') || {}; } catch (e) { this.data = {}; } this.data.unlocked = this.data.unlocked || {}; this.data.counters = this.data.counters || {}; this.data.teachers = this.data.teachers || {}; return this.data; },
  save() { try { localStorage.setItem('cnw-ach', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
  has(id) { return !!this.load().unlocked[id]; },
  count() { return Object.keys(this.load().unlocked).length; },
  unlock(id) {
    const a = achById(id); if (!a || this.has(id)) return false;
    this.load().unlocked[id] = Date.now(); this.save(); this.queue.push(a); this.pump(); return true;
  },
  // cumulative counters with a threshold sticker
  add(counter, n = 1) { const d = this.load(); d.counters[counter] = (d.counters[counter] || 0) + n; this.save(); for (const a of ACH) if (a.counter === counter && d.counters[counter] >= a.goal) this.unlock(a.id); },
  teacher(id) { const d = this.load(); d.teachers[id] = 1; this.save(); if (['math', 'pe', 'music', 'science'].every(k => d.teachers[k])) this.unlock('teachers4'); },
  pump() {
    if (this.showing || !this.queue.length) return;
    const a = this.queue.shift(), el = $('ach-toast'); if (!el) return;
    this.showing = true; $('ach-toast-icon').textContent = a.icon; $('ach-toast-name').textContent = a.name; el.classList.add('on'); Audio.item();
    setTimeout(() => { el.classList.remove('on'); setTimeout(() => { this.showing = false; this.pump(); }, 400); }, 3200);
  },
  renderBook() {
    const grid = $('sticker-grid'); if (!grid) return; grid.innerHTML = '';
    const d = this.load();
    for (const a of ACH) {
      const got = !!d.unlocked[a.id], cell = document.createElement('div'); cell.className = 'sticker-cell' + (got ? ' got' : '');
      const prog = a.counter && !got ? ` ${Math.min(a.goal, d.counters[a.counter] || 0)}/${a.goal}` : '';
      cell.innerHTML = `<span class="icon"></span><b></b><small></small>`; cell.querySelector('.icon').textContent = got ? a.icon : '❔'; cell.querySelector('b').textContent = a.name; cell.querySelector('small').textContent = a.hint + prog;
      grid.appendChild(cell);
    }
    $('sticker-count').textContent = `${this.count()} / ${ACH.length}`;
  },
  reset() { this.data = { unlocked: {}, counters: {}, teachers: {} }; this.save(); },
};
