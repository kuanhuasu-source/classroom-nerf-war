// Gun and kid upgrades, offered three at a time after each cleared wave.
// Each player keeps an `up` record; `apply` mutates it. `max` is how many times one can be taken.
export const UPGRADES = [
  { id: 'mag', name: '大彈匣', desc: '彈匣 +5 發', max: 3, apply: (u) => { u.magBonus += 5; } },
  { id: 'reload', name: '快速換彈', desc: '換彈快 30%', max: 2, apply: (u) => { u.reloadMul *= 0.7; } },
  { id: 'rapid', name: '連發扳機', desc: '射速快 30%', max: 2, apply: (u) => { u.fireMul *= 0.7; } },
  { id: 'twin', name: '雙管泡棉槍', desc: '一次射出兩發，只耗一發', max: 1, apply: (u) => { u.twin = true; } },
  { id: 'spring', name: '強力彈簧', desc: '彈速 +25%，飛得更直', max: 2, apply: (u) => { u.speedMul *= 1.25; } },
  { id: 'magnet', name: '磁鐵手套', desc: '撿彈範圍加倍', max: 1, apply: (u) => { u.pickupMul *= 2; } },
  { id: 'bag', name: '大書包', desc: '備用彈上限 +30，立刻補 20 發', max: 2, apply: (u) => { u.reserveBonus += 30; u.refill += 20; } },
  { id: 'recycle', name: '環保回收', desc: '20% 機率射擊不耗彈', max: 2, apply: (u) => { u.recycle += 0.2; } },
  { id: 'goggles', name: '游泳蛙鏡', desc: '更難被打中（判定縮小 15%）', max: 2, apply: (u) => { u.dodge += 0.15; } },
  { id: 'heart', name: '媽媽的便當', desc: '最大血量 +1 並回滿', max: 2, apply: (u) => { u.maxHpBonus += 1; u.healFull = true; } },
];
export const freshUp = () => ({ magBonus: 0, reloadMul: 1, fireMul: 1, twin: false, speedMul: 1, pickupMul: 1, reserveBonus: 0, refill: 0, recycle: 0, dodge: 0, maxHpBonus: 0, healFull: false, taken: {} });
export const byId = (id) => UPGRADES.find(u => u.id === id);
// three random upgrades this player can still take
export function offerFor(up) {
  const pool = UPGRADES.filter(u => (up.taken[u.id] || 0) < u.max);
  const out = [];
  while (out.length < 3 && pool.length) { const i = Math.floor(Math.random() * pool.length); out.push(pool.splice(i, 1)[0].id); }
  return out;
}
export function takeUpgrade(up, id) {
  const u = byId(id); if (!u) return null;
  up.taken[id] = (up.taken[id] || 0) + 1; u.apply(up); return u;
}
