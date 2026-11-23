#!/usr/bin/env python3
"""scripts/ds-contrast-audit.py — DS token-matrix WCAG audit (HK-03/DS-02).
Reads design-tokens/tokens.json, computes contrast ratios for every
foreground x background pair the components actually use, and flags pairs
below AA (4.5:1 normal text, 3:1 large text / icons).
"""
import io, json, sys

def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))

def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(h):
    r, g, b = (lin(x) for x in hex_rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = lum(a), lum(b)
    lo, hi = min(la, lb), max(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def tint(bg, fg, pct):
    """approximate a /10 tailwind tint: bg mixed with fg at pct over surface"""
    r1, g1, b1 = hex_rgb(bg)
    r2, g2, b2 = hex_rgb(fg)
    return '#%02x%02x%02x' % tuple(round((1 - pct) * c1 + pct * c2) * 255 if False else round(((1 - pct) * c1 + pct * c2) * 255) for c1, c2 in ((r1, r2), (g1, g2), (b1, b2)))

tokens = json.load(io.open('apps/web/design-tokens/tokens.json', encoding='utf-8'))
flat = {}
def walk(node, path):
    if isinstance(node, dict):
        if '$value' in node:
            flat['.'.join(path)] = node['$value']
        else:
            for k, v in node.items():
                walk(v, path + [k])
walk(tokens, [])

SURFACES = ['background', 'surface', 'surface-elevated', 'muted', 'accent', 'card', 'popover']
TEXT_FGS = ['foreground', 'text-primary', 'text-secondary', 'text-muted', 'muted-foreground']
SOLID = [  # foreground-on-own-color badge/button pairs
    ('info-foreground', 'info'), ('warning-foreground', 'warning'),
    ('danger-foreground', 'danger'), ('neutral-foreground', 'neutral'),
    ('accent-foreground', 'accent'), ('primary-foreground', 'primary'),
    ('secondary-foreground', 'secondary'),
]
SOFT = [  # soft-fg on its /10 tint over surface (chip pattern)
    ('danger-soft-fg', 'danger'), ('warning-soft-fg', 'warning'),
    ('info-soft-fg', 'info'), ('accent-soft-fg', 'accent'),
]

fails = []
lines = []
for theme in ('light', 'dark'):
    t = lambda k: flat.get(f'{theme}.{k}', '#000000')
    for fg in TEXT_FGS:
        for bg in SURFACES:
            r = ratio(t(fg), t(bg))
            ok = r >= 4.5
            if not ok:
                fails.append((theme, fg, bg, r))
            lines.append(f"{'PASS' if ok else 'FAIL'} {theme} {fg} on {bg} = {r:.2f}:1")
    for fg, bg in SOLID:
        r = ratio(t(fg), t(bg))
        ok = r >= 4.5
        if not ok:
            fails.append((theme, fg, bg, r, 'large?'))
        lines.append(f"{'PASS' if ok else 'FAIL'} {theme} {fg} on {bg} = {r:.2f}:1")
    for fg, base in SOFT:
        chip_bg = tint(t('surface'), t(base), 0.12)
        r = ratio(t(fg), chip_bg)
        r2 = ratio(t(fg), t('surface'))
        ok = r >= 4.5 and r2 >= 4.5
        if not ok:
            fails.append((theme, fg, base + '-tint', r))
        lines.append(f"{'PASS' if ok else 'FAIL'} {theme} {fg} on {base}/10-chip = {r:.2f}:1 (on surface {r2:.2f}:1)")

print('\n'.join(lines))
print(f"\n{len(lines) - len(fails)}/{len(lines)} pairs pass AA")
if fails:
    print("FAILING:")
    for f in fails:
        print('  ', f[0], f[1], 'on', f[2], f'{f[3]:.2f}:1')
sys.exit(1 if fails else 0)
