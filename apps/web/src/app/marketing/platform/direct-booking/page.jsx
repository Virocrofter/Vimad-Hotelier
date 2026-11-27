/* apps/web/src/app/marketing/platform/direct-booking/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'What does the widget cost?',
    a: 'It is included from Compass — engine, deposits and all. Two direct bookings a month typically cover the whole system.',
  },
  {
    q: 'How do deposits work?',
    a: 'The guest pays a deposit through Paystack at booking; it is held and applied to the folio at checkout automatically.',
  },
  {
    q: 'Which OTAs do you sync with?',
    a: 'Our integration directory lists every connection with a LIVE or PILOT pill, updated as channels graduate. We would rather show honest status than a long logo list.',
  },
  {
    q: 'Will it overbook against the OTAs?',
    a: 'Availability flows from the same spine the front desk uses — one truth, so your own widget and the channels sell from the same room count.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Compass tier and above</p>
          <h1>Your own bookings, at 0% commission.</h1>
          <p className="mkh-hero-sub">
            A booking engine that lives on your website, takes Paystack deposits, and lands straight
            on the tape chart — while OTA channels sync where it counts.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              Direct Booking & Distribution
              <span className="mkh-num">SAMPLE DATA · SHIPPED FEATURES</span>
            </h4>
            <div className="mkh-checkin">
              <div className="row">
                <span>Booked on your own website</span>
                <b>0% commission</b>
              </div>
              <div className="row">
                <span>Paystack deposit held</span>
                <b>R1,000 ✓</b>
              </div>
              <div className="row">
                <span>Confirmation + portal link</span>
                <b>sent ✓</b>
              </div>
              <div className="row">
                <span>OTA channels</span>
                <b>sync in pilot</b>
              </div>
              <div className="row timerow">
                <span>Arrival on tape chart</span>
                <b>auto ✓</b>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>0% commission on your own website; the widget embeds with one script tag.</li>
              <li>Paystack deposits cut no-shows without a phone call.</li>
              <li>
                Channel sync marked honestly: LIVE where proven, PILOT where it is still proving
                itself.
              </li>
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
        <h2 className="mkh-h2">Questions about direct booking</h2>
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
