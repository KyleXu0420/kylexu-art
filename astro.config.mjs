// @ts-check
import { defineConfig } from 'astro/config';

// While the site is previewed at https://kylexu0420.github.io/kylexu-art/ the CI sets
// SITE_BASE=/kylexu-art. Once www.kylexu.art points at GitHub Pages, drop that env and
// the base becomes "/". Legacy pages use relative links, so they work under either.
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  site: 'https://www.kylexu.art',
  base,
  trailingSlash: 'never',
  build: {
    // 'preserve': a page file stays a file (about.astro → about.html, as the legacy mirror's
    // /about), and a folder's index stays an index (art/index.astro → art/index.html), so a
    // section with pages under it (/art, /art/<work>) never has a file and a folder of one name
    format: 'preserve',
  },
});
