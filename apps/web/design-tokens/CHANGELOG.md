# Design tokens changelog

## 0.1.0 — 2026-11-20 (DS-01 initial)

- DTCG single source (`tokens.json`) replaces hand-maintained `themes/light.css`, `themes/dark.css`, and the variable blocks of `tokens/calm-premium.css`.
- Selector merge (no value drift): light values live on `:root:not(.dark)`, dark on `:root.dark`, density overrides on `[data-density='compact']` — order and specificity replicate the original cascade.
- Note: `themes/light.css` had been fully shadowed by the calm-premium override since the roadmap addendum; its values survive only inside the merged light set where they were actually live.
- Emitted: `src/styles/generated/themes.css`, `src/styles/generated/tokens.ts`.
