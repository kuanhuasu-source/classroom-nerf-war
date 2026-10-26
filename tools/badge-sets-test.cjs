// badge sets: legend names, the third slot, each set's bonus in play, the news popup shown once, the hall-of-fame sticker
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' }); // a plain open: the news popup only shows without query params
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  // news: open on a fresh browser, closed stays closed after a reload
  const news1 = await page.evaluate(() => !document.getElementById('news').hidden);
  await page.screenshot({ path: 'news.png' });
  await page.click('#btn-news-close');
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const news2 = await page.evaluate(() => !document.getElementById('news').hidden);
  console.log('news', JSON.stringify({ firstVisit: news1, afterClose: news2 }));
  await page.goto('http://localhost:8766/index.html?map=classroom', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('cnw-badges'); localStorage.removeItem('cnw-story'); localStorage.removeItem('cnw-ach'); window.__badges.data = null; window.__progress.data = null; window.__ach.data = null; window.__game.renderer.setAnimationLoop(null); });
  const r = await page.evaluate(() => { const g = window.__game, B = window.__badges, P = window.__progress, A = window.__ach, out = {};
    out.labels = [B.label({ type: 'hp', tier: 3 }), B.label({ type: 'rate', tier: 0 }), B.name({ type: 'speed', tier: 2 })];
    // slots: 1 → 2 after the story → 3 with three stars everywhere, or 12 stickers
    const stars = (n) => { P.data = null; localStorage.setItem('cnw-story', JSON.stringify({ stars: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri_am', 'fri_pm'].map(id => [id, n])) })); };
    out.slots = [g.badgeSlots()]; stars(1); out.slots.push(g.badgeSlots()); stars(3); out.slots.push(g.badgeSlots());
    stars(1); A.data = null; localStorage.setItem('cnw-ach', JSON.stringify({ unlocked: Object.fromEntries(['first_win', 'sharp', 'untouched', 'milk5', 'scavenger', 'kills500', 'teachers4', 'dean', 'principal', 'committee', 'exam_win', 'no_dust'].map(id => [id, 1])), counters: {}, teachers: {} })); out.slots.push(g.badgeSlots());
    stars(3); A.data = null; localStorage.removeItem('cnw-ach');
    const wear = (...specs) => { const d = B.load(); d.list = d.list.filter(b => b.src !== 'test'); d.worn = []; for (const [type, tier, val] of specs) { const b = { id: 'T' + type, type, tier, val, ts: Date.now(), src: 'test' }; d.list.push(b); d.worn.push(b.id); } B.save(); };
    // sets found and their flags
    wear(['rate', 2, 0.15], ['multi', 2, 1]); out.dodge = [B.activeSets().map(s => s.id), B.effects().spreadMul];
    wear(['hp', 0, 1], ['regenHp', 1, 40]); out.nurse = [B.activeSets().map(s => s.id), B.effects().invulnBonus];
    wear(['regenAmmo', 1, 25], ['regenHp', 1, 40]); const e = B.effects(); out.duty = [e.sets, e.regenHp, e.regenAmmo];
    wear(['hp', 2, 2], ['rate', 2, 0.15], ['speed', 2, 0.08]); out.gradAndPe = [B.activeSets().map(s => s.id)];
    wear(['hp', 1, 1], ['rate', 2, 0.15], ['speed', 2, 0.08]); out.notGrad = B.activeSets().map(s => s.id);
    wear(['hp', 0, 1]); out.none = B.activeSets().length;
    // in play: reload 30% faster (shop), crouch at walking speed (pe), bell rush on wave start (late), start sprint (grad)
    g.setDifficulty('normal');
    wear(['mag', 0, 2]); g.toMenu(); g.start(); g.player.ammo = 0; g.player.reload(); const base = g.player.reloadTotal;
    wear(['mag', 0, 2], ['regenAmmo', 1, 25]); g.toMenu(); g.start(); g.player.ammo = 0; g.player.reload(); out.shopReload = +(g.player.reloadTotal / base).toFixed(2);
    const crouchDist = () => { g.player.keys = { KeyW: true, KeyC: true }; g.player.pos.set(0, 0, 3); g.player.yaw = 0; const a = g.player.pos.clone(); for (let i = 0; i < 60; i++) g.player.update(1 / 60); g.player.keys = {}; return +g.player.pos.distanceTo(a).toFixed(2); };
    wear(['speed', 1, 0.05]); g.toMenu(); g.start(); const c0 = crouchDist();
    wear(['speed', 1, 0.05], ['hp', 0, 1]); g.toMenu(); g.start(); out.peCrouch = [c0, crouchDist()];
    wear(['speed', 1, 0.05], ['rate', 0, 0.06]); g.toMenu(); g.start(); for (let i = 0; i < 60 * 6 && !g.buffs.host; i++) g.step(1 / 60); out.lateRush = g.buffs.host && [g.buffs.host.id, g.buffs.host.name, g.wave];
    wear(['hp', 2, 2], ['rate', 2, 0.15], ['speed', 2, 0.08]); g.toMenu(); g.start(); out.gradStart = g.buffs.host && [g.buffs.host.id, g.buffs.host.name, g.buffs.host.t, document.getElementById('hud-badge').textContent];
    // hurt protection with the nurse set
    wear(['hp', 0, 1], ['regenHp', 1, 40]); g.toMenu(); g.start(); g.player.hurtCd = 0; g.player.hurt(); out.nurseHurtCd = g.player.hurtCd;
    // the sticker comes with the first set worn through the panel
    A.data = null; localStorage.removeItem('cnw-ach'); wear(['hp', 0, 1]); const d = B.load(); d.list.push({ id: 'Tregen', type: 'regenHp', tier: 1, val: 40, ts: 1, src: 'test' }); B.save(); B.wear('Tregen', 3); out.hallSticker = A.has('hall');
    // the panel lists seven sets with one done
    g.toMenu(); B.render(3, () => {}); out.panel = [document.querySelectorAll('#badge-sets .bset').length, document.querySelectorAll('#badge-sets .bset.on').length, document.querySelector('#badge-sets .bset.on b').textContent];
    // the draw card says what wearing it would complete
    B.showDraw({ id: 'x', type: 'regenAmmo', tier: 1, val: 25, ts: 2, src: 'test' }, null, 3, () => {}); out.drawNote = document.getElementById('badge-card-note').textContent;
    return out; });
  console.log(JSON.stringify(r, null, 1));
  await page.evaluate(() => { document.getElementById('badges').hidden = false; }); await page.screenshot({ path: 'badge-panel.png' });
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
