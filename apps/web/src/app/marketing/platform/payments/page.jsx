/* apps/web/src/app/marketing/platform/payments/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'Where does the money actually go?',
    a: 'Into your own Paystack account, from day one. We never hold guest funds — you reconcile to the cent, and nobody at our office can touch it.',
  },
  {
    q: 'How does EFT matching work?',
    a: 'The guest or bookkeeper uploads the proof of payment; it is verified and matched to the folio at the payment chokepoint. Unmatched POPs queue in Needs Attention.',
  },
  {
    q: 'What payment methods can we accept?',
    a: "All major cards via Paystack, EFT with POP matching, and instant EFT. Processing fees are Paystack's own and always shown separately.",
  },
  {
    q: 'Can we take deposits and pre-authorisations?',
    a: 'Deposits on direct bookings, yes — held via Paystack and applied to the folio automatically at checkout.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Compass tier and above</p>
          <h1>Every rand accounted for, automatically.</h1>
          <p className="mkh-hero-sub">
            Paystack card payments, EFT with proof-of-payment matching, and reconciliation that
            closes itself — into your own account, never ours.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              Payments<span className="mkh-num">LIVE CROP · DEMO TENANT</span>
            </h4>
            <div className="mkh-checkin">
              <div className="row">
                <span>Card via Paystack · Visa ·· 4471</span>
                <b>R3,700.00 ✓</b>
              </div>
              <div className="row">
                <span>EFT POP uploaded → matched</span>
                <b>R1,500.00 ✓</b>
              </div>
              <div className="row">
                <span>City Ledger · corporate</span>
                <b>R2,200.00</b>
              </div>
              <div className="row">
                <span>Refund issued</span>
                <b>-R350.00 ✓</b>
              </div>
              <div className="row timerow">
                <span>Day-end reconciliation</span>
                <b>0 diffs</b>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>Guest money settles into your own Paystack account. We never touch it.</li>
              <li>
                EFT proof-of-payment uploaded, verified, matched to the folio — no spreadsheet
                hunting.
              </li>
              <li>Cards, EFT, instant EFT and corporate City Ledger on one statement.</li>
            </ul>
            <p className="mkh-tierline">
              Included from <b>Compass</b> ·{' '}
              <Link to="/pricing" className="mkh-tierlink">
                full tier contents
              </Link>{' '}
              ·{' '}
              <Link to="/add-ons" className="mkh-tierlink">
                add-on line items
              </Link>
            </p>
          </div>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <p className="mkh-kicker">Straight answers</p>
        <h2 className="mkh-h2">Questions about payments</h2>
        <div className="mkh-faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mkh-cta-row" style={{ marginTop: 32 }}>
          <Link className="mkh-pill" to="/get-quote">
            Get your quote
          </Link>
          <Link className="mkh-ghost" to="/demo">
            Book a walk-in demo
          </Link>
        </div>
      </section>
    </div>
  );
}
