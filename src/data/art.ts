// The works in the Art section, in the order Kyle sets. The index stacks them in this order, each on
// the full row, and each work's page names the next (the last wraps to the first).
import type { ImageMetadata } from 'astro';
import droploftPoster from '../assets/img/art/droploft/mark-dark.png';
import vellumPoster from '../assets/img/art/vellum-poster.jpg';
import cutPoster from '../assets/img/art/cut-clearing.jpg';
import walkPoster from '../assets/img/art/walk-grid.jpg';

export interface Work {
  slug: string;              // the page at /art/<slug>
  title: string;
  medium: string;            // the tombstone's middle: what it is made of, in a few words
  year: string;
  poster: ImageMetadata;     // the plate's still, cropped to 16:10 by the plate
  alt: string;
  loop?: string;             // a silent excerpt that plays on the plate while it is in view (site-root path)
}

export const works: Work[] = [
  {
    slug: 'droploft-motion',
    title: 'Droploft motion identity',
    medium: 'Motion identity, product states, code',
    year: '2026',
    poster: droploftPoster,
    alt: 'The Droploft mark: eleven rounded white bars tracing a raindrop, with a bead on each side, on a dark green ground',
    loop: '/art/droploft-motion/hero.mp4',
  },
  {
    slug: 'vellum-stacks',
    title: 'The Vellum Stacks',
    medium: 'Interactive, WebGL, sound',
    year: '2026',
    poster: vellumPoster,
    alt: 'An endless dark concrete hall under a coffered ceiling, a far row of open coffers letting light down onto hanging paper',
    loop: '/art/vellum-stacks/loop.mp4',
  },
  {
    slug: 'cut-deep-enough',
    title: 'Cut Deep Enough',
    medium: 'Interactive, WebGL, sound',
    year: '2026',
    poster: cutPoster,
    alt: 'A dark stone floor seen from above, the words CUT DEEP ENOUGH TO HOLD THE RAIN cut into it, an ellipse of light falling across them',
  },
  {
    slug: 'a-walk-through-history',
    title: 'A Walk Through History',
    medium: 'Interactive, Canvas, sound',
    year: '2026',
    poster: walkPoster,
    alt: 'Sixteen small pictures in a grid, each in a different period medium — manuscript, fresco, woodcut, sea chart, red-figure vase, gold-leaf screen — with a hooded figure in each',
  },
];

/** The way on from a work's page: the next work in the list, the last wrapping to the first; with
 *  one work, back to the product work on the home page. */
export function nextAfter(slug: string, homeLine: string) {
  const i = works.findIndex((w) => w.slug === slug);
  if (works.length < 2) return { label: 'Next', title: 'Selected work', to: '/#work', line: homeLine };
  const n = works[(i + 1) % works.length];
  return { label: 'Next work', title: n.title, to: '/art/' + n.slug, line: `${n.year} · ${n.medium}` };
}
