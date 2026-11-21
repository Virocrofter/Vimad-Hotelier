# APG data-grid contract (DS-08 / Phase 4.8)

Binding rules for every data grid in the product (table.tsx and the table
surfaces built here and in Phase 6). Spec-only in this phase; implementation
rides each rebuilt grid. Reference: WAI-ARIA Authoring Practices — Grid
Pattern.

## Structure

- role="grid" on the container; role="row" / role="gridcell" (or
  role="columnheader" for headers) on descendants — NOT role="table": grids
  are interactive.
- aria-rowcount on the grid when rows are virtualized; aria-rowindex on each
  rendered row so screen readers report the true position.
- aria-colcount / aria-colindex when columns are virtualized.

## Keyboard contract (one Tab stop per grid)

The grid is ONE Tab stop. Inside, navigation is grid keys:

| Key                  | Behavior                                                 |
| -------------------- | -------------------------------------------------------- |
| Arrow Right/Left     | cell to cell; wraps at row edges per platform convention |
| Arrow Down/Up        | row to row (same column)                                 |
| Home / End           | first / last cell of the row                             |
| Ctrl+Home / Ctrl+End | first / last cell of the grid                            |
| Page Down / Page Up  | one viewport of rows                                     |
| Enter                | enters interactive cell mode (edit or activate)          |
| Escape               | leaves interactive mode, returns to grid navigation      |
| Tab / Shift+Tab      | leaves the grid entirely (to the next/previous widget)   |

## Cell designs (two valid)

1. **Actionable cell** — the cell itself is a button/link; Enter activates;
   no separate edit mode.
2. **Editable cell** — Enter enters edit mode (focus lands in the editor);
   Escape cancels and restores; commit (Enter again or blur) validates and
   writes. Undo follows the 10s undo-toast rule.

A grid mixes the two only when the column semantics differ; never within one
column.

## Selection & bulk actions

- Row selection: checkbox cells have role="checkbox" + aria-checked; header
  checkbox = select-all with aria-checked mixed state.
- aria-selected on selected rows when selection is the primary interaction.
- Bulk action bar announces via aria-live ("3 selected").

## Loading / empty / error in-grid

- Loading: aria-busy="true" on the grid + skeleton rows (announced).
- Empty: one row spanning the grid carrying the EmptyState content.
- Error: an in-grid banner row (role="alert") with retry — never a silent
  blank.

## What this applies to now

table.tsx (the primitive), the folio items table, the task queue (Phase 7's
4-zone shell), ledger tables (Phase 6), the rooming list. Rebuilt grids must
pass keyboard-invariant tests: Tab-in/out, arrow traversal across a boundary,
Enter/Escape lifecycle on an editable cell, mixed-state select-all.
