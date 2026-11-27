/* apps/web/src/app/marketing/platform/front-desk/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'Can it handle a walk-in rush?',
    a: 'Yes — that is the surface it was built for. The check-in card collapses the whole flow to one screen, and deposits hold on Paystack without a card machine.',
  },
  {
    q: 'What stops someone selling a room below cost?',
    a: 'Rate guardrails. Floors and ceilings per room type; overrides are three clicks and land in the audit log with who, when and why.',
  },
  {
    q: 'Does it work for tiny properties?',
    a: "Compass is designed for 6–20 rooms — the size where the owner is the front desk. No features you'll never touch.",
  },
  {
    q: 'What happens when the power cuts?',
    a: 'The offline-tolerant front desk queues check-ins and changes, then flushes when you are back online — plus a printable shift pack for the generator hours.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Compass tier and above</p>
          <h1>Front desk & reservations, at lobby speed.</h1>
          <p className="mkh-hero-sub">
            Tape chart, walk-ins, and a check-in measured in seconds — not screens. Everything the
            front desk touches, one keyboard-first surface.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              Front Desk & Reservations<span className="mkh-num">LIVE CROP · DEMO TENANT</span>
            </h4>
            <div className="mkh-checkin">
              <div className="row">
                <span>Guest</span>
                <b>T. Nkosi · walk-in</b>
              </div>
              <div className="row">
                <span>Room</span>
                <b>305 · Deluxe DBB</b>
              </div>
              <div className="row">
                <span>Rate</span>
                <b>R1,850/night · guardrail ✓</b>
              </div>
              <div className="row">
                <span>Deposit held (Paystack)</span>
                <b>R1,000</b>
              </div>
              <div className="row timerow">
                <span>Key issued · folio opened</span>
                <b>00:44</b>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>
                Walk-in to checked-in in under 45 seconds: guest, room, rate, deposit, key — one
                card.
              </li>
              <li>Rate overrides in three clicks, inside guardrails, every change audited.</li>
              <li>Arrivals, departures and room state on one screen — no swivel chair.</li>
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
        <h2 className="mkh-h2">Questions about front desk</h2>
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
