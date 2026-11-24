# VIMAD TRACKER — the living plan of record (update at the end of every session)

Last updated: 2026-11-24 · code state: `c5629d7` (CI: all five gates green — first fully-green run in repo history)

## How to read this (numbering — three schemes collide, this tracker uses ONE)

This tracker follows the **merged roadmap** (VIMAD-Master-Roadmap-Merged-2026-11-21, the uploaded document).

- v2.0-era "Phase 6/7" (logbook/keys, money) = same numerals, different content — CLOSED 2026-11-20.
- Your personal v4.0 18-phase tracker = third numbering (bridge to be recorded here when the list is shared).
  Rule: say "merged-Phase N" here; ask which scheme before acting on a bare "Phase N".

## Phase board (merged roadmap)

| Phase | Content                 | Status    | Remaining                                                                                |
| ----- | ----------------------- | --------- | ---------------------------------------------------------------------------------------- |
| 0     | Baseline + DS-01–03     | ✅ CLOSED | DS-02 hex sweep armed (with parallel-lane scope)                                         |
| 1     | Shell residue           | ◐ ~90%    | SH-03 nav-prune decision (→ dock); DS-09/10/11/13/14 policy items                        |
| 2     | Exception engine        | ✅ CLOSED | EX-07 was the only commit (−312 lines)                                                   |
| 3     | Money completion        | ✅ CLOSED | C6′-V SARS mapping = external (tax practitioner)                                         |
| 4     | Reservation workspace   | ✅ CLOSED | 4.1–4.5 content verified; 4.6–4.9 = DS-05/06/07/08, all shipped (DS-07 green 2026-11-24) |
| 5     | Wave-1 verification     | ✅ ~85%   | Only E2x-V (Paystack live) + B1-V (Channex) — both EXTERNAL                              |
| 6     | C2′ BI hub              | ✅ CLOSED | —                                                                                        |
| 7     | HK supervisor + tasks   | ✅ CLOSED | 7.7 findings queued: mobile offline queue, photo-upload endpoint                         |
| 8     | API & ecosystem         | ⬜ NEXT   | D1+ webhooks needs NO credentials — start here                                           |
| 9     | Guest parity            | ⬜        | 9.1–9.7 all buildable now (9.4 split page already exists)                                |
| 10    | Trust/onboarding        | ⬜        | 2FA, POPIA erasure, onboarding packaging, PCI doc                                        |
| 11    | Chain depth             | ⬜        | Nearly free (schema supports)                                                            |
| 12    | F&B gate→cluster        | ⬜        | F5/D6 decision doc (1 day) can start pre-decision                                        |
| 13    | Wave-3 + automations v1 | ⬜        | Self-contained 3–4wk engine arc                                                          |
| 14    | Last mile → production  | ⬜        | Needs pilot property + (for payments) live keys                                          |

## Follow-up queue (non-phase, buildable now)

1. **Phase 8 D1+** — webhook signing/rotation, retry+replay, scoped-data proof suite, developer portal (no creds)
2. RoomBoard reservation overlay (the true tape-chart check-in trigger)
3. Preauth infrastructure — schema + hold lifecycle, buildable in Paystack TEST mode
4. RC sweep — ~53 react-compiler findings (gate-aligned: classic rules only until swept)
5. E1x-V extras + E5-V/H3-V/C8′/C4′a/C5′/B3-K — suites all green in rotation
6. Housekeeping: deploy-prod config (90s fails), security-scan failure, guest-portal verify-page interval bug

## External tracks (owner: Vin)

| Track                  | Unblocks                                    | Action this week                                                                        |
| ---------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Paystack live keys** | E2x-V, B7, D7, preauth-prod, pilot payments | CIPC + SA bank account + KYC pack → paystack.com business signup → Dashboard → API Keys |
| Channex sandbox creds  | B1-V                                        | Apply/chase sandbox access                                                              |
| SA-2 tax practitioner  | C6′-V SARS mapping                          | Engage (already planned)                                                                |
| Booking.com B.XML      | Connectivity                                | Paperwork; needs 5+ live properties                                                     |

## What CANNOT ship without live Paystack keys

Moving real money only: E2x-V live 3DS run · B7 live integrity · D7 voucher redemption · production preauth · Phase-14 pilot payments. Everything else proceeds.

## Working conventions (from the 2026-11-23 CI war — keep)

- Gates read LOGS (`N passed (N)`), never pipes over exit codes; one && chain into every commit
- Zero-evidence greps need `|| true` (grep -c exits 1 on zero)
- tsc -b is incremental — force full checks when it matters
- Lint-staged re-dirties generated files — `git commit --no-verify` for token regens
- Read origin via raw.githubusercontent before asking the terminal for anything readable; terminal = runs only
- Standard gate: tsc log = 0 · suite log = N passed · build log = built in · THEN commit
