# VIMAD F&B — F5/D6 Decision (v1.0 · 2026-11-26)

**Decision: shared-spine, native-first, full cluster.**
The folio (via the `sellProduct` chokepoint) is the single money spine for
all F&B. Native modules write to it directly; external POS vendors connect
through per-customer adapters (D6) that post into it.

## Chosen build order

1. **F3 QR order-and-pay** — POS-agnostic wedge; guests order and pay from
   their phone (Paystack rail), charges post to the folio. Buildable
   immediately, no hardware, no vendor talks.
2. **F5 native till MVP** — item catalog, open checks/tabs, split, comps with
   reversal, cash-ups, folio posting. For the POS-less guesthouse market.
3. **F4 kitchen display** — order queue, prep status, recall; rides the F3/F5
   order stream.
4. **F6 stock / recipes / BOM / purchasing** — the deliberate 8-week monster:
   stock movements reconcile against sold items; recipes decompose into
   stock deductions. Only after F5 till data proves reliable.
5. **D6 external POS adapters** — per-vendor, built only when a paying
   property demands their existing POS (GAAP, POSTitan, Yoco-adjacent);
   negotiate from a signed customer. Never pre-built.

## Explicitly rejected

- Vendor-first launch (no negotiating position pre-revenue; pulls money out
  of the folio spine).
- Building F6 before F5 data exists (recipes need real sales to reconcile).
- Pre-built multi-vendor adapters.

## Accounting/services mapping

POS categories → accounting categories / services / mealtimes: the banked
PMS-bridge mapping spec applies to both native and adapter lanes.
