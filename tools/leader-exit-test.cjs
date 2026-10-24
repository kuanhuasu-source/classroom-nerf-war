const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?map=classroom', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  console.log(JSON.stringify(await page.evaluate(() => { const g = window.__game; g.renderer.setAnimationLoop(null); g.start();
    for (let i = 0; i < 60 * 14; i++) g.step(1 / 60); // wave 1 in, leader last
    const leader = g.students.find(s => s.leader), other = g.students.find(s => !s.leader && s.alive); const out = { leaderIn: !!leader, total: g.students.length, occupiedBefore: g.world.desks.filter(d => d.occupant).length };
    leader.hp = 1; leader.hit(); other.hp = 1; other.hit();
    out.rightAfter = { leaderState: leader.state, leaving: !!leader.leaving, exit: leader.exit && [+leader.exit.x.toFixed(1), +leader.exit.z.toFixed(1)], otherState: other.state };
    for (let i = 0; i < 60 * 2; i++) g.step(1 / 60);
    out.after2s = { leaderStillListed: g.students.includes(leader), inScene: g.scene.children.includes(leader.group), otherState: other.state, occupied: g.world.desks.filter(d => d.occupant).length, left: document.getElementById('left').textContent, wave: g.wave, state: g.state };
    return out; })));
  console.log('ERRORS:', errors.length ? errors : 'none'); await browser.close();
})();
