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
| `portfolio.html`, `cases/*.html`, `categories/*.html` | published on Webflow but not linked from the nav — kept so old links / search results keep working; delete the files if you do not want them |
| `404.html` | custom not-found page |
| `css/` `js/` `images/` `fonts/` | assets |
| `tools/` | mirror / check / preview scripts (not part of the site) |

Internal links are extensionless and relative (`about`, `projects/heygen`, `../`), so the
folder works both at `https://<user>.github.io/<repo>/` and at the root of a custom domain
(GitHub Pages serves `about.html` for `/about`). `404.html` is the one exception: it uses
root-absolute paths because Pages serves it for any missing URL, so it only renders
correctly on the custom domain.

## Re-sync from Webflow

Edit in the Webflow Designer, publish, then:

```bash
python3 tools/mirror.py https://www.kylexu.art . https://www.kylexu.art /portfolio
python3 tools/check.py
git add -A && git commit -m "Sync from Webflow" && git push
```

Arguments: `SITE_ORIGIN OUT_DIR CANONICAL_ORIGIN [extra seed paths…]`. If the Webflow
project is moved to the free Starter plan and publishes to `xxx.webflow.io`, pass that as
`SITE_ORIGIN`; `CANONICAL_ORIGIN` stays `https://www.kylexu.art` (used for `og:image`
URLs, for recognising absolute links to the custom domain, and to keep the Webflow badge
script from firing). Extra seed paths are for pages that are published but not linked from
anywhere. The script prunes files it wrote on a previous run that are no longer needed,
exits non-zero if anything still points at Webflow, and writes `tools/mirror-report.json`.

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
