// every desk a milk carton / ammo box can land on must have a standing spot the player can walk to and reach from;
// every wall mount a special item can appear on must be visible (clear dart line) from some walkable cell within 9 m
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
      const g = window.__game, w = g.world, V = g.player.pos.constructor, R = 0.28;
      const standable = (x, z, floor) => { const p = new V(x, 0, z); p.y = w.heightAt(x, z); if (Math.abs(p.y - floor) > 0.3) return null; const q = p.clone(); w.collideCircle(q, R); if (Math.hypot(q.x - p.x, q.z - p.z) > 1e-3) return null;
        // can the player actually walk there from the nav grid (which is already sealed to what the start can reach)?
        const c = w.nearestFree(x, z), cc = w.cellCenter(c.gx, c.gz); if (!w.free(c.gx, c.gz) || Math.abs(w.gridH[c.gz * w.gw + c.gx] - floor) > 0.5) return null;
        const s = new V(cc.x, 0, cc.z); s.y = w.heightAt(s.x, s.z); for (let k = 0; k < 60; k++) { const dx = p.x - s.x, dz = p.z - s.z, L = Math.hypot(dx, dz); if (L < 0.05) return p; const st = Math.min(0.04, L); w.walk(s, dx / L * st, dz / L * st, R); } return Math.hypot(p.x - s.x, p.z - s.z) < 0.06 ? p : null; };
      const bad = [], ok = [];
      const tall = w.desks.filter(d => (d.h || 0.72) > 1.2).length;
      g.tables().forEach((d, i) => { const floor = d.floor || 0, h = d.h || 0.72, m = { mesh: { position: new V(d.x, floor + h + 0.1, d.z) }, desk: d }; let found = null;
        for (let x = d.x - d.w / 2 - 0.7; x <= d.x + d.w / 2 + 0.7 && !found; x += 0.05) for (let z = d.z - d.d / 2 - 0.7; z <= d.z + d.d / 2 + 0.7 && !found; z += 0.05) { const p = standable(x, z, floor); if (p && g.canReach(p, m)) found = p; }
        (found ? ok : bad).push({ i, x: d.x, z: d.z, w: d.w, d: d.d, h, floor, kind: (w.layout.furniture.find(f => Math.abs(f.x - d.x) < 1.3 && Math.abs(f.z - d.z) < 1.3) || {}).kind }); });
      // mounts: vantage cells with a clear line from eye height to the item
      const mounts = w.layout.mounts.map((m, i) => { const item = new V(m.x, m.y, m.z); let n = 0, near = 99; for (let gz = 0; gz < w.gh; gz++) for (let gx = 0; gx < w.gw; gx++) { if (!w.free(gx, gz)) continue; const c = w.cellCenter(gx, gz), fh = w.gridH[gz * w.gw + gx], L = Math.hypot(c.x - m.x, c.z - m.z); if (L < 0.8 || L > 9) continue; const eye = new V(c.x, fh + 1.25, c.z); if (!w.segmentBlocked(eye, item)) { n++; if (L < near) near = L; } } const inBox = w.boxes.some(b => item.x > b.minX && item.x < b.maxX && item.z > b.minZ && item.z < b.maxZ && item.y < b.h && item.y > b.y0);
        // a real shot: stand on a vantage cell 2.5-6 m away, spawn the item on this mount, fire one dart straight at it and step the game
        let shot = null; const cells = []; for (let gz = 0; gz < w.gh; gz++) for (let gx = 0; gx < w.gw; gx++) { if (!w.free(gx, gz)) continue; const c = w.cellCenter(gx, gz), fh = w.gridH[gz * w.gw + gx], L = Math.hypot(c.x - m.x, c.z - m.z); if (L < 2.5 || L > 6) continue; const eye = new V(c.x, fh + 1.25, c.z); if (!w.segmentBlocked(eye, item)) cells.push({ c, fh, L }); }
        cells.sort((a, b) => a.L - b.L);
        for (const v of cells.slice(0, 3)) { g.items.forEach(it => it.dispose()); g.items = []; const keep = w.layout.mounts; w.layout.mounts = [m]; g.spawnItem(); w.layout.mounts = keep; if (!g.items.length) { shot = 'nospawn'; break; }
          g.player.pos.set(v.c.x, v.fh, v.c.z); const eye = new V(v.c.x, v.fh + 1.25, v.c.z), dir = item.clone().sub(eye).normalize(); const d = g.darts.fire(eye, dir, 32, 'player'); d.who = 'host';
          for (let k = 0; k < 50 && g.items.length; k++) g.step(1 / 60);
          if (!g.items.length) { shot = +v.L.toFixed(1); break; } shot = 'miss@' + v.L.toFixed(1); }
        g.items.forEach(it => it.dispose()); g.items = [];
        return { i, x: m.x, y: m.y, z: m.z, vantage: n, nearest: +near.toFixed(1), inBox, shot }; });
      return { desks: w.desks.length, tables: g.tables().length, tallSkipped: tall, milkBad: bad, mountsBad: mounts.filter(m => m.vantage === 0 || m.inBox || typeof m.shot !== 'number'), shots: mounts.map(m => m.shot), mountsMinVantage: Math.min(...mounts.map(m => m.vantage)), mounts: mounts.length };
    });
    out[map] = r; if (errors.length) out[map].errors = errors; await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
