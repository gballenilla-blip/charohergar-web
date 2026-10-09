/**
 * Captura headless para QA visual.
 *   node scripts/capture.mjs [ancho] [alto] [sufijo] [progresos]
 * Ejemplos:
 *   node scripts/capture.mjs              → desktop 1440x900
 *   node scripts/capture.mjs 768 1024 tab
 *   node scripts/capture.mjs 390 844 mob
 *   node scripts/capture.mjs 1440 900 final 0.02,0.5,0.96
 * ATENCIÓN: `progresos` son DECIMALES (0–1) separados por comas; un valor
 * entero (ej. 50) se interpreta como 50 → clamp a 1.0 (fondo de página).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const W = Number(process.argv[2] ?? 1440);
const H = Number(process.argv[3] ?? 900);
const TAG = process.argv[4] ?? 'desktop';
const URL = process.env.URL ?? 'http://localhost:4173/';

const outDir = join(process.cwd(), 'shots', TAG);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1500);

const geo = await page.evaluate(() => {
  const vh = window.innerHeight;
  const secs = [...document.querySelectorAll('[data-scene]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.scene, top: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
  });
  return { vh, docH: document.documentElement.scrollHeight, secs };
});

/** Punto de captura: progreso objetivo dentro de la sección. */
const target = (s, p) => {
  const pinned = s.h > geo.vh * 1.5;
  if (pinned) return s.top + Math.round((s.h - geo.vh) * p);
  return s.top + Math.round(s.h * p - geo.vh * 0.5);
};

const shots = [];
const PTS = (process.argv[5] ?? '0.02,0.5,0.96').split(',').map(Number);
for (const s of geo.secs) {
  for (const p of PTS) {
    const y = Math.max(0, Math.min(geo.docH - geo.vh, target(s, p)));
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(1700);
    const name = `${s.id}-${Math.round(p * 100)}`;
    await page.screenshot({ path: join(outDir, `${name}.png`) });
    shots.push({ name, y });
  }
}

console.log(JSON.stringify({ geo, shots, errors }, null, 1));
await browser.close();
