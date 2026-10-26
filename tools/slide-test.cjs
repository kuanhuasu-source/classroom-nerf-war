// the slide is a deck: open ground under it (hide, cut through, crouch where it gets low), the slab stops darts and sight, you still slide down from the tower
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html?map=yard', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.renderer.setAnimationLoop(null); window.__game.start(); });
  const r = await page.evaluate(() => { const g = window.__game, w = g.world, P = g.player, V = P.pos.constructor, out = {};
    // slide: x -3.3 (top, 1.8 m) → 0.5 (bottom), z -2, 1.1 wide
    out.heights = { under: w.heightAt(-3.0, -2), onTop: +w.heightAt(-3.0, -2, 1.7).toFixed(2), ceilingNearTower: +w.ceilingAt(-3.0, -2, 0).toFixed(2), ceilingMid: +w.ceilingAt(-2.0, -2, 0).toFixed(2) };
    // stand near the tower end, walk east under the slab: must drop to a crouch, then stop where the headroom is under 0.85
    P.pos.set(-3.1, 0, -2); P.yaw = 0; P.keys = {}; P.update(1 / 60); out.standNearTower = { crouch: P.crouching, y: P.pos.y };
    P.pos.set(-2.2, 0, -2); P.update(1 / 60); out.midUnder = { crouch: P.crouching, y: P.pos.y };
    const stepTo = (dx, dz, n) => { for (let i = 0; i < n; i++) w.walk(P.pos, dx, dz, 0.28, 0.85); };
    stepTo(0.03, 0, 120); out.crawlEastStopsAt = +P.pos.x.toFixed(2); out.stillOnGround = P.pos.y;
    // out the side, north: free
    P.pos.set(-2.6, 0, -2); stepTo(0, -0.03, 60); out.leaveNorthZ = +P.pos.z.toFixed(2);
    // cut through: west side of the tower end is the tower itself, so cross under from south to north
    P.pos.set(-2.9, 0, -1.2); stepTo(0, -0.03, 60); out.crossUnderZ = +P.pos.z.toFixed(2);
    // from the tower top, walk east: ride the slide down to the ground past its foot
    P.pos.set(-3.6, 1.8, -2); const ys = []; for (let i = 0; i < 220; i++) { w.walk(P.pos, 0.03, 0, 0.28, 1.45); if (i % 40 === 0) ys.push([+P.pos.x.toFixed(2), +P.pos.y.toFixed(2)]); } out.slideDown = ys; out.slideEnd = [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2)];
    // walk up the slide from its foot
    P.pos.set(1.0, 0, -2); for (let i = 0; i < 200; i++) w.walk(P.pos, -0.03, 0, 0.28, 1.45); out.climbFromFoot = [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2)];
    // darts: from under, straight up → sticks under the slab; from above, down → sticks on top; along the tunnel → flies through
    const fire = (p, d) => { const dart = g.darts.fire(new V(...p), new V(...d).normalize(), 20, 'player'); for (let i = 0; i < 40; i++) g.darts.update(1 / 60, () => false); return [+dart.mesh.position.x.toFixed(2), +dart.mesh.position.y.toFixed(2), +dart.mesh.position.z.toFixed(2), dart.stuck ? 'stuck' : 'flying'] };
    out.dartUp = fire([-2.6, 0.4, -2], [0, 1, 0]); out.dartDown = fire([-2.6, 3.0, -2], [0, -1, 0]); out.dartAlong = fire([-3.2, 0.4, -2], [1, 0, 0]);
    // sight: a kid on the tower cannot see someone under the slab; two people under it see each other
    out.losThroughSlab = w.segmentBlocked(new V(-3.8, 3.0, -2), new V(-2.4, 0.5, -2)); out.losUnder = w.segmentBlocked(new V(-3.2, 0.5, -2.3), new V(-1.8, 0.5, -1.7));
    out.losOverPastSlide = w.segmentBlocked(new V(-6, 1.2, -5.5), new V(2, 1.2, -5.5)); // across the yard north of the slide, not through it
    out.rayUp = +w.rayDistance(new V(-2.6, 0.4, -2), new V(0, 1, 0), 10).toFixed(1);
    // nav: kids may stand under the tall end, not the low end, and never on the slab from below
    const c = (x, z) => { const k = w.cellOf(x, z); return w.grid[k.gz * w.gw + k.gx]; };
    out.gridUnderTall = c(-3.0, -2); out.gridUnderLow = c(-1.0, -2); out.gridTower = c(-4, -2);
    return out; });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
