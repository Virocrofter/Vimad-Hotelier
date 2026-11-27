# Marketing design policy (DS-M1)

The marketing site is a persuasion medium with its own token sheet — the **Ember & Paper
Marketing Edition**. The product keeps HQ-0 untouched (two-system doctrine). One bridge
only: product UI crops shown on the site are real HQ-0 components.

## Source of truth

- `design-tokens/marketing-tokens.json` is the only place raw values exist. Generated
  `src/styles/generated/marketing.css` is a build artifact — never hand-edit.
- Rebuild: `npm run tokens:build:marketing` (from apps/web). Gate: `npm run tokens:check:marketing`.
- Raw hex in marketing CSS/components is banned — consume `var(--mk-*)`.

## Rules (blueprint §2, §4)

1. **Image-free:** CSS/card compositions only — no stock photos, no illustration packs.
2. **Ember (#E4572E) is for primary CTAs only** — one ember action per viewport.
   Secondary actions are hairline ghosts. Gold = premium/chain marks. Teal appears only
   around real HQ-0 UI crops. Magenta is reserved (revenue-proof cards, post-pilot).
3. **Type:** Sora 600/700 display (tight tracking), Inter 15px body, JetBrains Mono +
   `tabular-nums` for every ZAR figure and every 01/02/03 step numeral.
4. **Buttons:** full pills (9999px), 11px uppercase labels, tracking +0.08em. Cards keep
   8–12px corners — never pills.
5. **Motion:** the locked Motion-only stack (see ux-constitution) — 220ms crossfades,
   bento reveals once:true, reduced-motion respected.
6. **Scope:** every rule above applies only under `[data-vimad-marketing]`. Product pages
   follow HQ-0 policy (POLICY.md).
7. **Claims:** all copy must pass `npm run lint:claims` before merge.

## Status

v1.0.0 — surfaces, accents, type, radius. Dark-mode marketing sheet is a later decision;
the product dark theme is unaffected by this file.
