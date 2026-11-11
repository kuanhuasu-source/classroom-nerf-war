// personal ID and records: a temporary id on a plain open (no gate), the result screen asks for a real one and the data moves, mode locks, ids keep separate data, a round is recorded with
// bests / totals / recent, the record note and sticker, the records page, the score card image, the moving code round trip and ?move= import
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } }); page.on('pageerror', e => errors.push(e.message));
  // legacy data from before ids, then a plain open: no gate, a temporary id owns the old data, the round can start at once
  await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cnw-story', JSON.stringify({ stars: { mon: 2 } })); localStorage.setItem('cnw-name', '小明'); });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const gate0 = await page.evaluate(() => ({ gate: !document.getElementById('idgate').hidden, news: !document.getElementById('news').hidden, id: localStorage.getItem('cnw-id'), temp: localStorage.getItem('cnw-temp') === localStorage.getItem('cnw-id'), tempShown: !document.getElementById('id-temp').hidden, btn: document.getElementById('btn-id-switch').textContent, migratedStars: window.__progress.stars('mon'), legacyGone: localStorage.getItem('cnw-story') === null }));
  await page.click('#btn-news-close');
  // one quick round on the temporary id: the result screen asks for a real id; naming it moves the data along
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); });
  const quick = () => page.evaluate(() => { const g = window.__game; g.setDifficulty('easy'); g.mapChoice = 'classroom'; g.start(); g.player.hp = 1; g.player.hurtCd = 0; g.player.hurt(); return g.state; });
  const q0 = await quick(); await page.waitForTimeout(300);
  const nudge0 = await page.evaluate(() => ({ state: window.__game.state, nudge: !document.getElementById('id-nudge').hidden, games: (JSON.parse(localStorage.getItem('cnw-' + localStorage.getItem('cnw-id') + ':records') || '{}').totals || {}).games }));
  const tempId = gate0.id;
  await page.click('#btn-id-nudge'); const gateTitle = await page.evaluate(() => [document.getElementById('id-title').textContent, document.getElementById('id-input').value]);
  await page.fill('#id-input', 'jason-06!'); await page.click('#btn-id-ok');
  const gate1 = await page.evaluate((tempId) => ({ gate: !document.getElementById('idgate').hidden, id: localStorage.getItem('cnw-id'), shown: document.getElementById('id-show').textContent, tempShown: !document.getElementById('id-temp').hidden, nudge: !document.getElementById('id-nudge').hidden, stars: window.__progress.stars('mon'), games: JSON.parse(localStorage.getItem('cnw-JASON06:records')).totals.games, oldKeysGone: Object.keys(localStorage).filter(k => k.startsWith('cnw-' + tempId + ':')).length === 0, known: JSON.parse(localStorage.getItem('cnw-ids')), name: window.__game.profile.name, nameBox: document.getElementById('my-name').value, storyNote: document.getElementById('story-note').textContent }), tempId);
  console.log('temp id', JSON.stringify({ before: gate0, q0, nudge0, gateTitle, after: gate1 }));
  await page.evaluate(() => window.__game.toMenu());
  // a second id on the same device starts empty; switching back brings the first one's data
  await page.click('#btn-id-switch'); await page.fill('#id-input', 'AMY'); await page.click('#btn-id-ok');
  const sw = await page.evaluate(() => ({ id: localStorage.getItem('cnw-id'), stars: window.__progress.stars('mon'), known: JSON.parse(localStorage.getItem('cnw-ids')), name: window.__game.profile.name }));
  await page.click('#btn-id-switch'); await page.click('#id-known button'); // the known-id chip applies at once
  const back = await page.evaluate(() => ({ id: localStorage.getItem('cnw-id'), stars: window.__progress.stars('mon'), name: window.__game.profile.name, gate: !document.getElementById('idgate').hidden }));
  // mode lock: a fresh id only has 下課大戰 until story Monday is cleared (or three rounds played)
  const locks = await page.evaluate(() => { const b = (m) => document.querySelector('.seg-btn[data-mode="' + m + '"]'); const out = { jason: [...document.querySelectorAll('.seg-btn[data-mode]')].map(x => x.classList.contains('locked')) }; return out; });
  await page.click('#btn-id-switch'); await page.fill('#id-input', 'NEWKID'); await page.click('#btn-id-ok');
  const locks2 = await page.evaluate(() => { document.getElementById('free-settings').open = true; const before = [...document.querySelectorAll('.seg-btn[data-mode]')].map(x => x.classList.contains('locked')); document.querySelector('.seg-btn[data-mode="siege"]').click(); return { before, modeAfterClick: window.__game.mode, note: document.getElementById('mode-note').textContent, summary: document.getElementById('free-summary').textContent }; });
  await page.click('#btn-id-switch'); await page.fill('#id-input', 'JASON06'); await page.click('#btn-id-ok');
  console.log('locks', JSON.stringify({ jason: locks.jason, newkid: locks2 }));
  console.log('switch', JSON.stringify({ amy: sw, back }));
  // win a quick round twice: the first is a baseline, the second breaks the score record
  const win = (bonus) => page.evaluate((bonus) => { const g = window.__game; g.setDifficulty('easy'); g.mapChoice = 'classroom'; g.start(); g.player.hurt = function () {}; g.diff = { ...g.diff, waves: [2] }; g.score += bonus;
    for (let i = 0; i < 400 && g.state === 'playing'; i++) { g.students.forEach(s => { if (s.alive) { s.hp = 1; s.hit(); } }); const t = g.teachers.find(t => !t.defeated); if (t && t.state !== 'enter') { const k = Object.keys(t.wp).find(k => t.wp[k].hp > 0); if (k) t.hitWeak(k); } for (let k = 0; k < 60; k++) { if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } g.step(1 / 60); } }
    return { state: g.state, score: g.score, playT: +g.playT.toFixed(1) }; }, bonus);
  const r1 = await win(0); await page.waitForTimeout(3300); const note1 = await page.evaluate(() => [document.getElementById('record-note').hidden, document.getElementById('record-note').textContent, window.__game.recordBroken]);
  await page.evaluate(() => window.__game.toMenu());
  const r2 = await win(5000); await page.waitForTimeout(3300); const note2 = await page.evaluate(() => [document.getElementById('record-note').hidden, document.getElementById('record-note').textContent, window.__ach.has('record')]);
  console.log('rounds', JSON.stringify({ r1, note1, r2, note2 }));
  const stored = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('cnw-JASON06:records')); return { totals: d.totals, bestKeys: Object.keys(d.best), best: d.best, recent: d.recent.map(r => [r.mode, r.level, r.map, r.win, r.score]) }; });
  console.log('stored', JSON.stringify(stored));
  // this round's card, then the records page and the total card
  await page.click('#btn-card-over'); const card1 = await page.evaluate(() => ({ open: !document.getElementById('cardview').hidden, len: document.getElementById('card-img').src.length, dl: document.getElementById('card-dl').download }));
  await page.screenshot({ path: 'records-card.png' }); await page.click('#btn-card-close');
  await page.evaluate(() => window.__game.toMenu()); await page.click('#btn-records');
  const pageInfo = await page.evaluate(() => ({ open: !document.getElementById('records').hidden, id: document.getElementById('rec-id').textContent, totals: [...document.querySelectorAll('#rec-totals div')].map(d => d.textContent).slice(0, 5), best: [...document.querySelectorAll('#rec-best .rec-row')].map(r => r.textContent), recent: document.querySelectorAll('#rec-recent .rec-row').length }));
  await page.screenshot({ path: 'records-page.png' });
  await page.click('#btn-rec-card'); const card2 = await page.evaluate(() => document.getElementById('card-img').src.length); await page.click('#btn-card-close');
  console.log('card+page', JSON.stringify({ card1, card2, pageInfo }));
  // moving code: export here, import into a fresh browser context through the ?move= link and through the paste box
  await page.click('#btn-rec-move'); await page.waitForFunction(() => document.getElementById('move-code').value.length > 10); // the records page is still open behind the card
  const mv = await page.evaluate(() => ({ code: document.getElementById('move-code').value, qr: !document.getElementById('qr-move-wrap').hidden, note: document.getElementById('move-note').textContent }));
  console.log('move code', JSON.stringify({ len: mv.code.length, kind: mv.code[0], qr: mv.qr, note: mv.note }));
  const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push('p2 ' + e.message)); p2.on('dialog', d => d.accept());
  await p2.goto('http://localhost:8766/index.html?move=' + mv.code, { waitUntil: 'networkidle' }); await p2.waitForFunction(() => window.__game, null, { timeout: 30000 }); await p2.waitForTimeout(500);
  const imp = await p2.evaluate(() => ({ id: localStorage.getItem('cnw-id'), gate: !document.getElementById('idgate').hidden, stars: window.__progress.stars('mon'), games: JSON.parse(localStorage.getItem('cnw-JASON06:records') || '{}').totals, url: location.search, name: window.__game.profile.name }));
  console.log('import via link', JSON.stringify(imp));
  const ctx3 = await browser.newContext(); const p3 = await ctx3.newPage(); p3.on('pageerror', e => errors.push('p3 ' + e.message)); p3.on('dialog', d => d.accept());
  await p3.goto('http://localhost:8766/index.html?id=OTHER', { waitUntil: 'networkidle' }); await p3.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await p3.evaluate(() => { document.getElementById('news').hidden = true; }); await p3.click('#btn-records'); await p3.click('#btn-rec-move'); await p3.fill('#move-in', mv.code); await p3.click('#btn-move-in'); await p3.waitForTimeout(400);
  const imp2 = await p3.evaluate(() => ({ id: localStorage.getItem('cnw-id'), status: document.getElementById('move-status').textContent, stars: window.__progress.stars('mon') }));
  console.log('import via paste', JSON.stringify(imp2));
  // a room link joins at once on a temporary id (no gate in the way)
  const ctx4 = await browser.newContext(); const p4 = await ctx4.newPage(); p4.on('pageerror', e => errors.push('p4 ' + e.message));
  await p4.goto('http://localhost:8766/index.html?room=ABCD', { waitUntil: 'networkidle' }); await p4.waitForFunction(() => window.__game, null, { timeout: 30000 }); await p4.waitForTimeout(600);
  const room0 = { }, room1 = await p4.evaluate(() => ({ gate: !document.getElementById('idgate').hidden, joinOpen: !document.getElementById('lobby').hidden, code: document.getElementById('join-code').value, id: localStorage.getItem('cnw-id') }));
  console.log('room link', JSON.stringify({ before: room0, after: room1 }));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
