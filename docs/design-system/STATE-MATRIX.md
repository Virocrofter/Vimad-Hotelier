# Component state matrix (DS-05 / Phase 4.6)

Every catalog component enumerated across the seven contract states from the
blueprint (§6): **default · hover · active · disabled · loading · empty · error**.
This file is the VRT target list (4.7) and the a11y surface (4.8): every cell
marked ● gets a screenshot baseline; every interactive class gets an axe pass.

## Primitive catalog (src/components/ui — 22 components)

| Component                   | default | hover         | active            | disabled          | loading                    | empty                 | error                          | Notes / render target                      |
| --------------------------- | ------- | ------------- | ----------------- | ----------------- | -------------------------- | --------------------- | ------------------------------ | ------------------------------------------ |
| Button (button.tsx)         | ●       | ●             | ●                 | ●                 | ● (spinner slot)           | n/a                   | ● (destructive variant)        | story: variants × states grid              |
| Input (input.tsx)           | ●       | ●             | ● (focus ring)    | ●                 | n/a                        | ● (placeholder)       | ● (invalid + aria-describedby) | form story                                 |
| Textarea                    | ●       | ●             | ●                 | ●                 | n/a                        | ●                     | ●                              | as Input                                   |
| Select (select.tsx)         | ●       | ●             | ● (open)          | ●                 | ● (async options)          | ● (no options)        | ● (load failure)               | dropdown open state is a second capture    |
| Checkbox                    | ●       | ●             | ● (checked)       | ●                 | n/a                        | n/a                   | ●                              | tri-state where used                       |
| Switch                      | ●       | ●             | ● (on)            | ●                 | n/a                        | n/a                   | n/a                            |                                            |
| Tabs (tabs.tsx)             | ●       | ●             | ● (active tab)    | ● (tab)           | ● (lazy pane)              | ● (no tabs)           | n/a                            | active-tab capture carries the accent      |
| Dialog (dialog.tsx)         | ●       | ●             | ●                 | n/a               | ●                          | n/a                   | n/a                            | modal + the backdrop scrim                 |
| Drawer (drawer.tsx)         | ●       | ●             | ●                 | n/a               | ●                          | ● (empty pane)        | n/a                            | S6 anatomy; edge swipe on touch            |
| Dropdown                    | ●       | ●             | ● (open)          | ●                 | ●                          | ●                     | ●                              |                                            |
| DatePicker                  | ●       | ●             | ● (open calendar) | ●                 | n/a                        | n/a                   | ● (invalid date)               | calendar overlay capture                   |
| Avatar                      | ●       | n/a           | n/a               | n/a               | ● (skeleton while loading) | ● (fallback initials) | n/a                            |                                            |
| Badge                       | ●       | n/a           | n/a               | n/a               | n/a                        | n/a                   | n/a                            | static chip                                |
| StatusBadge / StatusChip    | ●       | n/a           | n/a               | n/a               | n/a                        | n/a                   | n/a                            | color always paired with text (HK-03)      |
| Card (card.tsx)             | ●       | ●             | ●                 | n/a               | ● (skeleton card)          | ● (empty slot)        | n/a                            | resting card = hairline, no shadow         |
| Label                       | ●       | n/a           | n/a               | ●                 | n/a                        | n/a                   | ● (error text pairing)         |                                            |
| Progress                    | ●       | n/a           | n/a               | n/a               | ● (indeterminate)          | n/a                   | n/a                            |                                            |
| Skeleton (skeleton.tsx)     | ●       | n/a           | n/a               | n/a               | n/a                        | n/a                   | n/a                            | shimmer matches final layout (DS-11)       |
| Table (table.tsx)           | ●       | ● (row hover) | ● (row selected)  | n/a               | ● (spinner rows)           | ● (no rows)           | ● (row error banner)           | the APG contract (see APG-GRID.md) applies |
| Toast (toast.tsx)           | ●       | ●             | ● (action press)  | n/a               | n/a                        | n/a                   | n/a                            | transient; capture at mount                |
| ConfirmDialog               | ●       | ●             | ● (confirm press) | ● (while pending) | ●                          | n/a                   | n/a                            | destructive copy restates the object       |
| Toggle group / Toolbar rows | ●       | ●             | ●                 | ●                 | n/a                        | n/a                   | n/a                            | where composed                             |

## State components (first-class, not afterthoughts)

| Component       | contract                                                            |
| --------------- | ------------------------------------------------------------------- |
| EmptyState      | headline + what-goes-here + how-to-add-it action; never a bare icon |
| ErrorState      | what happened + next action + preserve-input note; retry wired      |
| LoadingSkeleton | layout-matched shimmer; fonts awaited before capture (DS-11)        |

## Domain components

| Component                        | states beyond the primitive set                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GuestCard (guests/GuestCard.jsx) | default · hover · active (drawer opens) · loading (skeleton) · empty (no-stay variant) · error (fetch failed) |
| StatusBanner                     | info / warning / danger soft pairs; color never the only signal                                               |
| ReceiptCard (billing)            | populated · zero-state (portal-verified) · currency variants                                                  |
| Charts (recharts wrappers)       | loading · empty (no data) · error · drill-down active                                                         |

## The seven-state contract by component class

- **Interactive form** (Button, Input, Select, Checkbox, Switch, DatePicker):
  default→hover→active→disabled MUST be visually distinct states, not opacity
  tweaks alone; error pairs with text (aria-describedby); loading replaces the
  label with a spinner, never a second click target.
- **Overlay** (Dialog, Drawer, Dropdown, DatePicker-open, ConfirmDialog):
  focus trap on open; Escape closes; return-focus on close; scrim dims
  underneath (composite transform fade per DS-10).
- **Display** (Card, Table, Badge, Status*): hover/active only where rows or
  cards are actionable; empty and error are first-class renders.
- **Feedback** (Toast, StatusBanner, ErrorState): transient toasts carry one
  action max; banners persist until dismissed or the condition clears.

## VRT target list (input to 4.7)

One screenshot per ● cell above where the cell is reachable in isolation
(story or harness route). Composite captures: Button grid, form story, Tabs
active, Drawer open, Table with spinner rows, Table empty, EmptyState,
ErrorState, LoadingSkeleton, GuestCard populated + empty. Baselines are
generated and compared in the same Docker image (4.7); --update-snapshots is
gated like a code review.

## A11y surface (input to 4.8)

Interactive class: focus-visible ring (hq-focus two-layer), keyboard
activation, disabled announced (aria-disabled where focusable), error text
associated (aria-describedby). Overlay class: focus trap, Escape, role/aria-
modal. Table class: the APG grid contract. Every cell: axe runOnly wcag2a+
wcag2aa (2.2 AA) — build fails on critical/serious.
