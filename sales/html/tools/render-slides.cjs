// Renders every slide of ../alumni-portal-deck.html to ../renders/slide-NN.png at 1920x1080.
// One browser, stepped through with the deck engine's own goTo() API, closed at the end.
//
//   node sales/html/tools/render-slides.cjs          all slides
//   node sales/html/tools/render-slides.cjs 5 10     only slides 5 and 10
//
// Needs Playwright with Chromium (the portal repo has it: run from D:\Alumni).
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), path.resolve(__dirname, '../../..')] }));

const DECK = path.resolve(__dirname, '..', 'alumni-portal-deck.html');
const OUT = path.resolve(__dirname, '..', 'renders');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2).map(Number).filter(Boolean);

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto('file:///' + DECK.replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const s = document.querySelector('deck-stage');
      return s && typeof s.goTo === 'function' && s.querySelectorAll(':scope > section').length > 0;
    }, null, { timeout: 60000 });
    // No thumbnail rail in the renders, so the slide fills the viewport at 1:1.
    await page.evaluate(() => document.querySelector('deck-stage').setAttribute('no-rail', ''));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
    const total = await page.evaluate(() => document.querySelectorAll('deck-stage > section').length);
    for (let i = 0; i < total; i++) {
      if (only.length && !only.includes(i + 1)) continue;
      await page.evaluate((n) => document.querySelector('deck-stage').goTo(n), i);
      await page.waitForTimeout(2600); // the engine's slide counter fades out after 1.8 s
      const file = path.join(OUT, `slide-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: file });
      console.log(path.relative(process.cwd(), file));
    }
  } finally {
    await browser.close();
  }
})();
