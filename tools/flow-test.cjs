// movement-flow probe for every map: random wander wedge count, free-cell share, narrowest useful gaps
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  for (const map of (process.env.MAPS ? process.env.MAPS.split(',') : ['classroom', 'lab', 'music', 'hall', 'yard'])) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:8766/index.html?map=' + map + (map === 'toilet' ? '&mode=toilet' : ''), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); window.__game.start(); });
    const r = await page.evaluate(() => {
      const g = window.__game, w = g.world, V = g.player.pos.constructor;
      let free = 0; for (let i = 0; i < w.grid.length; i++) if (!w.grid[i]) free++;
      // wander from the start with random headings; count frames with (almost) no progress, and separately how often a heading change was needed
      let stuck = 0, dist = 0; const seeds = [1, 2, 3, 4];
      for (const s of seeds) { let a = s, rnd = s * 9301; const nx = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
        const p = new V(w.layout.start.x, 0, w.layout.start.z); p.y = w.heightAt(p.x, p.z);
        for (let k = 0; k < 2400; k++) { if (k % 120 === 0) a = nx() * 6.28; const b = p.clone(); w.walk(p, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.28); const m = Math.hypot(p.x - b.x, p.z - b.z); dist += m; if (m < 0.01) { if (Math.abs(p.x) < w.room.w / 2 - 0.7 && Math.abs(p.z) < w.room.d / 2 - 0.7) stuck++; a += 0.6 + nx(); } } }
      // targeted passages: walk a straight line through the gap and report how far it got
      const run = (x, z, dx, dz, n) => { const p = new V(x, 0, z); p.y = w.heightAt(x, z); for (let k = 0; k < n; k++) w.walk(p, dx, dz, 0.28); return [+p.x.toFixed(1), +p.z.toFixed(1)]; };
      const probes = { lab: [[-6, -0.63, 0.05, 0, 240], [-6, 1.57, 0.05, 0, 240]], music: [[0, 2.5, 0, -0.05, 130], [-2.2, 2.5, 0, -0.05, 130]], hall: [[5.5, -1.5, 0, 0.05, 110], [-5.5, -1.5, 0, 0.05, 110], [7.2, -3.5, 0, 0.05, 160], [0, 3.5, 0, -0.05, 150]], yard: [[-7.2, 1, 0, 0.05, 70], [-4.0, 1, 0, 0.05, 70], [0.5, 1.2, 0, 0.05, 90], [-0.6, 1.2, 0, 0.05, 90], [1.6, 1.2, 0, 0.05, 90]], classroom: [[-6.8, -2.63, 0.05, 0, 280], [-6.8, 1.17, 0.05, 0, 280]] };
      const gaps = (probes[w.layout.id] || []).map(a => run(...a));
      return { gaps, free: +(free / w.grid.length).toFixed(3), wedged: stuck, dist: +dist.toFixed(0), boxes: w.boxes.length };
    });
    out[map] = r; if (errors.length) out[map].errors = errors;
    await page.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
