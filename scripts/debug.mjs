/** Diagnóstico puntual de los fallos de QA. node scripts/debug.mjs */
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});

/* 1. cursor dot */
const cur = await page.evaluate(() => {
  const dot = document.querySelector('.cursor__dot');
  const root = document.getElementById('cursor');
  const r = dot.getBoundingClientRect();
  return {
    body: document.body.className,
    rootDisplay: getComputedStyle(root).display,
    rootTransform: root.style.transform || getComputedStyle(root).transform,
    rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width },
    iw: innerWidth,
    mq: matchMedia('(hover: hover) and (pointer: fine)').matches,
  };
});
console.log('CURSOR:', JSON.stringify(cur));

/* 2. reveal__sub en sección reveal */
await page.evaluate(() => {
  const el = document.querySelector('[data-scene="reveal"]');
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY + el.offsetHeight * 0.55 - innerHeight * 0.5);
});
await page.waitForTimeout(1200);
const sub = await page.evaluate(() => {
  const s = document.querySelector('.reveal__sub');
  const r = s.getBoundingClientRect();
  return { cls: s.className, op: getComputedStyle(s).opacity, top: r.top, bottom: r.bottom, vh: innerHeight };
});
console.log('SUB:', JSON.stringify(sub));

/* 3. eyebrow artists */
await page.evaluate(() => {
  const el = document.querySelector('[data-scene="artists"]');
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY + el.offsetHeight * 0.55 - innerHeight * 0.5);
});
await page.waitForTimeout(1200);
const eb = await page.evaluate(() => {
  const sec = document.querySelector('[data-scene="artists"]');
  return [...sec.querySelectorAll('[data-reveal]')].map((el) => {
    const r = el.getBoundingClientRect();
    return `${el.tagName}.${el.className} top=${Math.round(r.top)} is-in=${el.classList.contains('is-in')}`;
  });
});
console.log('ARTISTS REVEALS:', JSON.stringify(eb, null, 1));

/* 4. carrusel: scroll + clic */
await page.evaluate(() => {
  const el = document.querySelector('[data-scene="artists"]');
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 200);
});
await page.waitForTimeout(600);
const btn = await page.evaluate(() => {
  const b = document.querySelector('[data-carousel-next]');
  const r = b.getBoundingClientRect();
  return { top: r.top, left: r.left, w: r.width, h: r.height, visible: r.top > 0 && r.bottom < innerHeight };
});
console.log('NEXT BTN:', JSON.stringify(btn));
const before = await page.evaluate(() => document.querySelector('.carousel__detail')?.textContent?.trim().slice(0, 60));
await page.click('[data-carousel-next]', { force: true }).catch((e) => console.log('CLICK ERR:', String(e)));
await page.waitForTimeout(1500);
const after = await page.evaluate(() => document.querySelector('.carousel__detail')?.textContent?.trim().slice(0, 60));
console.log('CLICK:', JSON.stringify({ before, after, changed: before !== after }));

/* estado interno del carrusel (¿index cambió?) */
const carState = await page.evaluate(() => {
  const track = document.querySelector('[data-carousel-track]');
  const active = track?.querySelector('.card.is-active');
  return { active: active?.dataset.index, activeName: active?.querySelector('.card__name')?.textContent };
});
console.log('CARRUSEL:', JSON.stringify(carState));

/* 5. drag */
const box = await page.locator('.carousel__track').boundingBox();
if (box) {
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.6, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const carState2 = await page.evaluate(() => {
    const track = document.querySelector('[data-carousel-track]');
    const active = track?.querySelector('.card.is-active');
    return {
      active: active?.dataset.index,
      detail: document.querySelector('.carousel__detail')?.textContent?.trim().slice(0, 60),
    };
  });
  console.log('DRAG:', JSON.stringify(carState2));
} else {
  console.log('DRAG: sin box');
}

/* 6. fallback */
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
await page2.addInitScript(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...rest) {
    if (String(t).includes('webgl')) return null;
    return orig.call(this, t, ...rest);
  };
});
await page2.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page2.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
const fb = await page2.evaluate(() => {
  const f = document.getElementById('gl-fallback') || document.querySelector('.gl-fallback');
  if (!f) return 'no-existe';
  const cs = getComputedStyle(f);
  return `display=${cs.display} vis=${cs.visibility} op=${cs.opacity}`;
});
console.log('FALLBACK:', fb);

await browser.close();
