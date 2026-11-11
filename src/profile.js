// 個人 ID：每個人的紀錄、故事星星、貼紙、徽章、名字、造型都掛在 ID 底下，一台裝置可以好幾個人輪流玩。
// ID 最多十碼英文數字，不分大小寫（存大寫）。第一次來不擋：先給一個暫時的 ID（KID 加四碼數字），打完一局再請他取名，
// 取名時把暫時 ID 底下的資料整包搬到新 ID（rename）。
// 各模組的 localStorage 鍵用 Profile.key('story') 之類的取得（cnw-<ID>:story）；切換 ID 時每個模組的快取要清掉，用 onSwitch 登記。
export const Profile = {
  id: '', temp: false, resets: [],
  load() { try { this.id = localStorage.getItem('cnw-id') || ''; this.temp = !!this.id && localStorage.getItem('cnw-temp') === this.id; } catch (e) { this.id = ''; this.temp = false; } return this.id; },
  // at startup: ?id=XYZ sets it (test and debug links); otherwise a first-time visitor gets a temporary id. The fake-link test pages (?role=) keep no id at all.
  boot(search = location.search) {
    this.load(); const q = new URLSearchParams(search), qid = this.clean(q.get('id') || '');
    if (qid && this.valid(qid)) { if (qid !== this.id) this.set(qid); return; }
    if (!this.id && !q.get('role')) this.ensure();
  },
  ensure() {
    if (this.id) return this.id;
    const known = this.known(); let id; do { id = 'KID' + String(Math.floor(1000 + Math.random() * 9000)); } while (known.includes(id));
    try { localStorage.setItem('cnw-temp', id); } catch (e) { /* ignore */ }
    this.set(id); return id;
  },
  hasData(id) { try { return ['story', 'ach', 'badges', 'records'].some(n => localStorage.getItem(`cnw-${id}:${n}`) !== null); } catch (e) { return false; } },
  // the temporary id gets a real name: its data moves along. An id that already has data on this device is only switched to (nothing is overwritten).
  rename(newId) {
    newId = this.clean(newId); if (!this.valid(newId)) return false;
    const old = this.id;
    if (old && old !== newId && !this.hasData(newId)) {
      try {
        for (const name of ['story', 'ach', 'badges', 'records', 'name', 'look']) { const v = localStorage.getItem(`cnw-${old}:${name}`); if (v !== null) { if (name === 'name' && JSON.parse(v) === old) { localStorage.removeItem(`cnw-${old}:${name}`); continue; } localStorage.setItem(`cnw-${newId}:${name}`, v); localStorage.removeItem(`cnw-${old}:${name}`); } }
        localStorage.setItem('cnw-ids', JSON.stringify(this.known().filter(x => x !== old)));
      } catch (e) { /* ignore */ }
    }
    try { if (localStorage.getItem('cnw-temp') === old) localStorage.removeItem('cnw-temp'); } catch (e) { /* ignore */ }
    return this.set(newId);
  },
  clean(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); },
  valid(s) { return /^[A-Z0-9]{1,10}$/.test(s); },
  key(name) { return `cnw-${this.id}:${name}`; },
  get(name) { try { return JSON.parse(localStorage.getItem(this.key(name)) || 'null'); } catch (e) { return null; } },
  put(name, obj) { try { localStorage.setItem(this.key(name), JSON.stringify(obj)); } catch (e) { /* ignore */ } },
  // ids that have played on this device, newest first
  known() { try { return JSON.parse(localStorage.getItem('cnw-ids') || '[]'); } catch (e) { return []; } },
  onSwitch(fn) { this.resets.push(fn); },
  // make an id the current one; data from before ids existed (cnw-story / cnw-ach / cnw-badges / cnw-name / cnw-look) goes to the first id that ever logs in
  set(id) {
    id = this.clean(id); if (!this.valid(id)) return false;
    this.id = id;
    try {
      localStorage.setItem('cnw-id', id); this.temp = localStorage.getItem('cnw-temp') === id;
      const ids = this.known().filter(x => x !== id); ids.unshift(id); localStorage.setItem('cnw-ids', JSON.stringify(ids.slice(0, 20)));
      for (const [legacy, name] of [['cnw-story', 'story'], ['cnw-ach', 'ach'], ['cnw-badges', 'badges'], ['cnw-name', 'name'], ['cnw-look', 'look']]) {
        const v = localStorage.getItem(legacy); if (v === null) continue;
        if (localStorage.getItem(this.key(name)) === null) localStorage.setItem(this.key(name), name === 'name' || name === 'look' ? JSON.stringify(v) : v);
        localStorage.removeItem(legacy);
      }
    } catch (e) { /* ignore */ }
    for (const fn of this.resets) fn();
    return true;
  },
  // everything this id owns, for the moving code
  dump() { const out = { v: 1, id: this.id }; for (const name of ['story', 'ach', 'badges', 'records', 'name', 'look']) { const v = this.get(name); if (v !== null) out[name] = v; } return out; },
  restore(d) { if (!d || !this.valid(this.clean(d.id))) return false; const keep = this.id; this.id = this.clean(d.id); for (const name of ['story', 'ach', 'badges', 'records', 'name', 'look']) if (d[name] !== undefined) this.put(name, d[name]); this.id = keep; return this.set(this.clean(d.id)); },
};
