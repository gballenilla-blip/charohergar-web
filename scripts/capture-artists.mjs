/**
 * Captura la zona de ARTISTAS en varios viewports y verifica que las N
 * tarjetas del roster sean visibles (centro dentro del viewport, sin cortes).
 *   node scripts/capture-artists.mjs [sufijo]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const TAG = process.argv[2] ?? 'artistsfix';
const URL = process.env.URL ?? 'http://localhost:4173/';
const VPS = [
  [1440, 900],
  [1024, 768],
  [390, 844],
];

const outDir = join(process.cwd(), 'shots', TAG);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});

const report = [];
for (const [W, H] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    document.querySelector('.carousel')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(900);

  const geo = await page.evaluate(() => {
    const vp = document.querySelector('.carousel__viewport');
    const r = vp.getBoundingClientRect();
    const cards = [...vp.querySelectorAll('.card')].map((c) => {
      const b = c.getBoundingClientRect();
      return {
        i: c.dataset.index,
        name: c.querySelector('.card__name')?.textContent,
        left: Math.round(b.left),
        right: Math.round(b.right),
        fullyInside: b.left >= r.left - 1 && b.right <= r.right + 1,
        centerInside: b.left <= r.right && b.right >= r.left,
        op: +getComputedStyle(c).opacity.slice(0, 4),
      };
    });
    return { vp: { left: Math.round(r.left), right: Math.round(r.right) }, cards };
  });

  await page.screenshot({ path: join(outDir, `rest-${W}.png`) });
  const log = [];
  log.push(await page.evaluate(() => ({
    step: 'after-rest', scrollY: Math.round(scrollY),
    active: document.querySelector('.card.is-active')?.dataset.index,
    detail: document.querySelector('.carousel__detail')?.textContent?.trim().slice(0, 30),
  })));

  // tras avanzar 2 posiciones (para ver la composición con active distinto de 0)
  for (const step of [1, 2]) {
    try {
      await page.click('[data-carousel-next]', { timeout: 5000 });
    } catch (e) {
      log.push({ step: `click${step}-ERR`, err: String(e).slice(0, 200) });
    }
    await page.waitForTimeout(step === 1 ? 300 : 1100);
    log.push(await page.evaluate((s) => ({
      step: `after-click${s}`, scrollY: Math.round(scrollY),
      active: document.querySelector('.card.is-active')?.dataset.index,
      detail: document.querySelector('.carousel__detail')?.textContent?.trim().slice(0, 30),
    }), step));
  }
  await page.screenshot({ path: join(outDir, `idx2-${W}.png`) });
  const allVisible = geo.cards.every((c) => c.centerInside && c.op >= 0.4);
  report.push({ W, H, allVisible, geo, log, errors });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
