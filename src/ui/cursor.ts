/** Cursor personalizado con estados (solo desktop, puntero fino). */

type CursorState = 'default' | 'view' | 'drag' | 'explore' | 'play';

const LABELS: Record<CursorState, string> = {
  default: '',
  view: 'VIEW',
  drag: 'DRAG',
  explore: 'EXPLORE',
  play: 'PLAY',
};

export function initCursor(): void {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;

  const root = document.getElementById('cursor');
  const label = document.getElementById('cursor-label');
  if (!root || !label) return;

  document.body.classList.add('has-cursor');

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let cx = x;
  let cy = y;
  let state: CursorState = 'default';
  let raf = 0;

  // posición sincrónica: el dot nunca aparece fuera del viewport
  root.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
  root.classList.add('is-idle');

  const setState = (next: CursorState) => {
    if (next === state) return;
    state = next;
    if (state === 'default') root.removeAttribute('data-state');
    else root.dataset.state = state;
    label.textContent = LABELS[state];
  };

  const loop = () => {
    cx += (x - cx) * 0.22;
    cy += (y - cy) * 0.22;
    root.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  window.addEventListener(
    'pointermove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      cx = x;
      cy = y;
      root.classList.remove('is-idle');
    },
    { passive: true },
  );

  window.addEventListener('pointerdown', () => root.classList.add('is-down'));
  window.addEventListener('pointerup', () => root.classList.remove('is-down'));

  // delegación de estados: [data-cursor] gana al detectar el elemento
  const resolve = (el: Element | null): CursorState => {
    let node: Element | null = el;
    while (node && node !== document.body) {
      if (node instanceof HTMLElement) {
        const explicit = node.dataset.cursor;
        if (explicit) return explicit.toLowerCase() as CursorState;
        if (node.matches('a, button, [role="button"]')) return 'explore';
      }
      node = node.parentElement;
    }
    return 'default';
  };

  document.addEventListener('pointerover', (e) => {
    const target = e.target as Element | null;
    setState(resolve(target));
  });

  // estados implícitos por zona
  document.addEventListener('pointerover', (e) => {
    const t = e.target as Element | null;
    if (t?.closest('[data-carousel-viewport]')) setState('view');
    if (t?.closest('#sound-btn, [data-replay]')) setState('play');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') setState('explore');
  });

  window.addEventListener('blur', () => setState('default'));
  window.addEventListener('beforeunload', () => cancelAnimationFrame(raf));
}
