#!/usr/bin/env python3
"""check-site.py — three checks on the hand-written site, each with a control fixture.

  theme-parity      if tokens.css has a dark theme (a prefers-color-scheme block and a
                    [data-theme="dark"] block), every colour role authored in light is authored
                    again (not restated) in both; a single-theme file passes
  hardcoded-colour  no colour literal outside the @primitives block of tokens.css — in any
                    src/**/*.css or *.astro (the <meta name="theme-color"> line is the one exception)
  dead-class        every class in the built Astro pages has a rule in src/**/*.css, and every
                    class selector in src/**/*.css appears in some built Astro page
  needs-kyle        no "NEEDS KYLE" mark survives into the built pages

Each check runs its control first — a planted defect it must catch and a near-miss it must leave
alone. If a control fails, the tool prints only that and exits 1: it never reports reassuringly.

    python3 tools/check-site.py [dist]
"""
import re, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DIST = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else REPO / 'dist'
SRC = REPO / 'src'
COLOR = re.compile(r'#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\boklab\(')


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', lambda m: ' ' * len(m.group(0)), css, flags=re.S)


def props(block):
    return {k.strip(): v.strip() for k, v in
            (d.split(':', 1) for d in block.split(';') if ':' in d)}


def root_blocks(css):
    """(selector, body) for every top-level and @media-nested rule."""
    out, i = [], 0
    while True:
        j = css.find('{', i)
        if j < 0: break
        sel = css[i:j].strip(); depth, k = 1, j + 1
        while k < len(css) and depth:
            depth += {'{': 1, '}': -1}.get(css[k], 0); k += 1
        body = css[j + 1:k - 1]
        if sel.startswith('@media'):
            for s, b in root_blocks(body): out.append((sel + ' ' + s, b))
        elif not sel.startswith('@'):
            out.append((sel, body))
        i = k
    return out


# ---------------------------------------------------------------- checks (pure)
def theme_parity(tokens_css):
    css = strip_comments(tokens_css)
    prims = props(re.search(r':root\s*\{(.*?)\}', css, re.S).group(1))
    blocks = root_blocks(css)
    light = {}
    for sel, body in blocks:
        if sel == ':root': light.update(props(body))
    dark = next((props(b) for s, b in blocks if s.strip() == ':root[data-theme="dark"]'), {})
    media = next((props(b) for s, b in blocks if 'prefers-color-scheme' in s and 'not([data-theme="light"])' in s), {})
    roles = {k: v for k, v in light.items() if v.startswith('var(--') and re.match(r'var\((--[\w-]+)\)', v).group(1) in prims}
    findings = []
    if not dark and not media: return len(roles), []   # one theme: nothing to keep in step
    for k in sorted(roles):
        for name, theme in (('dark', dark), ('media', media)):
            if k not in theme: findings.append(f'{k}: no {name} value')
            elif theme[k] == light[k]: findings.append(f'{k}: {name} restates light verbatim (not authored)')
    for k in sorted(set(dark) | set(media)):
        if k.startswith('--') and k not in light: findings.append(f'{k}: in a theme block but not a light role')
    return len(roles), findings


def hardcoded_colour(files):
    """files: {path: text}. tokens.css may hold literals only between @primitives and @end-primitives."""
    findings = []
    for path, text in files.items():
        body = text
        if path.endswith('tokens.css'):
            a, b = text.find('/* @primitives */'), text.find('/* @end-primitives */')
            body = text[:a] + ' ' * (b - a) + text[b:]
        for n, line in enumerate(strip_comments(body).splitlines(), 1):
            if 'theme-color' in line: continue          # <meta name="theme-color"> cannot take var()
            if COLOR.search(line): findings.append(f'{path}:{n}: {line.strip()[:80]}')
    return findings


