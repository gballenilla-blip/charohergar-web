/**
 * Datos de marca — fuente única de verdad.
 * No inventar datos: todo aquí proviene de la web oficial de Charohergar Agency.
 */
export const brand = {
  name: 'Charohergar',
  suffix: 'Agency',
  tagline: 'Management y Comunicación',
  firstLine: 'Artistas musicales, grupos musicales, música en general',
  headline: ['Tu obra,', 'bien representada.'],
  subheadline:
    'Management, comunicación y booking para artistas y grupos que quieren crecer con estructura. Un solo interlocutor, un solo plan, cero promesas vacías.',
  contact: {
    email: 'charo@hergaragency.es',
    phoneLabel: '+34 649 33 70 77',
    phoneHref: '+34649337077',
    whatsapp: 'https://wa.me/34649337077',
    instagram: 'https://www.instagram.com/charo_hergar',
    instagramLabel: '@charo_hergar',
  },
} as const;

/** Paleta oficial (extraída del CSS de la web). */
export const palette = {
  bg: '#121212',
  bg2: '#0b0b0b',
  gold: '#c9a227',
  gold2: '#e0bd44',
  ink: '#f5f2ec',
  ink2: '#b9b2a6',
  ink3: '#7d766b',
  neon: '#4ad9c4',
  logoInk: '#14110f',
} as const;
