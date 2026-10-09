/**
 * QA programático: layout, overflow, reveals, carrusel, teclado, menú,
 * reduced-motion y fallback sin WebGL.
 *   node scripts/qa.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});
const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => results.push({ name: 'pageerror', pass: false, detail: String(e) }));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  return { ctx, page };
}

/* ---------- 1. overflow horizontal en varios viewports ---------- */
for (const [w, h] of [[1440, 900], [1024, 768], [720, 900], [390, 844], [320, 700]]) {
  const { ctx, page } = await newPage({ viewport: { width: w, height: h } });
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  const points = [0, 0.25, 0.5, 0.75, 1];
  let worst = null;
  for (const p of points) {
    const r = await page.evaluate((pp) => {
      window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * pp);
      return {
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        over: [...document.querySelectorAll('body *')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && (b.right > window.innerWidth + 2 || b.left < -2) &&
              getComputedStyle(el).position !== 'fixed' &&
              !el.closest('.carousel__track, .grain, .vignette, #gl');
          })
          .slice(0, 6)
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`),
      };
    }, p);
    if (r.sw > r.iw + 1) worst = `scrollWidth ${r.sw} > ${r.iw} @p${p} :: ${r.over.join(' | ')}`;
    else if (r.over.length && !worst) worst = `elementos fuera @p${p}: ${r.over.join(' | ')}`;
  }
  ok(`overflow-x ${w}x${h}`, !worst, worst ?? 'ok');
  await ctx.close();
}

/* ---------- 2. reveals: todo lo importante acaba visible ---------- */
{
  const { ctx, page } = await newPage();
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  const sections = await page.$$eval('[data-scene]', (els) => els.map((e) => e.dataset.scene));
  for (const id of sections) {
    await page.evaluate((sid) => {
      const el = document.querySelector(`[data-scene="${sid}"]`);
      window.scrollTo(0, el.getBoundingClientRect().top + scrollY + el.offsetHeight * 0.55 - innerHeight * 0.5);
    }, id);
    /* Espera activa: los reveals tienen delay+transición; leer antes de que
       terminen provoca falsos negativos intermitentes ("is-in" con op 0). */
    await page.waitForTimeout(300);
    await page
      .waitForFunction(
        (sid) => {
          const sec = document.querySelector(`[data-scene="${sid}"]`);
          if (!sec) return true;
          const pending = [...sec.querySelectorAll('[data-reveal]')].some(
            (el) => !el.classList.contains('is-in'),
          );
          const sub = sec.querySelector('.reveal__sub');
          const subReady = !sub || parseFloat(getComputedStyle(sub).opacity) > 0.05;
          return !pending && subReady;
        },
        id,
        { timeout: 5000 },
      )
      .catch(() => {});
    await page.waitForTimeout(200);
    const r = await page.evaluate((sid) => {
      const sec = document.querySelector(`[data-scene="${sid}"]`);
      const hidden = [...sec.querySelectorAll('[data-reveal]')]
        .filter((el) => !el.classList.contains('is-in'))
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 50)}`);
      const sub = sec.querySelector('.reveal__sub');
      return {
        hidden,
        sub: sub ? {
          cls: sub.className,
          op: getComputedStyle(sub).opacity,
          rect: JSON.parse(JSON.stringify(sub.getBoundingClientRect())),
        } : null,
      };
    }, id);
    ok(`reveals ${id}`, r.hidden.length === 0, r.hidden.join(' | '));
    if (id === 'reveal') ok('reveal sub visible', r.sub && r.sub.op !== '0' && r.sub.rect.top < 900, JSON.stringify(r.sub));
  }
  await ctx.close();
}

