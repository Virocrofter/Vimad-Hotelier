# Design tokens changelog

## 0.1.1 — 2026-11-23 (HK-03 contrast PATCH)

- Value-only tweaks to reach WCAG AA 4.5:1 across the token matrix (scripts/ds-contrast-audit.py, 92 pairs):
  - `muted-foreground` darkened (light `#7a8b96` → `#606d76`) / lightened (dark `#6e7f89` → `#8f9ba3`).
  - `text-muted` nudged: light `#64727b` → `#606d76`; dark `#7d8c95` → `#87959d`.
  - Badge grounds darkened for white text: `warning` `#b7791f` → `#986519`, `danger` (dark) `#e5483d` → `#ca4036`, `neutral` `#7a8b96` → `#66747d` (light) / `#6e7f89` → `#5b6972` (dark).
  - No names, types, or structure changed; visual intent preserved (contrast fix per policy).

## 0.1.0 — 2026-11-20 (DS-01 initial)

- DTCG single source (`tokens.json`) replaces hand-maintained `themes/light.css`, `themes/dark.css`, and the variable blocks of `tokens/calm-premium.css`.
- Selector merge (no value drift): light values live on `:root:not(.dark)`, dark on `:root.dark`, density overrides on `[data-density='compact']` — order and specificity replicate the original cascade.
- Note: `themes/light.css` had been fully shadowed by the calm-premium override since the roadmap addendum; its values survive only inside the merged light set where they were actually live.
- Emitted: `src/styles/generated/themes.css`, `src/styles/generated/tokens.ts`.
