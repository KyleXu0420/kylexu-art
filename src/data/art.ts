// The works in the Art section, newest first. The index lays them out from this list (an odd count
// opens with the newest on the full row, the rest in pairs) and each work's page names the next.
import type { ImageMetadata } from 'astro';
import vellumPoster from '../assets/img/art/vellum-poster.jpg';

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
];
