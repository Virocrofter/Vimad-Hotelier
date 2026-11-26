# VIMAD — PCI-DSS Posture Document (v1.0 · 2026-11-26)

Scope: cardholder-data handling across the VIMAD platform (PMS API + web apps)
as shipped at this date. Review before each pilot go-live and on any change
to the payment flow.

## 1. Posture claim: SAQ-A scope

VIMAD never touches, stores, processes, or transmits full card numbers
(PAN). All card acceptance happens inside Paystack-hosted surfaces
(`initializeTransaction` → Paystack checkout/3DS). Under PCI-DSS v4.0 this
is the classic outsourced-payment SAQ-A posture: the merchant environment
is out of PCI scope except the requirements SAQ-A still imposes
(sections 2, 8, 9-lite, 12). Final scope confirmation rests with a QSA
before the first live pilot; this document is the evidence pack.

## 2. Code-verified evidence

| Control            | Implementation                                                                   | Proof                                                       |
| ------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| No PAN storage     | Folio payments record references/amounts only; card data never enters our schema | money surfaces on `lib/money` + folio ledger (suite-pinned) |
| Outsourced capture | `common/paystack.ts` → Paystack hosted checkout + 3DS                            | payments service + E2x flows (test keys)                    |
| Webhook integrity  | HMAC-SHA256 signatures, key rotation with 24h grace                              | p38 suite (5 legs)                                          |
| Access control     | JWT + refresh rotation, permission gates, TOTP 2FA                               | p46 suite                                                   |
| PII minimization   | POPIA erasure verified; ID scans purged 30 days post-checkout; breach ledger     | p47 suite                                                   |
| TLS in transit     | Terminated at the platform edge; HSTS                                            | infra config                                                |
| Secrets            | Server-side env only; no keys in client bundles                                  | build config                                                |

## 3. Honest gaps / residual

- **QSA validation not yet done** — SAQ-A claim is self-assessed; engage a
  QSA before pilot go-live (external track, like the tax practitioner).
- **Live-mode 3DS verification pending** — E2x live runs wait on Paystack
  business activation; test-mode flows are green.
- **Refund path** rides Paystack reversal APIs — re-verify with live keys.
- **Chargeback runbook** not yet written (evidence export exists via folio
  audit trail).
- Guest-facing card machines (e.g. Yoco terminals) are the **property's**
  PCI responsibility — call out in onboarding.

## 4. Pre-pilot obligations

1. QSA scope letter (external engagement).
2. Dispute/chargeback runbook (template from folio audit trail).
3. Property one-pager: "your card machines are your PCI scope, not ours"
   (fold into the onboarding checklist payments step).
4. Annual re-review entry in the compliance calendar (rides the P42
   compliance-expiry task engine).
