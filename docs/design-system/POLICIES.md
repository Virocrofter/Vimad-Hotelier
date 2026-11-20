# Vimad design-system policies (DS hardening arc)

Binding rules for the DS-04/09/10/11/13/14 cluster (Phase 1). The token
pipeline of record is `apps/web/design-tokens/tokens.json` -> `npm run
tokens:build` (DS-01); the lint contract is `npm run lint:tokens` (DS-02).
This file is the constitution for everything those two don't cover.

## DS-14 — Solo operating-model policy

- Code is the source of truth. No docs site until a second developer needs one.
- Component docs are exactly three lines: WHY it exists / WHEN NOT to use it /
  EXCEPTIONS. Anything longer belongs in a code comment next to the logic.
- Component-first page assembly: a page that hand-rolls markup a catalog
  component already provides is a review failure.
- ADRs live in commit messages + this file; long-form rationale lives in
  `docs/` only when cross-phase.

## DS-09 — Headless-primitive rule

- Anything beyond the shipped catalog (`Drawer`, `GuestCard`, `Tabs`, Button,
  Input, …) is built as compound components on RAW headless primitives
  (Radix-style) + design tokens. Never a second styled system, never a second
  animation stack.
- One token system (`design-tokens/tokens.json`) feeds everything; consuming
  raw values outside it fails `lint:tokens`.
- The first new custom widget after this policy ships must follow it — that
  widget is the reference implementation for the next one.

## DS-11 — Typography engineering rule

- Tabular numerals are the DEFAULT for every numeric cell, metric, KPI, money
  figure, count, and room number in a table. Utility: `hq-tnum` (token-backed).
  Deviation requires a comment explaining why lining figures are correct there.
- Monospace (`--font-mono`) is confined to machine-read codes — confirmation
  numbers, room numbers in tables, invoice numbers, API logs. Three-question
  test before using it: (1) is it a code, (2) does a human retype it, (3) is
  character ambiguity costly? Three yes -> mono; any no -> proportional.
- One type family, `font-display: swap`; screenshots wait for
  `document.fonts.ready` (evidence scripts include the wait).

## DS-10 — Motion performance budget

- Composite properties only: `transform` and `opacity` animate; `width`,
  `height`, `top/left`, `box-shadow`, and `background` NEVER animate.
- Micro-states (hover/focus/press) are CSS transitions, 150ms, the one
  standard ease (`hq-ease-standard`). Structural motion is Motion
  (`components/motion.ts` variants: 0.15 / 0.25 / 0.4, stagger 30ms) — this
  stack is LOCKED, do not introduce a second library.
- Explicit transition properties only — `transition: all` is banned
  (swept 2026-11-21; `lint:tokens` keeps the layer clean).
- `will-change` only on elements animated ≥ 60fps-per-second sustained
  (tape-chart drag layer, KPI numerals); remove after the animation ends.
- Simultaneous-animation cap: 4 concurrent animated layers; beyond that,
  stagger or drop the least-informative animation.
- Tape-chart jank measurement + the dnd-kit decision ride the Phase 4 motion
  pass; this file records the budget they must meet.

## DS-13 — Content-design subsystem

- Voice: calm, precise, operational. The system states facts and next actions;
  it never blames ("This folio has an unpaid balance" not "You failed to
  pay"). Empty states say what goes there and how to add it; errors say what
  happened, what to do next, and preserve user input.
- Money in ANY guest-visible or staff-facing copy must come from the money
  chokepoint (`lib/money` / `formatMoneyMinor`) — never hand-formatted.
  `scripts/money-format-check.mjs` scans for violations (report-only until
  the Phase 3 money sweep).
- Destructive confirmations restate the object and the undo path; success
  messages end with the next action ("Payment recorded — receipt sent to
  the guest.").

## DS-04 — Adoption metrics

- `scripts/token-adoption.mjs` measures token adoption (var(--*) references vs
  raw hex declarations, per CSS layer) and writes the quarterly report to
  `docs/design-system/adoption-<YEAR>-Q<N>.json`. Run it at each quarter
  boundary and at each DS milestone.
- Target trajectory: styles layer ≥ 95% (generated tokens excluded by
  construction), app page CSS trending to zero raw hex (see F-4 sweep).

## HK-03 — Legacy contrast polish (decision)

- Status pairs (mint/amber/red soft) and status dots are shipped via
  STATUS_META + `hq-status-*` utilities; color is never the only signal.
- Systematic WCAG contrast verification rides with the DS-07 axe-core CI gate
  (Phase 4) rather than a one-off manual pass — the gate is the durable fix.
  Evidence screenshots continue to serve as the per-ship spot-check.
