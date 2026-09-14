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
    // emit about.html (not about/index.html) so /about resolves exactly as the legacy
    // mirror does on GitHub Pages, and tools/check.py keeps passing on dist/
    format: 'file',
  },
});
