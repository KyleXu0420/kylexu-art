#!/usr/bin/env python3
"""
Mirror a published Webflow site into a self-contained static folder.

    python3 tools/mirror.py [SITE_ORIGIN] [OUT_DIR] [CANONICAL_ORIGIN] [EXTRA_SEED_PATH ...]

- Crawls every internal page reachable from "/" (plus any extra seed paths, e.g.
  /portfolio for pages that are published but not linked from the nav), plus the 404 page.
- Downloads every asset hosted on Webflow's CDNs (images, css, js, fonts,
  lottie, video...) into css/ js/ images/ fonts/ files/.
- Self-hosts the Google Fonts requested through Webflow's WebFont loader
  (css/fonts.css + fonts/*.woff2, font-display: swap) so no page depends on
  ajax.googleapis.com / fonts.googleapis.com being reachable.
- Rewrites all references to relative paths so the folder works at any
  base URL (GitHub Pages project site or a custom domain). 404.html is the
  exception: GitHub Pages serves it for any missing URL, so it is root-absolute.
- Keeps og:image / twitter:image absolute, pointed at CANONICAL_ORIGIN.
- Strips <link rel=preconnect> hints, SRI `integrity` attributes (the CSS is
  rewritten, so the old hash would block it) and the free-plan badge trigger.
- Prunes files written by a previous run that are no longer part of the site.

Standard library only. Re-run any time the Webflow site changes.
"""
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from pathlib import Path

ORIGIN = (sys.argv[1] if len(sys.argv) > 1 else "https://www.kylexu.art").rstrip("/")
OUT = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent
CANONICAL = (sys.argv[3] if len(sys.argv) > 3 else "https://www.kylexu.art").rstrip("/")
EXTRA_SEEDS = [s if s.startswith("/") else "/" + s for s in sys.argv[4:]]

REPORT = OUT / "tools" / "mirror-report.json"


def host_variants(origin):
    h = urllib.parse.urlsplit(origin).netloc.lower()
    bare = h.removeprefix("www.")
    return {h, bare, "www." + bare}


# Links in the HTML may point at the crawl origin OR at the canonical domain
# (Webflow users often type absolute custom-domain links); both are internal.
SITE_HOSTS = host_variants(ORIGIN) | host_variants(CANONICAL)

ASSET_HOSTS = (
    "cdn.prod.website-files.com",
    "assets-global.website-files.com",
    "assets.website-files.com",
    "uploads-ssl.webflow.com",
    "d3e54v103j8qbb.cloudfront.net",   # Webflow's jQuery CDN
)
ASSET_RE = re.compile(r"https?://(?:%s)/[^\s\"'<>\\]*" % "|".join(re.escape(h) for h in ASSET_HOSTS))
HARD_STOPS = ("&quot;", "&#34;", "&#39;", "&apos;", "&gt;", ",http")
TRAIL_JUNK = (",", ";", ".", ":")

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 kylexu-art-mirror"

EXT_DIR = {
    "css": "css", "js": "js",
    "woff": "fonts", "woff2": "fonts", "ttf": "fonts", "otf": "fonts", "eot": "fonts",
    "png": "images", "jpg": "images", "jpeg": "images", "gif": "images", "svg": "images",
    "webp": "images", "avif": "images", "ico": "images",
    "mp4": "videos", "webm": "videos", "mov": "videos", "m4v": "videos",
    "json": "lottie",
}
MANAGED_DIRS = ("css", "js", "images", "fonts", "videos", "lottie", "files")

log = lambda *a: print(*a, file=sys.stderr, flush=True)


