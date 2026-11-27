# Vimad Proof Register — metric definitions (Phase 0+ item 7)

Every published micro-stat must trace to one of these definitions + a named pilot.
No number ships without: pilot name, measurement date, method, raw evidence file.

## Captured metrics

| Metric                | Definition                                              | Capture method                                                                 | Storage                                          |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| Check-in time         | Stopwatch (phone) from "walks to desk" to "key in hand" | 10 consecutive check-ins per pilot, median reported                            | `.vimad-evidence/pilots/<slug>/checkin-times.md` |
| Upsell Rands          | Value of conversational upsell offers accepted per stay | `upsell_api` + folio line source tag; report R-value per stay and acceptance % | `.vimad-evidence/pilots/<slug>/upsell-rands.csv` |
| Direct-booking share  | % of room nights booked via own widget vs OTA channels  | booking.source breakdown per month per pilot                                   | `.vimad-evidence/pilots/<slug>/direct-share.csv` |
| Hours saved per shift | Manager self-report, weekly, against pre-Vimad baseline | one-question WhatsApp prompt Fridays; log verbatim                             | `.vimad-evidence/pilots/<slug>/hours-saved.md`   |
| Accounting tie-out    | Days from month-end to clean trial balance              | reconcile report timestamp vs month-end                                        | `.vimad-evidence/pilots/<slug>/tieout.md`        |

## Rules

- Baseline BEFORE cutover where possible (the week of diary/OTA numbers is the control).
- Named pilots only: "a Durban boutique" is not evidence; "Grange Gardens, 33 rooms" is.
- The claim register (addendum §2) admits a stat only when its row here has all four fields filled.
- First micro-stat cards ship in Field & Measure from this data — never before.
