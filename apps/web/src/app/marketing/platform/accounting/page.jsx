/* apps/web/src/app/marketing/platform/accounting/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'What does continuous tie-out actually mean?',
    a: 'Every folio movement posts through the ledger as it happens, so revenue and ledger stay equal all month. When a month ends, the books are already closed.',
  },
  {
    q: 'How is TOMSA handled?',
    a: 'The 1% tourism levy accrues automatically on qualifying charges and produces a remittance report — no calculator, no forgotten line item.',
  },
  {
    q: 'Can my bookkeeper keep Xero or Sage?',
    a: 'Yes — export clean CSVs on any schedule. Most bookkeepers keep their package and simply stop re-keying.',
  },
  {
    q: 'Is it really SARS-ready?',
    a: 'VAT output tracked per rate, income statements and ledgers exportable, levy accounted for. Your accountant signs off; the software does the arithmetic.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Compass tier and above</p>
          <h1>Books that tie out while you sleep.</h1>
          <p className="mkh-hero-sub">
            Continuous trial balance, TOMSA 1% auto-accrued, VAT tracked, Xero/Sage CSV export —
            SARS-ready without the night-audit freeze.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              Accounting & SARS<span className="mkh-num">LIVE CROP · DEMO TENANT</span>
            </h4>
            <div className="mkh-checkin">
              <div className="row">
                <span>Folio revenue · November</span>
                <b>R412,930.00</b>
              </div>
              <div className="row">
                <span>Ledger income</span>
                <b>R412,930.00</b>
              </div>
              <div className="row">
                <span>TOMSA 1% accrued</span>
                <b>R4,129.30</b>
              </div>
              <div className="row">
                <span>VAT output</span>
                <b>R53,681.74</b>
              </div>
              <div className="row timerow">
                <span>Difference</span>
                <b>R0.00</b>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>
                Folios and the general ledger reconcile continuously — month-end is a report, not a
                project.
              </li>
              <li>TOMSA 1% levy calculated at the source and remittance-ready.</li>
              <li>Xero and Sage CSV export; your accountant keeps their workflow.</li>
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
        <h2 className="mkh-h2">Questions about accounting</h2>
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