def fetch(url, allow_404=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.read(), r.geturl()
        except urllib.error.HTTPError as e:
            if e.code == 404 and allow_404:
                return 404, e.read(), url
            if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise


def norm_page_path(href, base_path="/"):
    """Return a site-root-relative page path ('/', '/about', '/projects/x') or None if external."""
    href = html.unescape(href.strip())
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    u = urllib.parse.urlsplit(urllib.parse.urljoin(ORIGIN + base_path, href))
    if u.scheme not in ("http", "https") or u.netloc.lower() not in SITE_HOSTS:
        return None
    path = u.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    if "." in path.rsplit("/", 1)[-1]:      # /sitemap.xml, /foo.pdf: not an HTML page
        return None
    return path


def page_file(path):
    return "index.html" if path == "/" else path.lstrip("/") + ".html"


def depth_prefix(path):
    if path == "/404":
        # GitHub Pages serves 404.html for ANY missing URL, at any depth, so its
        # references must be root-absolute (this assumes the site lives at "/").
        return "/"
    return "../" * (page_file(path).count("/"))


def rel_link(target_path, from_path):
    """Relative href from page `from_path` to page `target_path` (extensionless, GitHub Pages resolves it)."""
    pre = depth_prefix(from_path)
    if target_path == "/":
        return pre if pre else "./"
    return pre + target_path.lstrip("/")


HREF_RE = re.compile(r'(?P<attr>\b(?:href|action|data-href|data-w-href))=(?P<q>["\'])(?P<val>[^"\']*)(?P=q)')


def local_asset_name(url, used):
    u = urllib.parse.urlsplit(url)
    name = urllib.parse.unquote(u.path.rsplit("/", 1)[-1]) or "asset"
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-")
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    folder = EXT_DIR.get(ext, "files")
    local = f"{folder}/{name}"
    if local in used and used[local] != url:
        stem, dot, e = name.rpartition(".")
        digest = hashlib.sha1(url.encode()).hexdigest()[:8]
        local = f"{folder}/{stem or e}-{digest}{dot}{e if stem else ''}"
    used[local] = url
    return local


def find_assets(text):
    found = []
    for m in ASSET_RE.finditer(text):
        raw = m.group(0)
        for stop in HARD_STOPS:               # entity-quoted attrs, comma-joined url lists
            i = raw.find(stop)
            if i > 0:
                raw = raw[:i]
        changed = True
        while changed:
            changed = False
            for junk in TRAIL_JUNK:
                if raw.endswith(junk):
                    raw = raw[: -len(junk)]
                    changed = True
            # css url(...) closes with ')' that is not part of the URL; filenames like
            # "Mockup (4480 px).png" contain balanced parens that are.
            if raw.endswith(")") and raw.count(")") > raw.count("("):
                raw = raw[:-1]
                changed = True
        found.append(raw)
    return found


# ---- Google Fonts self-hosting ---------------------------------------------
WEBFONT_SCRIPT_RE = re.compile(r'<script[^>]*src="https://ajax\.googleapis\.com/ajax/libs/webfont/[^"]*"[^>]*>\s*</script>')
WEBFONT_LOAD_RE = re.compile(r'<script[^>]*>\s*WebFont\.load\(\{(.*?)\}\);?\s*</script>', re.S)
FONT_PRECONNECT_RE = re.compile(r'<link[^>]*href="https://fonts\.g(?:oogleapis|static)\.com"[^>]*/?>')
FONT_FACE_RE = re.compile(r'(?:/\*\s*(?P<subset>[\w-]+)\s*\*/\s*)?@font-face\s*\{(?P<body>.*?)\}', re.S)


def google_families(pages):
    fams = []
    for text in pages.values():
        m = WEBFONT_LOAD_RE.search(text)
        if not m:
            continue
        g = re.search(r'google\s*:\s*\{\s*families\s*:\s*\[(.*?)\]', m.group(1), re.S)
        if g:
            for f in re.findall(r'"([^"]+)"', g.group(1)):
                if f not in fams:
                    fams.append(f)
    return fams


def selfhost_fonts(families, used):
    """Fetch Google's CSS for the WebFont-loader families, download the woff2 files,
    return (css_text, {url: local}) with urls rewritten relative to css/."""
    params, subsets = [], []
    for f in families:                     # "Manrope:400,500,600:cyrillic,latin"
        parts = f.split(":")
        params.append(":".join(parts[:2]))
        if len(parts) > 2:
            subsets += [s for s in parts[2].split(",") if s not in subsets]
    url = "https://fonts.googleapis.com/css?family=" + "|".join(urllib.parse.quote(p, safe=":,") for p in params)
    if subsets:
        url += "&subset=" + ",".join(subsets)
    url += "&display=swap"
    status, body, _ = fetch(url)
    css = body.decode("utf-8")
    files = {}
    out = []
    pos = 0
    for m in FONT_FACE_RE.finditer(css):
        b = m.group("body")
        fam = re.search(r"font-family:\s*'([^']+)'", b)
        sty = re.search(r"font-style:\s*(\w+)", b)
        wgt = re.search(r"font-weight:\s*([\d ]+)", b)
        src = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", b)
        if not (fam and src):
            continue
        ext = src.group(1).rsplit(".", 1)[-1]
        name = "-".join(x for x in [
            fam.group(1).lower().replace(" ", "-"),
            (wgt.group(1).strip().replace(" ", "-") if wgt else "400"),
            (sty.group(1) if sty else "normal"),
            (m.group("subset") or "all"),
        ]) + "." + ext
        # variable fonts (e.g. Manrope) reuse one file for several weights
        local = files.get(src.group(1)) or f"fonts/{name}"
        files[src.group(1)] = local
        used[local] = src.group(1)
        nb = b.replace(src.group(1), "../" + local)
        if "font-display" not in nb:
            nb = nb.rstrip() + "\n  font-display: swap;\n"
        out.append(css[pos:m.start()] + (f"/* {m.group('subset')} */\n" if m.group("subset") else "") + "@font-face {" + nb + "}")
        pos = m.end()
    out.append(css[pos:])
    header = f"/* Self-hosted Google Fonts (OFL): {', '.join(families)} */\n"
    return header + "".join(out), files


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    previous = set()
    if REPORT.exists():
        try:
            previous = set(json.loads(REPORT.read_text()).get("written", []))
        except Exception:
            pass

    # ---- 1. crawl pages -------------------------------------------------
    pages = {}                       # path -> html text
    queue = deque(["/"] + EXTRA_SEEDS)
    seen = set(queue)
    while queue:
        path = queue.popleft()
        status, body, final = fetch(ORIGIN + path)
        text = body.decode("utf-8", "replace")
        pages[path] = text
        log(f"page  {status} {path}  ({len(body)} B)")
        for m in HREF_RE.finditer(text):
            p = norm_page_path(m.group("val"), path)
            if p and p not in seen:
                seen.add(p)
                queue.append(p)

    status, body, _ = fetch(ORIGIN + "/__mirror_probe_404__", allow_404=True)
    if status == 404 and body:
        pages["/404"] = body.decode("utf-8", "replace")
        log(f"page  404 /404  ({len(body)} B)  [custom 404 page]")

    # ---- 2. collect assets from HTML ------------------------------------
    used = {}
    asset_map = {}                   # canonical url (unescaped) -> local path
    for path, text in pages.items():
        for raw in find_assets(text):
            url = html.unescape(raw)
            if url not in asset_map:
                asset_map[url] = local_asset_name(url, used)

    # ---- 3. download assets; scan css (and js) for nested assets --------
    downloaded = {}
    failed = {}
    pending = deque(asset_map.items())
    js_refs = {}
    while pending:
        url, local = pending.popleft()
        if url in downloaded:
            continue
        dl_url = url
        if "cloudfront.net" in url:                       # strip ?site=... cache-buster
            dl_url = url.split("?", 1)[0]
        try:
            status, body, _ = fetch(dl_url)
        except urllib.error.HTTPError as e:
            log(f"asset {e.code} FAILED {local}  <- {url}")
            failed[url] = e.code
            continue
        downloaded[url] = body
        log(f"asset {status} {local}  ({len(body)} B)")
        if local.startswith("css/"):
            css = body.decode("utf-8", "replace")
            for raw in find_assets(css):
                u2 = html.unescape(raw)
                if u2 not in asset_map:
                    asset_map[u2] = local_asset_name(u2, used)
                    pending.append((u2, asset_map[u2]))
        elif local.startswith("js/"):
            refs = sorted(set(find_assets(body.decode("utf-8", "replace"))))
            if refs:
                js_refs[local] = refs
    for url in failed:
        asset_map.pop(url, None)

    # ---- 3b. Google Fonts -> fonts/ + css/fonts.css ---------------------
    families = google_families(pages)
    fonts_css, font_files = ("", {})
    if families:
        fonts_css, font_files = selfhost_fonts(families, used)
        for url, local in font_files.items():
            status, body, _ = fetch(url)
            downloaded[url] = body
            log(f"font  {status} {local}  ({len(body)} B)")
        log(f"fonts: {len(font_files)} files for {families}")

    # ---- 4. write assets (css rewritten to relative urls) ---------------
    written = set()

    def write(rel, data):
        dest = OUT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        written.add(rel)

    for url, local in asset_map.items():
        body = downloaded[url]
        if local.startswith("css/"):
            css = body.decode("utf-8", "replace")
            for u2, l2 in sorted(asset_map.items(), key=lambda kv: -len(kv[0])):
                css = css.replace(u2, "../" + l2)
            body = css.encode("utf-8")
        write(local, body)
    for url, local in font_files.items():
        write(local, downloaded[url])
    if fonts_css:
        write("css/fonts.css", fonts_css.encode("utf-8"))

    # ---- 5. rewrite + write pages ---------------------------------------
    by_len = sorted(asset_map.items(), key=lambda kv: -len(kv[0]))
    canon_host = urllib.parse.urlsplit(CANONICAL).netloc
    leftover_links = {}
    for path, text in pages.items():
        pre = depth_prefix(path)
        out = text
        # drop preconnect hints to hosts we no longer use
        out = re.sub(r'<link[^>]*href="https://cdn\.prod\.website-files\.com"[^>]*/?>', "", out)
        # data-wf-status="1" (free plan) / a .webflow.io data-wf-domain make webflow.js inject
        # its badge; we are self-hosting, so pin the domain and drop the flag.
        out = re.sub(r'\s+data-wf-status="[^"]*"', "", out, count=1)
        out = re.sub(r'data-wf-domain="[^"]*"', f'data-wf-domain="{canon_host}"', out, count=1)
        # SRI hashes no longer match rewritten css
        out = re.sub(r'\s+integrity="[^"]*"', "", out)
        # Google Fonts: blocking loader script -> self-hosted stylesheet
        if fonts_css:
            out = WEBFONT_SCRIPT_RE.sub("", out)
            out = WEBFONT_LOAD_RE.sub("", out)
            out = FONT_PRECONNECT_RE.sub("", out)
            link = f'<link href="{pre}css/fonts.css" rel="stylesheet" type="text/css"/>'
            m = re.search(r'<meta charset="[^"]*"\s*/?>', out)
            out = out[:m.end()] + link + out[m.end():] if m else out.replace("<head>", "<head>" + link, 1)
        # og:image / twitter:image stay absolute, on the canonical domain
        def abs_meta(m):
            tag = m.group(0)
            for u, l in by_len:
                tag = tag.replace(html.escape(u, quote=True), f"{CANONICAL}/{l}").replace(u, f"{CANONICAL}/{l}")
            return tag
        out = re.sub(r'<meta[^>]*(?:og:image|twitter:image)[^>]*>', abs_meta, out)
        # every remaining CDN reference -> relative local path
        for u, l in by_len:
            out = out.replace(html.escape(u, quote=True), pre + l).replace(u, pre + l)
        # internal links -> relative
        def relink(m):
            p = norm_page_path(m.group("val"), path)
            if p is None:
                return m.group(0)
            frag = ""
            raw = html.unescape(m.group("val"))
            if "#" in raw:
                frag = "#" + raw.split("#", 1)[1]
            return f'{m.group("attr")}={m.group("q")}{rel_link(p, path)}{frag}{m.group("q")}'
        out = HREF_RE.sub(relink, out)
        stray = sorted({m.group("val") for m in HREF_RE.finditer(out)
                        if urllib.parse.urlsplit(html.unescape(m.group("val"))).netloc.lower() in SITE_HOSTS})
        if stray:
            leftover_links[page_file(path)] = stray
        write(page_file(path), out.encode("utf-8"))
        log(f"wrote {page_file(path)}")

    # ---- 6. prune files from a previous run that are gone now -----------
    pruned = []
    for rel in sorted(previous - written):
        p = OUT / rel
        if p.is_file() and (rel.split("/")[0] in MANAGED_DIRS or rel.endswith(".html")):
            p.unlink()
            pruned.append(rel)
            log(f"pruned {rel}")
    for d in MANAGED_DIRS:
        dp = OUT / d
        if dp.is_dir() and not any(dp.iterdir()):
            dp.rmdir()

    # ---- 7. report -----------------------------------------------------
    leftovers = {}
    for f in list(OUT.rglob("*.html")) + list(OUT.rglob("*.css")):
        if any(part in ("tools", ".git", ".claude") for part in f.relative_to(OUT).parts):
            continue
        hits = sorted(set(find_assets(f.read_text("utf-8", "replace"))))
        if hits:
            leftovers[str(f.relative_to(OUT))] = hits
    report = {
        "origin": ORIGIN,
        "canonical": CANONICAL,
        "seeds": ["/"] + EXTRA_SEEDS,
        "pages": sorted(pages),
        "assets": len(asset_map),
        "fonts": sorted(font_files.values()),
        "failed_downloads": failed,
        "leftover_cdn_refs_in_html_css": leftovers,
        "leftover_absolute_internal_links": leftover_links,
        "cdn_refs_inside_js_(not_rewritten)": js_refs,
        "pruned": pruned,
        "written": sorted(written),
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2))
    summary = {k: v for k, v in report.items() if k != "written"}
    log(json.dumps(summary, indent=2))
    if failed or leftovers or leftover_links:
        log("WARNING: mirror is not fully self-contained, see report above")
        sys.exit(1)


if __name__ == "__main__":
    main()