def dead_classes(css_texts, html_texts):
    css = strip_comments('\n'.join(css_texts))
    ruled = set(re.findall(r'\.([a-zA-Z_][\w-]*)', re.sub(r'\{[^{}]*\}', '{}', css)))
    used = set()
    for h in html_texts:
        for attr in re.findall(r'class="([^"]*)"', h): used.update(attr.split())
    used = {c for c in used if not c.startswith('astro-')}
    state = {'on', 'cursor-on'}   # applied by the cursor-label script; never in markup
    return sorted(used - ruled - state), sorted(ruled - used - state)


# ---------------------------------------------------------------- controls
def controls():
    good = ('/* @primitives */\n:root{--a-1:#111;--b-1:#eee;}\n/* @end-primitives */\n'
            ':root{--fg:var(--a-1);--bg:var(--b-1);--t:1ms;}\n'
            '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--fg:var(--b-1);--bg:var(--a-1);}}\n'
            ':root[data-theme="dark"]{--fg:var(--b-1);--bg:var(--a-1);}\n')
    n, f = theme_parity(good); assert n == 2 and f == [], ('parity near-miss', f)
    _, f = theme_parity(good.replace(':root[data-theme="dark"]{--fg:var(--b-1);--bg:var(--a-1);}', ':root[data-theme="dark"]{--fg:var(--b-1);}'))
    assert f == ['--bg: no dark value'], ('parity planted defect', f)
    _, f = theme_parity(good.replace(':root[data-theme="dark"]{--fg:var(--b-1);', ':root[data-theme="dark"]{--fg:var(--a-1);'))
    assert f and 'restates' in f[0], ('parity restated defect', f)
    n, f = theme_parity(good.split('@media')[0]); assert n == 2 and f == [], ('parity single theme', f)
    assert hardcoded_colour({'x.css': 'a{color:var(--fg)} /* #fff in a comment */', 'tokens.css': good}) == []
    assert hardcoded_colour({'x.css': 'a{color:#fff}'}) != [], 'hex planted defect'
    assert hardcoded_colour({'x.astro': '<meta name="theme-color" content="#F3F0E8" />'}) == []
    u, r = dead_classes(['.a{} .b:hover{} .c .d{}'], ['<p class="a b astro-xyz">'])
    assert u == [] and r == ['c', 'd'], ('dead-class', u, r)
    u, r = dead_classes(['.a{}'], ['<p class="a zz">']); assert u == ['zz'], ('dead-class planted', u)


# ---------------------------------------------------------------- run
def main():
    try:
        controls()
    except AssertionError as e:
        print('CONTROL FAILED — refusing to report:', e); sys.exit(1)

    css_files = {str(p.relative_to(REPO)): p.read_text('utf-8') for p in sorted(SRC.rglob('*.css'))}
    astro_files = {str(p.relative_to(REPO)): p.read_text('utf-8') for p in sorted(SRC.rglob('*.astro'))}
    pages = [p.read_text('utf-8') for p in sorted(DIST.rglob('*.html')) if 'name="generator" content="Astro' in p.read_text('utf-8')]

    ok = True
    n, f = theme_parity(css_files['src/styles/tokens.css'])
    print(f'parity    {n} colour roles; {"one theme" if "data-theme" not in css_files["src/styles/tokens.css"] else ("dark + media blocks complete" if not f else "dark + media blocks INCOMPLETE")}')
    for x in f: print('   ', x); ok = False

    f = hardcoded_colour({**css_files, **astro_files})
    print(f'hex       {len(f)} colour literal(s) outside the primitives block across {len(css_files) + len(astro_files)} source files')
    for x in f: print('   ', x); ok = False

    unruled, unused = dead_classes(css_files.values(), pages)
    print(f'dead      {len(pages)} astro page(s): {len(unruled)} class(es) without a rule, {len(unused)} rule(s) without markup')
    for x in unruled: print('    no rule for .' + x); ok = False
    for x in unused: print('    unused rule .' + x); ok = False

    nk = [p for p in pages if 'NEEDS KYLE' in p]
    print(f'needs-kyle {len(nk)} page(s) still carry a NEEDS KYLE mark')
    if nk: ok = False

    print('fixtures  4 checks · controls held')
    print('RESULT', 'pass' if ok else 'FAIL')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
