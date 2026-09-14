/** Join a site-root path ("/about", "/") onto Astro's base, which is "/" locally and
 *  "/kylexu-art" (or "/kylexu-art/preview/pr-n") on the GitHub Pages preview. Legacy pages
 *  use relative links; new pages go through this so the base can change in one place. */
export function href(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : '/' + path;
  return p === '/' ? (base || '/') : base + p;
}

/** True when `path` is the page being rendered (base-insensitive, extension-insensitive). */
export function isCurrent(pathname: string, path: string): boolean {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const here = pathname.replace(base, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  return here === path;
}
