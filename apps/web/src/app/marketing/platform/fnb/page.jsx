/* apps/web/src/app/marketing/platform/fnb/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'Does the guest need to download anything?',
    a: 'No — they scan, order, pay. The whole loop runs in the browser.',
  },
  {
    q: 'How does it reach the kitchen?',
    a: 'Orders hit the kitchen display as they are placed, course by course, with table and modifiers.',
  },
  {
    q: 'Can it handle stock and the till?',
    a: 'Yes — stock levels track as items sell, and the till closes with the same cash discipline as the front desk.',
  },
  {
    q: 'Which tier includes it?',
    a: 'QR order-and-pay ships with Command and above. Venue-heavy properties can attach it as an add-on line on any contract.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Command tier and above</p>
          <h1>One bill at checkout — from order to folio.</h1>
          <p className="mkh-hero-sub">
            Guests order and pay by QR at the table; the kitchen sees it instantly; the charge lands
            on the room. F&B, stays and venue events on one folio spine.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              F&B and QR Order & Pay<span className="mkh-num">SAMPLE DATA · SHIPPED FEATURES</span>
            </h4>
            <div className="mkh-checkin">
              <div className="row">
                <span>Table 12 scans QR · order sent</span>
                <b>R640</b>
              </div>
              <div className="row">
                <span>Kitchen display · course 1</span>
                <b>fired ✓</b>
              </div>
              <div className="row">
                <span>Charge to room 305</span>
                <b>folio ✓</b>
              </div>
              <div className="row timerow">
                <span>One bill at checkout</span>
                <b>stay + F&B</b>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>QR order-and-pay at the table — no app for the guest, no re-keying for staff.</li>
              <li>Kitchen display, till and stock in the same system as the rooms.</li>
              <li>Charge-to-room means one bill at checkout, not three reconciliations.</li>
            </ul>
            <p className="mkh-tierline">
              Included from <b>Command</b> ·{' '}
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
        <h2 className="mkh-h2">Questions about f&b and qr order</h2>
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
