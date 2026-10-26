// story mode: menu → chapter list → diary → chapter 1 with its own waves/teacher/look → win → stars, sticker, next chapter; toilet time override; solo lunch with AI 小美
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto('http://localhost:8766/index.html?id=TEST', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { const n = document.getElementById('news'); if (n) n.hidden = true; }); // the what's-new card would sit over the menu buttons
  await page.evaluate(() => { localStorage.removeItem('cnw-TEST:story'); localStorage.removeItem('cnw-TEST:ach'); window.__game.renderer.setAnimationLoop(null); });
  await page.click('#btn-story'); await page.waitForTimeout(100);
  const list = await page.evaluate(() => [...document.querySelectorAll('#story-list .chapter')].map(b => [b.querySelector('.day').textContent, b.disabled, b.querySelector('.stars').textContent]));
  console.log('chapters', JSON.stringify(list));
  await page.screenshot({ path: 'story-list.png' });
  await page.click('#story-list .chapter'); await page.waitForTimeout(100);
  console.log('diary', JSON.stringify(await page.evaluate(() => [document.getElementById('diary-title').textContent, document.getElementById('diary-text').textContent.slice(0, 20), document.getElementById('diary-goal').textContent.slice(0, 20)])));
  await page.screenshot({ path: 'story-diary.png' });
  await page.click('#btn-diary-go'); await page.waitForTimeout(200);
  const s0 = await page.evaluate(() => { const g = window.__game; return { state: g.state, story: g.story && g.story.id, level: g.level, map: g.world.layout.id, waves: g.diff.waves, teacher: g.forceTeacher, name: g.profile.name, look: g.profile.look, skinCap: !!g.mySkin().v.cap }; });
  console.log('chapter 1 start', JSON.stringify(s0));
  // play it through like the solo test: knock out kids each second, then the teacher's weak points; the player never dies
  const r = await page.evaluate(() => { const g = window.__game; g.player.hurt = function () {}; let hint = ''; const ob = g.ui.buddy.bind(g.ui); g.ui.buddy = (t, s) => { hint += t + '|'; ob(t, s); };
    for (let i = 0; i < 600 && g.state === 'playing'; i++) { g.students.forEach(s => { if (s.alive) { s.hp = 1; s.hit(); g.player.shots += 2; g.player.hits += 1; } }); const t = g.teachers.find(t => !t.defeated); if (t && t.state !== 'enter') { const k = Object.keys(t.wp).find(k => t.wp[k].hp > 0); if (k) t.hitWeak(k); } for (let k = 0; k < 60; k++) { if (g.state === 'upgrade' || g.ui.offerOpen) { const b = document.querySelector('#upgrade-cards button'); if (b) g.pickUpgrade(b.dataset.id); } g.step(1 / 60); g.ui.tick(1 / 60); } }
    return { state: g.state, wave: g.wave, teacher: g.teachers[0] && g.teachers[0].def.id, stars: g.storyStars, saved: JSON.parse(localStorage.getItem('cnw-TEST:story')), ach: Object.keys(JSON.parse(localStorage.getItem('cnw-TEST:ach') || '{}').unlocked || {}), hints: hint, toast: document.getElementById('ach-toast-name').textContent }; });
  console.log('chapter 1 end', JSON.stringify(r));
  await page.waitForTimeout(3500);
  console.log('over card', JSON.stringify(await page.evaluate(() => [document.getElementById('over').hidden, document.getElementById('over-sub').textContent, document.getElementById('btn-next').hidden, document.getElementById('btn-next').textContent, document.getElementById('btn-again').textContent])));
  await page.screenshot({ path: 'story-over.png' });
  await page.click('#btn-next'); await page.waitForTimeout(200);
  console.log('next diary', JSON.stringify(await page.evaluate(() => [document.getElementById('diary').hidden, document.getElementById('diary-day').textContent, document.getElementById('diary-title').textContent, window.__game.profile.name, window.__game.level, window.__game.mode])));
  // chapter 2 (toilet) time override
  await page.click('#btn-diary-go'); await page.waitForTimeout(200);
  console.log('chapter 2', JSON.stringify(await page.evaluate(() => { const g = window.__game; return { mode: g.mode, map: g.world.layout.id, time: g.timeLeft, hud: document.getElementById('time').textContent, hp: g.player.maxHp }; })));
  // chapter 4 (lunch, solo with AI 小美): jump straight in
  await page.evaluate(() => { const g = window.__game; g.toMenu(); });
  await page.evaluate(() => { const g = window.__game; g.startStory({ id: 'thu', day: '星期四', weather: '☀️', title: '午餐大作戰', mode: 'lunch', level: 'normal', diary: [''], goal: '', hints: { start: 'hi', back: 'bye' }, end: 'ok' }); });
  const l0 = await page.evaluate(() => { const g = window.__game, L = g.lunchMode; return { state: g.state, ai: L && L.ai, buddy: !!(L && L.buddy), driver: L && L.driver, shooter: L && L.shooterSlot(), role: document.getElementById('wave').textContent }; });
  console.log('lunch solo start', JSON.stringify(l0));
  // drive out with keys (scripted steering on the host), AI shoots; then AI drives back while the player (scripted) shoots
  const drive = await page.evaluate(() => { const g = window.__game, L = g.lunchMode, c = L.cart; g.player.hurt = function () {}; if (g.state === 'paused') g.resume(); g.pause = () => {}; // a stray pointer-lock exit from the previous chapter must not pause the scripted run
    const steer = (tx, tz, stop) => { const dx = tx - c.pos.x, dz = tz - c.pos.z, dist = Math.hypot(dx, dz); let err = Math.atan2(dz, dx) - c.heading; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI; g.player.keys = {}; if (err > 0.08) g.player.keys.KeyD = true; else if (err < -0.08) g.player.keys.KeyA = true; if (stop && dist < 3) { if (c.v > 0.4) g.player.keys.KeyS = true; } else if (Math.abs(err) < 1.1) g.player.keys.KeyW = true; return dist; };
    const route = [[7, -11.2], [12, -9.2], [12, 10.6]]; let wp = 0, t = 0, log = [];
    while (t < 60 && L.phase === 'out') { const last = wp === route.length - 1, d = steer(route[wp][0], route[wp][1], last); if (d < 1.3 && (!last || Math.abs(c.v) < 0.3)) { wp++; if (wp >= route.length) { g.player.keys = {}; break; } } for (let k = 0; k < 6; k++) g.step(1 / 60); t += 0.1; }
    g.player.keys = {}; while (t < 90 && L.phase === 'out') { if (g.state !== 'playing') break; for (let k = 0; k < 6; k++) g.step(1 / 60); t += 0.1; }
    log.push(['loaded at', t.toFixed(1), L.phase, L.driver, L.shooterSlot(), 'kills so far', L.kills]);
    // back: 小美 drives; Jason (scripted) shoots the nearest kid every 0.3 s
    let st = 0; while (t < 220 && g.state === 'playing') { st += 0.1; if (st >= 0.3) { st = 0; const from = c.pose('shooter'); from.y += 1.2; let best = null, bd = 12; for (const k of L.kids) { if (!k.alive || !k.group.visible) continue; const to = new (g.player.pos.constructor)(k.group.position.x, k.group.position.y + 0.8, k.group.position.z); const d = from.distanceTo(to); if (d < bd && !g.world.segmentBlocked(from, to)) { bd = d; best = to; } } if (best) { const dir = best.clone().sub(from); dir.y += bd * bd * 6 / 2048; dir.normalize(); const d = g.darts.fire(from, dir, 32, 'player'); d.who = 'host'; } } for (let k = 0; k < 6; k++) g.step(1 / 60); t += 0.1; if (Math.round(t * 10) % 100 === 0) log.push(['t', t.toFixed(0), 'cart', +c.pos.x.toFixed(1), +c.pos.z.toFixed(1), 'soup', Math.round(c.soup)]); }
    return { log, state: g.state, soup: Math.round(c.soup), stars: g.storyStars, title: g.overInfo && g.overInfo.title, t: +t.toFixed(0) }; });
  console.log('lunch solo', JSON.stringify(drive));
  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
