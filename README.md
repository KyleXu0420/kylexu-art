# kylexu.art

Static mirror of the Webflow site **https://www.kylexu.art**, self-hosted on GitHub Pages.
No request goes to Webflow or Google at runtime: all CSS/JS/images and the two web fonts
(Lato, Manrope — OFL) are served from this repo.

## Layout

| Path | URL |
|------|-----|
| `index.html` | `/` |
| `about.html` | `/about` |
| `projects/heygen.html`, `projects/eaton.html` | `/projects/…` (linked from the homepage) |
| `portfolio.html`, `cases/*.html`, `categories/*.html` | redirect stubs (meta-refresh + canonical) for old Webflow CMS URLs that were never linked from the nav |
| `404.html` | custom not-found page |
| `css/` `js/` `images/` `fonts/` | assets |
| `tools/` | mirror / check / preview scripts (not part of the site) |

Internal links are extensionless and relative (`about`, `projects/heygen`, `../`), so the
folder works both at `https://<user>.github.io/<repo>/` and at the root of a custom domain
(GitHub Pages serves `about.html` for `/about`). `404.html` is the one exception: it uses
root-absolute paths because Pages serves it for any missing URL, so it only renders
correctly on the custom domain.

## Maintenance

Since 2026-09-13 this mirror is **hand-maintained**: the P0 fixes (stale copy, the nav duplicated
inside every project card, the page-load overlay, dead links, viewport-scaled type on the case
pages, oversized images, redirect stubs for the old `/cases/*` and `/portfolio` URLs) were made
directly in these files. Do not re-run `tools/mirror.py` against Webflow — it would overwrite
them. It is kept only as a record of how the snapshot was taken. `tools/check.py` still verifies
that every local reference resolves; run it before pushing.

The next step is a page-by-page rebuild (Astro, same URLs) with this folder kept as `legacy/`
until each page is replaced — see the plan in `~/Desktop/kylexu-art-plan/`.

## Preview locally

```bash
python3 tools/serve.py 8000
```

`tools/serve.py` resolves extensionless URLs the same way GitHub Pages does.

## Moving the domain to GitHub Pages

Do it in this order — the live site sends a one-year HSTS header, so returning visitors get
a hard certificate error during the window between DNS switch and GitHub issuing the cert.

1. Settings → Pages → Custom domain: `www.kylexu.art` (this commits a `CNAME` file).
2. At the DNS provider: `www` → CNAME `kylexu0420.github.io`; apex `kylexu.art` → A records
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   (and AAAA `2606:50c0:8000::153` … `8003::153` if IPv6 is supported).
3. Wait until the Pages settings page shows the certificate as issued, then tick
   **Enforce HTTPS**. Keep the Webflow site published until then so DNS can be rolled back.
4. Only then unpublish / downgrade on Webflow.
