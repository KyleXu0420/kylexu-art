# kylexu.art

Kyle Xu's portfolio, hosted on GitHub Pages. Being rebuilt page by page as a hand-written
[Astro](https://astro.build) static site; the Webflow-era mirror lives in `legacy/` and keeps
serving every URL until its page is replaced.

## How the build works

```
astro build            →  dist/  (only the routes that exist in src/pages)
tools/overlay-legacy   →  copies legacy/** into dist/ where dist/ has no such path
tools/check.py dist    →  every local href/src/srcset/url() in dist/ resolves
```

Precedence is deterministic: the moment `src/pages/<route>` exists, that URL is served by
Astro; otherwise by the mirror. Deleting a file from `legacy/` is the last step of replacing
a page, never the first. `.github/workflows/pages.yml` runs this on every push to `main`
and deploys `dist/` with GitHub Actions.

```bash
npm ci
npm run build          # dist/
npm run check          # python3 tools/check.py dist
npm run preview        # python3 tools/serve.py 8000 dist  — resolves /about → about.html like Pages
npm run dev            # Astro dev server (only the new pages; legacy is not overlaid in dev)
```

`SITE_BASE=/kylexu-art` is set in CI while the preview lives at
`https://kylexu0420.github.io/kylexu-art/`. Remove it when `www.kylexu.art` points at Pages.

## Layout

| Path | What |
|------|------|
| `src/pages/` | Astro routes (none yet — PR 0 is the toolchain) |
| `legacy/` | the Webflow mirror, byte-for-byte: `index.html`, `about.html`, `projects/*`, `404.html`, `css/ js/ images/ fonts/`, and meta-refresh stubs for the old `/cases/*`, `/portfolio`, `/categories/*` URLs |
| `tools/overlay-legacy.mjs` | the overlay step described above |
| `tools/check.py` | reference checker (`[ROOT]` argument, default repo root) |
| `tools/serve.py` | local preview with GitHub-Pages URL semantics (`[PORT] [DIR]`) |
| `tools/mirror.py` | how the snapshot was taken from Webflow. Kept as a record; **do not run it** — `legacy/` is hand-maintained since 2026-09-13 |

Legacy pages use extensionless, relative links (`about`, `projects/heygen`, `../`), so they work
at any base URL. `legacy/404.html` is root-absolute and only renders correctly on the custom
domain; the Astro `404` replaces it in PR 1.

## Replacement order

PR 0 toolchain (this) → PR 1 tokens, layout, nav, footer, 404 → PR 2 home → PR 3 about →
PR 4 `/projects/temper`, `/projects/dify` → PR 5 heygen, eaton → PR 6 redirects →
PR 7 delete `legacy/` → PR 8 checkers in CI. Each PR leaves the site fully working; rollback
is re-running the previous deployment.

## Moving the domain to GitHub Pages

Do it in this order — the old Webflow-hosted site sent a one-year HSTS header, so returning
visitors get a hard certificate error during the window between DNS switch and GitHub
issuing the cert.

1. Settings → Pages → Custom domain: `www.kylexu.art` (this commits a `CNAME` file; put it
   in `public/` so the build keeps it).
2. At the DNS provider: `www` → CNAME `kylexu0420.github.io`; apex `kylexu.art` → A records
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   (and AAAA `2606:50c0:8000::153` … `8003::153` if IPv6 is supported).
3. Wait until the Pages settings page shows the certificate as issued, then tick
   **Enforce HTTPS**. Keep the Webflow site published until then so DNS can be rolled back.
4. Remove `SITE_BASE` from the workflow. Only then unpublish / downgrade on Webflow.
