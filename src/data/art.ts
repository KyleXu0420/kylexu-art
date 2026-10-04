// The works in the Art section, in the order Kyle sets. The index lays them out from this list — the
// first on the full row, the rest in pairs, and a plate that would sit alone in a row takes the row —
// and each work's page names the next (the last wraps to the first).
import type { ImageMetadata } from 'astro';
import vellumPoster from '../assets/img/art/vellum-poster.jpg';
import cutPoster from '../assets/img/art/cut-clearing.jpg';

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
    slug: 'vellum-stacks',
    title: 'The Vellum Stacks',
    medium: 'Interactive, WebGL, sound',
    year: '2026',
    poster: vellumPoster,
    alt: 'Translucent sheets of paper standing like towers in the dark, lit from a rectangular opening in the roof',
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
];

/** The way on from a work's page: the next work in the list, the last wrapping to the first; with
 *  one work, back to the product work on the home page. */
export function nextAfter(slug: string, homeLine: string) {
  const i = works.findIndex((w) => w.slug === slug);
  if (works.length < 2) return { label: 'Next', title: 'Selected work', to: '/#work', line: homeLine };
  const n = works[(i + 1) % works.length];
  return { label: 'Next work', title: n.title, to: '/art/' + n.slug, line: `${n.year} · ${n.medium}` };
}