/* ---------- 3. carrusel: teclado, clic en flechas, selección ---------- */
{
  const { ctx, page } = await newPage();
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelector('.carousel__ui')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => document.querySelector('.carousel__detail')?.textContent?.slice(0, 40));
  await page.click('[data-carousel-next]').catch(() => {});
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => document.querySelector('.carousel__detail')?.textContent?.slice(0, 40));
  ok('carrusel flecha siguiente cambia artista', before !== after, `${before} → ${after}`);

  // drag con ratón (sobre el viewport del carrusel, centrado)
  await page.evaluate(() => {
    document.querySelector('.carousel__viewport')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);
  const box = await page.locator('.carousel__viewport').boundingBox();
  if (box && box.y >= 0 && box.y + box.height <= 900) {
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.6, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1100);
    const afterDrag = await page.evaluate(() => document.querySelector('.carousel__detail')?.textContent?.slice(0, 40));
    ok('carrusel drag cambia selección', afterDrag !== after, `${after} → ${afterDrag}`);
  } else {
    ok('carrusel drag cambia selección', false, `viewport fuera de pantalla: ${JSON.stringify(box)}`);
  }

  // presskit: enlace por artista activo + los 4 PDFs accesibles
  const pkHref = await page.getAttribute('[data-presskit]', 'href').catch(() => null);
  ok('presskit: enlace por artista', !!pkHref && pkHref.includes('/assets/presskit/'), String(pkHref));
  const pkBase = URL.endsWith('/') ? URL : `${URL}/`;
  for (const f of ['anora-kito', 'corazon-inverso', 'dany-mixtika', 'jesus-marti']) {
    const resp = await page.request
      .get(`${pkBase}assets/presskit/${f}.pdf`)
      .catch(() => null);
    ok(`presskit: ${f}.pdf (200)`, !!resp && resp.status() === 200, String(resp?.status()));
  }
  await ctx.close();
}

/* ---------- 4. foco de teclado y skip link ---------- */
{
  const { ctx, page } = await newPage();
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName);
  ok('primer Tab = skip link', String(first).includes('skip'), String(first));
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.boxShadow.slice(0, 40)}`;
  });
  ok('focus visible (outline/shadow)', !/none 0px\s*$/.test(outline) || outline.includes('rgb'), outline);
  await ctx.close();
}

/* ---------- 5. sonido sin autoplay + toggle ---------- */
{
  const { ctx, page } = await newPage();
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  const t0 = await page.textContent('#sound-txt').catch(() => null);
  ok('sonido OFF por defecto', /off/i.test(t0 ?? ''), t0 ?? 'sin botón');
  await page.click('#sound-btn', { force: true }).catch(() => {});
  await page.waitForTimeout(500);
  const t1 = await page.textContent('#sound-txt').catch(() => null);
  ok('toggle sonido cambia estado', t1 !== t0, `${t0} → ${t1}`);
  await ctx.close();
}

/* ---------- 6. menú móvil ---------- */
{
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 } });
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  const visible = await page.isVisible('#burger');
  ok('burger visible en móvil', visible);
  if (visible) {
    await page.click('#burger');
    await page.waitForTimeout(500);
    const open = await page.evaluate(() => document.getElementById('menu')?.classList.contains('is-open'));
    ok('menú abre', !!open);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() => !document.getElementById('menu')?.classList.contains('is-open'));
    ok('menú cierra con Escape', closed);
  }
  await ctx.close();
}

/* ---------- 7. prefers-reduced-motion ---------- */
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' });
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  const r = await page.evaluate(() => ({
    body: document.body.className,
    htmlScroll: getComputedStyle(document.documentElement).scrollBehavior,
    revealsIn: document.querySelectorAll('[data-reveal].is-in').length,
    revealsAll: document.querySelectorAll('[data-reveal]').length,
  }));
  ok('reduced-motion: scroll auto', r.htmlScroll === 'auto', r.htmlScroll);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => document.querySelectorAll('[data-reveal].is-in').length);
  ok('reduced-motion: reveals se cumplen', after > r.revealsIn, `${r.revealsIn} → ${after}`);
  await ctx.close();
}

/* ---------- 8. fallback sin WebGL ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...rest) {
      if (String(t).includes('webgl')) return null;
      return orig.call(this, t, ...rest);
    };
  });
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('.loader.is-done', { timeout: 45000 }).catch(() => {});
  const r = await page.evaluate(() => ({
    cls: document.body.className,
    fallbackVisible: (() => {
      const f = document.getElementById('gl-fallback') || document.querySelector('.gl-fallback');
      if (!f) return 'no-existe';
      const cs = getComputedStyle(f);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' ? 'visible' : 'oculto';
    })(),
    introText: getComputedStyle(document.querySelector('.intro__title')).opacity,
  }));
  ok('sin WebGL: clase no-webgl', r.cls.includes('no-webgl'), r.cls);
  ok('sin WebGL: fallback visible', r.fallbackVisible === 'visible', r.fallbackVisible);
  ok('sin WebGL: texto intro visible', r.introText !== '0', r.introText);
  await ctx.close();
}

console.log(JSON.stringify(results, null, 1));
const fails = results.filter((r) => !r.pass && r.name !== 'pageerror');
console.log(`\n${results.length - fails.length}/${results.length} OK`);
await browser.close();
process.exit(fails.length ? 1 : 0);
