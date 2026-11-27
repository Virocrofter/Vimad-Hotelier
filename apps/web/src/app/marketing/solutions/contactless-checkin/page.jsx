/* apps/web/src/app/marketing/solutions/contactless-checkin/page.jsx — Content Mass solution page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'I&rsquo;m the owner AND the front desk. Is this too much system for me?',
    a: 'Compass was designed for exactly you. If you can use WhatsApp you can run the board — three taps for housekeeping, one card for check-in, and the books close themselves.',
  },
  {
    q: 'Is it really cheaper than what I pay the OTAs?',
    a: 'Two direct bookings a month typically cover the fee; every booking after that is commission you stopped donating. The payback math is on the pricing page and we will run it on your own numbers at the demo.',
  },
  {
    q: 'What happens when the power or fibre goes?',
    a: 'Check-ins queue locally and flush when you are back online, and a printable shift pack covers the long outages. Built for South African realities, not adapted to them.',
  },
  {
    q: 'What if I try it and hate it?',
    a: 'The 30-day parallel run is the answer: your diary stays alive until Vimad has earned its place. If it doesn&rsquo;t, we move you back — free. You risk nothing but the time to look.',
  },
];

export default function SolutionPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Solution · Guesthouses & B&Bs</p>
          <h1>
            Guesthouses & B&Bs: <em>the diary replacement that pays for itself.</em>
          </h1>
          <p className="mkh-hero-sub">
            Six to twenty rooms, one owner wearing five hats. Compass tier replaces the book, the
            spreadsheets and the OTA panic with one calm screen — priced so two direct bookings
            cover it.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              What it looks like<span className="mkh-num">SAMPLE DATA · SHIPPED FEATURES</span>
            </h4>
            <div className="mkh-checkin">
              <div className="row">
                <span>Two direct bookings / month</span>
                <b>≈ the fee</b>
              </div>
              <div className="row">
                <span>Commission saved vs the OTA</span>
                <b>15–25%</b>
              </div>
              <div className="row">
                <span>Owner&rsquo;s Sunday-night admin</span>
                <b>gone</b>
              </div>
              <div className="row timerow">
                <span>The diary</span>
                <b>retired</b>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>The whole property on one screen: arrivals, departures, who owes what.</li>
              <li>Direct bookings at 0% commission — the OTA math finally works for you.</li>
              <li>Housekeeping, TOMSA and SARS-ready books included from the smallest tier.</li>
            </ul>
          </div>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <p className="mkh-kicker">Straight answers</p>
        <h2 className="mkh-h2">The questions this size of property asks</h2>
        <div className="mkh-faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary dangerouslySetInnerHTML={{ __html: f.q }} />
              <p dangerouslySetInnerHTML={{ __html: f.a }} />
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
