/* apps/web/src/app/marketing/switch/page.jsx — [M2] the Switch page.
 * The migration-fear killer: export → import → parallel → Tuesday cutover,
 * plus the buyout offer. Everything described is the actual cutover playbook. */
import { Link } from 'react-router-dom';

const STEPS = [
  {
    num: '01',
    title: 'We export',
    body: 'A CSV from your current system — bookings, guests, rates, open balances. Your data leaves with you either way; this just points it somewhere useful.',
  },
  {
    num: '02',
    title: 'We import',
    body: 'Everything lands in Vimad: future reservations, guest history, room types and rates. Your team logs in to a working hotel, not an empty shell.',
  },
  {
    num: '03',
    title: 'You run parallel for 30 days',
    body: 'Both systems live. Your team works in Vimad while the old one keeps the lights on. Real guests, real shifts, zero gambling.',
  },
  {
    num: '04',
    title: 'Cutover on a Tuesday afternoon',
    body: 'About an hour. Departures close out in the old system, arrivals open in Vimad. If it doesn&rsquo;t win by day 30, we move you back — free.',
  },
];

const FAQS = [
  {
    q: 'What does the switch cost?',
    a: 'The migration itself is free — including the first month on founding terms when you show us a current invoice from your old system. Our onboarding line item exists for hotels that want hand-holding beyond the standard playbook.',
  },
  {
    q: 'How long does it take?',
    a: 'Export to import is usually a day. The 30-day parallel run is the honest part — it&rsquo;s how you know, instead of hoping. Most properties cut over between week 3 and week 5.',
  },
  {
    q: 'What about my data if I leave later?',
    a: 'Export everything, any time — guests, history, financials. That clause is the point of the product, not the fine print.',
  },
  {
    q: 'My staff aren&rsquo;t technical.',
    a: 'The 3-tap housekeeping board exists for exactly this. Training is part of onboarding, and the founder answers the phone at +27 65 074 8802 when something feels wrong.',
  },
];

export default function SwitchPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Switching, without the fear</p>
          <h1>
            Moved in by <em>Tuesday.</em>
          </h1>
          <p className="mkh-hero-sub">
            The reason hotels don&rsquo;t switch systems is migration terror, not loyalty. So we
            made migration the product: parallel run, afternoon cutover, and a move-back guarantee.
          </p>
        </div>
      </section>

      <section className="mkh-section" style={{ paddingTop: 16 }}>
        <div className="mkh-steps" style={{ marginTop: 0 }}>
          <div className="mkh-stepgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {STEPS.map((s) => (
              <div key={s.num} className="mkh-step">
                <span className="mkh-num">{s.num}</span>
                <h3>{s.title}</h3>
                <p dangerouslySetInnerHTML={{ __html: s.body }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkh-section">
        <div className="mkh-risk">
          <p className="mkh-kicker">The buyout offer</p>
          <h2>Show us a current invoice from your old system: migration free, first month free.</h2>
          <p>
            We&rsquo;d rather spend the money making your switch painless than spend it on ads.{' '}
            <b>Your money never touches our accounts</b> — guest payments settle straight into your
            own Paystack, before, during and after the move.
          </p>
          <div className="mkh-cta-row">
            <Link className="mkh-pill" to="/get-quote">
              Start the switch
            </Link>
            <Link className="mkh-ghost" to="/demo">
              See it working first
            </Link>
          </div>
        </div>
      </section>

      <section className="mkh-section">
        <p className="mkh-kicker">Questions owners ask</p>
        <h2 className="mkh-h2">Before you switch</h2>
        <div className="mkh-faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p dangerouslySetInnerHTML={{ __html: f.body }} />
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
