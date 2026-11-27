/* apps/web/src/app/marketing/platform/guest-portal/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'Is the R145 to R495 figure real?',
    a: 'Yes — measured at a live property across the conversational pre-arrival loop. It is in our claim register precisely because we can show the working.',
  },
  {
    q: 'What can we offer through it?',
    a: 'Anything sellable: meals, experiences, upgrades, transport, late check-out. If it has a price, it can be an offer.',
  },
  {
    q: 'Do guests need an app?',
    a: 'No — a link, by SMS or email. It opens on any phone, which is where your guests already are.',
  },
  {
    q: 'Which tier includes it?',
    a: 'The guest portal and upsell loop come in from Command. Compass properties can quote it as an add-on line on their contract.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Command tier and above</p>
          <h1>Pre-arrival offers that collect themselves.</h1>
          <p className="mkh-hero-sub">
            A guest portal that answers the repetitive questions and offers the profitable ones —
            verified at a live property turning R145 of offers into R495 per stay.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              Guest Portal & Upsells<span className="mkh-num">SAMPLE DATA · SHIPPED FEATURES</span>
            </h4>
            <div className="mkh-checkin">
              <div className="row">
                <span>Vimad: Dinner for two, 7pm? R450</span>
                <b>offered</b>
              </div>
              <div className="row">
                <span>Guest: Yes — late check-out too</span>
                <b>accepted</b>
              </div>
              <div className="row">
                <span>Offers posted to folio</span>
                <b>R700 ✓</b>
              </div>
              <div className="row timerow">
                <span>Verified per stay</span>
                <b>R145 → R495</b>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>
                Dinner, late check-out, airport runs — offered conversationally before arrival.
              </li>
              <li>Accepted offers post straight to the folio. No paper, no phone tag.</li>
              <li>Arrival details, directions and balance in the guest's pocket.</li>
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
        <h2 className="mkh-h2">Questions about guest portal</h2>
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
