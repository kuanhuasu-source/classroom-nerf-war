// Cartons and pencil cases on big tables must be reachable from the table's edge; full-HP / full-ammo give a hint
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  for (const map of ['lab', 'music', 'classroom']) {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:8766/index.html?map=' + map, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    const r = await page.evaluate(() => {
      const g = window.__game; g.renderer.setAnimationLoop(null); g.start(); g.students.forEach(s => s.dispose()); g.students = []; g.spawnQueue = [];
      const out = {};
      // the biggest table in the room, carton in the middle of one of its entries
      const desk = g.world.desks.slice().sort((a, b) => (b.w * b.d) - (a.w * a.d))[0];
      g.milks.forEach(m => g.scene.remove(m.mesh)); g.milks = [];
      const mk = g.makeMilk(desk.x, (desk.floor || 0) + desk.h + 0.1, desk.z); mk.desk = desk; mk.id = g.nextId(); g.milks.push(mk);
      out.table = [desk.w, desk.d];
      // stand touching the table's deep side (player radius 0.28), hp one short
      g.player.hp = 4; g.player.pos.set(desk.x, 0, desk.z + desk.d / 2 + 0.3);
      const dist = Math.hypot(0, desk.d / 2 + 0.3);
      for (let i = 0; i < 10; i++) g.step(1 / 60);
      out.milk = { distToCenter: +dist.toFixed(2), drank: g.player.hp === 5, left: g.milks.length };
      // a pencil case at the same spot, reserve not full
      const box = g.makeMilk(desk.x, (desk.floor || 0) + desk.h + 0.1, desk.z, 'ammo'); box.desk = desk; box.id = g.nextId(); box.kind = 'ammo'; g.milks.push(box);
      g.player.reserve = 10; for (let i = 0; i < 10; i++) g.step(1 / 60);
      out.ammo = { reserve: g.player.reserve, left: g.milks.length };
      // full reserve: hint instead of silence
      const box2 = g.makeMilk(desk.x, (desk.floor || 0) + desk.h + 0.1, desk.z, 'ammo'); box2.desk = desk; box2.id = g.nextId(); box2.kind = 'ammo'; g.milks.push(box2);
      g.player.reserve = g.player.reserveCap(); g.hintT = 0; for (let i = 0; i < 10; i++) { g.step(1 / 60); g.ui.tick(1 / 60); }
      out.fullHint = document.getElementById('msg').textContent.includes('備用彈已經滿了');
      // darts 1.35 m away get picked up
      g.darts.clear(); const V = g.player.pos.constructor; const d = g.darts.fire(new V(desk.x + 1.35, 0.03, desk.z + desk.d / 2 + 0.3), new V(1, 0, 0), 0.01, 'enemy'); g.darts.settle(d); d.vel.set(0, 0, 0);
      g.player.reserve = 10; for (let i = 0; i < 10; i++) g.step(1 / 60);
      out.dart = { reserve: g.player.reserve, left: g.darts.list.length };
      return out;
    });
    console.log(map, JSON.stringify(r)); await page.close();
  }
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
