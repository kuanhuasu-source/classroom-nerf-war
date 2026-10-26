const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.evaluate(() => { const n = document.getElementById('news'); if (n) n.hidden = true; }); // the what's-new card would sit over the menu buttons
  console.log('buttons:', await page.evaluate(() => [...document.querySelectorAll('.seg-btn[data-level]')].map(b => b.dataset.level + ':' + b.textContent)));
  await page.click('.seg-btn[data-level="exam"]');
  console.log('picked:', await page.evaluate(() => [window.__game.level, window.__game.diff.label, window.__game.diff.maxShooters, document.querySelector('.seg-btn[data-level="exam"]').classList.contains('on'), document.getElementById('difficulty-note') ? document.getElementById('difficulty-note').textContent.slice(0, 10) : (document.querySelector('#menu .note') || {}).textContent, localStorage.getItem('cnw-difficulty')]));
  await page.screenshot({ path: 'menu-levels.png' });
  console.log('ERRORS:', errors.length ? errors : 'none'); await browser.close();
})();
