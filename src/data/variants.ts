/**
 * Artistas representados — datos reutilizables para carrusel, luz3D y cursor.
 * Roster real de la web oficial de Charohergar Agency (4 artistas).
 */

/** Ruta pública con base relativa (funciona en GitHub Pages bajo subcarpeta). */
export const asset = (p: string): string =>
  import.meta.env.BASE_URL + p.replace(/^\//, '');

export interface Variant {
  name: string;
  color: string;
  image: string;
  webp: string;
  genre: string;
  description: string;
  href?: string;
  /** Presskit oficial en PDF (ruta pública). */
  presskit: string;
}

export const variants: Variant[] = [
  {
    name: 'Anora Kito',
    genre: 'Indie Pop',
    color: '#c9a227',
    image: asset('/assets/img/artists/anora-kito.jpg'),
    webp: asset('/assets/img/artists/anora-kito.webp'),
    description: 'Indie Pop. Un proyecto de autor con identidad propia.',
    presskit: asset('/assets/presskit/anora-kito.pdf'),
  },
  {
    name: 'Corazón Inverso',
    genre: 'Indie Rock',
    color: '#4ad9c4',
    image: asset('/assets/img/artists/corazon-inverso.jpg'),
    webp: asset('/assets/img/artists/corazon-inverso.webp'),
    description: 'Indie Rock. Cuatro músicos, una sola dirección.',
    presskit: asset('/assets/presskit/corazon-inverso.pdf'),
  },
  {
    name: 'Dany Mixtika',
    genre: 'Pop · Electrónica',
    color: '#e0bd44',
    image: asset('/assets/img/artists/dany-mixtika.jpg'),
    webp: asset('/assets/img/artists/dany-mixtika.webp'),
    description: 'Pop y electrónica con base en directo.',
    presskit: asset('/assets/presskit/dany-mixtika.pdf'),
  },
  {
    name: 'Jesús Martí',
    genre: 'Pop · Indie',
    color: '#b9b2a6',
    image: asset('/assets/img/artists/jesus-marti.jpg'),
    webp: asset('/assets/img/artists/jesus-marti.webp'),
    description: 'Pop e indie con acabado de estudio.',
    presskit: asset('/assets/presskit/jesus-marti.pdf'),
  },
];

/** Imágenes de escenario (ambiente) — precarga opcional. */
export const stageImages = [
  '/assets/img/stage/concert-c02.webp',
  '/assets/img/stage/concert-c04.webp',
  '/assets/img/stage/concert-c06.webp',
  '/assets/img/stage/concert-c07.webp',
  '/assets/img/stage/concert-c13.webp',
].map(asset);
