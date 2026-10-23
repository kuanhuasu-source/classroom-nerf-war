// The exam committee: three bosses on the hall stage, their specials, the joint bell, overtime, and the win
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8766/index.html?map=hall&teacher=committee', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { const g = window.__game; g.setDifficulty('hard'); g.renderer.setAnimationLoop(null); g.start(); window.__msgs = []; const om = g.message.bind(g); g.message = (a, b, t) => { window.__msgs.push(a); om(a, b, t); }; });
  const E = (fn, a) => page.evaluate(fn, a);
  const step = (s) => E((s) => { const g = window.__game; for (let i = 0; i < Math.round(s * 60); i++) { g.step(1 / 60); g.ui.tick(1 / 60); } }, s);
  // skip the waves: straight to the boss
  await E(() => { const g = window.__game; g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = []; g.wave = 6; g.bossPhase = true; g.spawnTeacher(); g.player.hurt = function () { if (this.hurtCd > 0) return; this.hurtCd = 0.7; window.__hurts = (window.__hurts || 0) + 1; }; });
  await step(12);
  console.log('bosses:', await E(() => window.__game.teachers.map(t => [t.def.id, t.state, +t.group.position.x.toFixed(1), +t.group.position.y.toFixed(1), +t.group.position.z.toFixed(1), Object.keys(t.wp).map(k => t.wp[k].hp).join('/')])));
  await E(() => { const g = window.__game; g.player.pos.set(0, 0, -1.0); g.player.yaw = 0; g.player.pitch = 0.1; g.player.update(1 / 60); g.renderer.render(g.scene, g.camera); });
  await page.screenshot({ path: 'committee.png' });
  console.log('hud:', await E(() => [document.getElementById('hud-boss').classList.contains('many'), document.getElementById('hud-boss').textContent.replace(/\s+/g, ' ').trim(), document.getElementById('left').textContent]));
  // keep the player alive and standing in the open so every special fires
  await E(() => { const g = window.__game; g.player.pos.set(0, 0, 1.0); });
  await step(45);
  const msgs = await E(() => window.__msgs);
  const has = (k) => msgs.some(m => m.includes(k));
  console.log('specials seen: 收卷', has('收卷！'), '| 盯上', has('盯上'), '| 不及格', has('不及格'), '| 鐘響', has('鐘響收卷'), '| hurts:', await E(() => window.__hurts || 0), '| zones fail:', await E(() => window.__game.zones.filter(z => z.kind === 'fail').length), '| planes in flight ever:', await E(() => window.__game.darts.seq));
  // collect: shooting during the hold costs a heart
  await E(() => { const g = window.__game; const chief = g.teachers.find(t => t.def.id === 'chief'); chief.special = null; chief.startSpecial(g.player, 'collect'); for (let i = 0; i < 300 && !(chief.special && chief.special.phase === 'hold'); i++) g.step(1 / 60); });
  const slow = await E(() => [window.__game.worldSlow(), window.__game.teachers[0].special && window.__game.teachers[0].special.phase]);
  await E(() => { window.__game.player.shots += 1; }); await step(0.3);
  console.log('collect: slow-mo', slow, '| punished for firing:', await E(() => window.__msgs.some(m => m.includes('記一筆'))));
  await step(3);
  // overtime: knock out the chief, the others speed up; then everyone -> win
  await E(() => { const g = window.__game; const chief = g.teachers.find(t => t.def.id === 'chief'); for (const k of Object.keys(chief.wp)) while (chief.wp[k].hp > 0 && !chief.defeated) chief.hitWeak(k); });
  console.log('after chief down:', await E(() => window.__game.teachers.map(t => [t.def.id, t.defeated, t.overtime, t.alone, t.flags.mood])), '| state', await E(() => window.__game.state), '| msg:', await E(() => window.__msgs.filter(m => m.includes('崩潰')).join(' ')));
  await E(() => { const g = window.__game; const t = g.teachers.find(x => x.def.id === 'timer'); for (const k of Object.keys(t.wp)) while (t.wp[k].hp > 0 && !t.defeated) t.hitWeak(k); });
  console.log('after timer down: stamper alone?', await E(() => window.__game.teachers.map(t => [t.def.id, t.defeated, t.alone])));
  await step(6);
  console.log('stamper chasing (left the stage?):', await E(() => { const t = window.__game.teachers.find(x => x.def.id === 'stamper'); return [+t.group.position.y.toFixed(1), +t.group.position.z.toFixed(1), t.path.length]; }));
  await E(() => { const g = window.__game; const t = g.teachers.find(x => x.def.id === 'stamper'); for (const k of Object.keys(t.wp)) while (t.wp[k].hp > 0 && !t.defeated) t.hitWeak(k); });
  console.log('win:', await E(() => [window.__game.state, window.__game.bossName, window.__msgs.slice(-2)]));
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
