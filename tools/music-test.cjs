// background music: nothing before the first click, the menu loop after it, the battle loop in a round, the boss loop while a teacher is up,
// M mutes and unmutes, silence on the result screen, the menu loop again back on the front page
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1100, height: 620 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8766/index.html?id=TEST&map=classroom', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.__game);
 const A = () => p.evaluate(() => { const s = window.__audio.musicState(); return [s.on, s.want, s.playing, s.step > 0]; });
 const s0 = await A(); await p.mouse.click(5, 5); await p.waitForTimeout(500); const s1 = await A();
 await p.evaluate(() => { const g = window.__game; g.start(); }); await p.waitForTimeout(700); const s2 = await A();
 await p.evaluate(() => { const g = window.__game; g.students.forEach(s => s.dispose()); g.students = []; g.bossPhase = true; g.spawnTeacher(window.__teachers[0]); }); await p.waitForTimeout(600); const s3 = await A();
 await p.keyboard.press('KeyM'); await p.waitForTimeout(200); const s4 = await A(); await p.keyboard.press('KeyM'); await p.waitForTimeout(300); const s5 = await A();
 await p.evaluate(() => { const g = window.__game; g.player.hp = 1; g.player.hurtCd = 0; g.player.hurt(); }); await p.waitForTimeout(400); const s6 = await A();
 await p.evaluate(() => window.__game.toMenu()); await p.waitForTimeout(400); const s7 = await A();
 console.log(JSON.stringify({ beforeClick: s0, menu: s1, battle: s2, boss: s3, mutedM: s4, unmuted: s5, over: s6, backToMenu: s7, label: await p.evaluate(() => document.getElementById('btn-music').textContent) })); console.log('ERRORS:', errs.length ? errs : 'none'); await b.close(); })().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
