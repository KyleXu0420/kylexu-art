#!/usr/bin/env python3
"""Verify a built site is self-contained: every local reference in HTML/CSS resolves to a file.

    python3 tools/check.py [ROOT]     # default: the repo root; CI passes dist/
"""
import html, re, sys, urllib.parse
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
ATTR_RE = re.compile(r'\b(?:href|src|poster|data-src|data-poster)=["\']([^"\']+)["\']')
SRCSET_RE = re.compile(r'\bsrcset=["\']([^"\']+)["\']')
URL_RE = re.compile(r'url\((?:&quot;|["\'])?([^"\')]+?)(?:&quot;|["\'])?\)')
EXTERNAL = re.compile(r'^(https?:)?//|^(mailto|tel|javascript|data):|^#')

problems, checked, remote = [], 0, set()


def resolve(ref, page):
    ref = html.unescape(ref).split("#", 1)[0].split("?", 1)[0]
    if not ref or EXTERNAL.match(html.unescape(ref)):
        if ref: remote.add(html.unescape(ref).split("?")[0][:80])
        return None
    ref = urllib.parse.unquote(ref)
    base = ROOT if ref.startswith("/") else page.parent
    target = (base / ref.lstrip("/")).resolve()
    if target.is_dir():
        target = target / "index.html"
    if not target.exists() and not target.suffix:
        target = target.with_suffix(".html")
    return target


for page in sorted(list(ROOT.rglob("*.html")) + list(ROOT.rglob("*.css"))):
    if any(p in page.relative_to(ROOT).parts for p in ("tools", ".git", ".claude", "node_modules", "legacy", "src")):
        continue
    text = page.read_text("utf-8", "replace")
    refs = ATTR_RE.findall(text) + URL_RE.findall(text)
    for ss in SRCSET_RE.findall(text):
        refs += [c.strip().split()[0] for c in ss.split(",") if c.strip()]
    for ref in refs:
        t = resolve(ref, page)
        if t is None:
            continue
        checked += 1
        if not t.exists():
            problems.append(f"{page.relative_to(ROOT)}: {ref!r} -> {t.relative_to(ROOT) if ROOT in t.parents else t} MISSING")

print(f"checked {checked} local references")
print("remote origins still referenced:", sorted({urllib.parse.urlsplit(r if r.startswith('http') else 'https:' + r).netloc for r in remote if '//' in r}))
for p in problems:
    print("PROBLEM", p)
sys.exit(1 if problems else 0)
