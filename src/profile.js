// 個人 ID：每個人的紀錄、故事星星、貼紙、徽章、名字、造型都掛在 ID 底下，一台裝置可以好幾個人輪流玩。
// ID 最多十碼英文數字，不分大小寫（存大寫）。沒輸入 ID 不能開始任何一局。
// 各模組的 localStorage 鍵用 Profile.key('story') 之類的取得（cnw-<ID>:story）；切換 ID 時每個模組的快取要清掉，用 onSwitch 登記。
export const Profile = {
  id: '', resets: [],
  load() { try { this.id = localStorage.getItem('cnw-id') || ''; } catch (e) { this.id = ''; } return this.id; },
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
      localStorage.setItem('cnw-id', id);
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
