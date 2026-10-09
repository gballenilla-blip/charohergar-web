import { variants, type Variant } from '../data/variants';

/** Carrusel 3D: drag/swipe con inercia, activo a escala, laterales desenfocados. */

interface CarouselOpts {
  onSelect?: (v: Variant, index: number) => void;
}

export function initCarousel(opts: CarouselOpts = {}): void {
  const root = document.querySelector<HTMLElement>('[data-carousel]');
  if (!root) return;

  const viewport = root.querySelector<HTMLElement>('[data-carousel-viewport]');
  const track = root.querySelector<HTMLElement>('[data-carousel-track]');
  const dotsWrap = root.querySelector<HTMLElement>('[data-carousel-dots]');
  const detail = root.querySelector<HTMLElement>('[data-carousel-detail]');
  const prev = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
  if (!viewport || !track) return;

  const n = variants.length;

  /* ---------- render ---------- */
  const cards: HTMLElement[] = [];
  variants.forEach((v, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.index = String(i);
    card.innerHTML = `
      <picture>
        <source srcset="${v.webp}" type="image/webp">
        <img class="card__img" src="${v.image}" alt="Retrato de ${v.name}" width="900" height="1125"
             loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async" draggable="false">
      </picture>
      <span class="card__frame" aria-hidden="true"></span>
      <div class="card__meta">
        <p class="card__name">${v.name}</p>
        <p class="card__genre">${v.genre}</p>
      </div>`;
    track.appendChild(card);
    cards.push(card);
  });

  const dots: HTMLButtonElement[] = [];
  variants.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Ver ${v.name}`);
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.addEventListener('click', () => goTo(i));
    dotsWrap?.appendChild(b);
    if (dots) dots.push(b);
  });

  /* ---------- estado ---------- */
  let index = 0;        // índice entero activo
  let offset = 0;       // desplazamiento continuo (arrastre)
  let velocity = 0;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startOffset = 0;
  let lastX = 0;
  let lastT = 0;
  let raf = 0;
  let sBase = 0;        // espaciado entre tarjetas (calculado en fit())

  /**
   * Espaciado entre tarjetas: se reducirá hasta que la MÁS LEJANA (n-1 pasos)
   * con su escala/rotación/proyección en perspectiva quepa dentro del
   * viewport. Así las N tarjetas del roster siempre son visibles en reposo.
   * La perspectiva (1400px, ver carousel.css) comprime x en f = p/(p+|z|).
   */
  const fit = (): void => {
    const vw = viewport.clientWidth;
    const cardW = cards[0]?.offsetWidth || 260;
    const half = vw / 2;
    let s = Math.min(vw * 0.46, 340);

    for (let d = 1; d < n; d++) {
      const abs = Math.min(d, 3);
      const z = abs * 150;
      const f = 1400 / (1400 + z);
      const sc = Math.max(0.58, 1 - abs * 0.12);
      const ry = (Math.min(abs * 15, 40) * Math.PI) / 180;
      const halfCard = (cardW / 2) * sc * f * Math.cos(ry);
      // margen extra: getBoundingClientRect devuelve el hull del box 3D
      // rotado, algo mayor que la proyección estimada.
      s = Math.min(s, (half - 24 - halfCard) / (d * f));
    }
    sBase = Math.max(48, s);
  }

  const spacing = () => sBase;

  /* ---------- layout ---------- */
  function layout(): void {
    const s = spacing();
    const active = index + offset;
    const lim = n - 1;

    cards.forEach((card, i) => {
      const d = i - active;          // distancia en "pasos"
      const abs = Math.abs(d);
      const clamped = Math.max(-lim, Math.min(lim, d));

      const x = clamped * s;
      const z = -Math.min(abs, 3) * 150;
      const ry = -Math.sign(clamped) * Math.min(abs * 15, 40);
      const sc = Math.max(0.58, 1 - Math.min(abs, 3) * 0.12);
      const blur = Math.min(abs, 3) * 1.7;
      const op = Math.max(0.45, 1 - Math.min(abs, 3) * 0.18);

      card.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0, ${z}px) rotateY(${ry}deg) scale(${sc})`;
      card.style.filter = blur > 0.15 ? `blur(${blur}px)` : 'none';
      card.style.opacity = String(op);
      card.style.zIndex = String(100 - Math.round(abs * 10));
      card.classList.toggle('is-active', abs < 0.5);
      card.setAttribute('aria-hidden', abs < 0.5 ? 'false' : 'true');
    });

    dots.forEach((d, i) => d.setAttribute('aria-selected', i === index ? 'true' : 'false'));
  }

  function renderDetail(): void {
    if (!detail) return;
    const v = variants[index];
    detail.innerHTML = `
      <p class="d-swatch d-fade"><i style="background:${v.color}"></i>${v.genre}</p>
      <p class="d-name d-fade">${v.name}</p>
      <p class="d-desc d-fade">${v.description}</p>
      <p class="d-actions d-fade">
        <a class="pk" href="${v.presskit}" target="_blank" rel="noopener" data-presskit
           data-cursor="view" aria-label="Abrir presskit de ${v.name} en PDF (pestaña nueva)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/></svg>
          <span>Ver presskit</span>
          <em>PDF</em>
        </a>
      </p>`;
    opts.onSelect?.(v, index);
  }

  /**
   * Selecciona `i` manteniendo la posición visual continua: la tarjeta
   * activa no salta; `offset` compensa y anima hasta el reposo (0).
   */
  function goTo(i: number): void {
    const target = ((i % n) + n) % n;
    const changed = target !== index;
    offset = index + offset - target; // active = index + offset no cambia
    index = target;
    if (changed) renderDetail();
    animateTo(0);
  }

  /** Anima `offset` hasta `goal` (0 = reposo) con easing suave. */
  function animateTo(goal: number): void {
    cancelAnimationFrame(raf);
    const step = () => {
      offset += (goal - offset) * 0.16;
      if (Math.abs(goal - offset) < 0.002) {
        offset = goal;
        layout();
        return;
      }
      layout();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* ---------- drag / swipe ---------- */
  const vp = viewport;
  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = lastX = e.clientX;
    startOffset = offset;
    lastT = performance.now();
    velocity = 0;
    vp.classList.add('is-dragging');
    vp.setPointerCapture(e.pointerId);
    cancelAnimationFrame(raf);
  }

  function onMove(e: PointerEvent): void {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 6) moved = true;

    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = now;

    // el contenido sigue al dedo: arrastrar a la izquierda avanza (offset +)
    let delta = -dx / spacing();
    // resistencia en los extremos
    if (Math.abs(delta) > 1.4) {
      delta = Math.sign(delta) * (1.4 + (Math.abs(delta) - 1.4) * 0.35);
    }
    offset = startOffset + delta;
    layout();
  }

  function onUp(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    vp.classList.remove('is-dragging');
    try {
      vp.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }

    if (!moved) {
      const card = (e.target as Element | null)?.closest('.card') as HTMLElement | null;
      if (card?.dataset.index) {
        goTo(Number(card.dataset.index));
        return;
      }
    }

    // inercia → desplazamiento por índice (flick a la izquierda = siguiente)
    const flick = -velocity * 12;
    const total = offset + (flick / spacing()) * 1.2;
    const shift = Math.round(total);
    goTo(index + shift);
  }

  viewport.addEventListener('pointerdown', onDown);
  viewport.addEventListener('pointermove', onMove);
  viewport.addEventListener('pointerup', onUp);
  viewport.addEventListener('pointercancel', onUp);

  // evitar arrastre de imágenes
  viewport.addEventListener('dragstart', (e) => e.preventDefault());

  // teclado
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(index + 1);
    }
  });

  prev?.addEventListener('click', () => goTo(index - 1));
  next?.addEventListener('click', () => goTo(index + 1));

  window.addEventListener('resize', () => {
    fit();
    layout();
  }, { passive: true });

  fit();
  layout();
  renderDetail();
}
