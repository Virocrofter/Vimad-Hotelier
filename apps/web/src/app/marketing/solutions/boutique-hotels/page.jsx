/* apps/web/src/app/marketing/solutions/boutique-hotels/page.jsx — Content Mass solution page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'We&rsquo;re 70% OTA-booked. Can you help?',
    a: 'That dependence is the most common thing we fix. The direct engine takes bookings at 0% commission with Paystack deposits — most boutique hotels cover the fee with two direct bookings a month, then everything else is margin recovered.',
  },
  {
    q: 'Our rates change with seasons and events. How much admin is that?',
    a: 'Seasonal and day-of-week rules apply themselves. One-off event pricing is a three-click override inside guardrails — logged, reversible, safe.',
  },
  {
    q: 'Do we need new hardware or a server?',
    a: 'No. Any laptop, tablet or phone. When the power cuts, the front desk queues its work and flushes when you are back — there is also a printable shift pack for generator hours.',
  },
  {
    q: 'What does onboarding look like for a 40-room property?',
    a: 'CSV import, a 30-day parallel run, cutover on a Tuesday afternoon. Most boutique hotels are fully live inside five weeks, and the first month is free on founding terms with proof of your current setup.',
  },
];

export default function SolutionPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Solution · Boutique hotels & lodges</p>
          <h1>
            Boutique hotels: <em>full ops without the enterprise price.</em>
          </h1>
          <p className="mkh-hero-sub">
            Twenty to eighty rooms is the awkward middle — too big for the diary, too small for the
            systems priced for chains. Command tier is built exactly for this gap.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              What it looks like<span className="mkh-num">LIVE CROP · DEMO TENANT</span>
            </h4>
            <div className="mkh-checkin">
              <div className="row">
                <span>Friday 14:00 · arrivals wave</span>
                <b>6 due</b>
              </div>
              <div className="row">
                <span>Median check-in</span>
                <b>00:44</b>
              </div>
              <div className="row">
                <span>Rate guardrail breaches</span>
                <b>0</b>
              </div>
              <div className="row timerow">
                <span>Housekeeping board synced</span>
                <b>live ✓</b>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>
                Rate guardrails + seasonal rules: December prices itself, weekdays stay sharp.
              </li>
              <li>
                Corporate and tour-group folios split into City Ledger — one bill at checkout.
              </li>
              <li>
                Pre-arrival upsells turning stays into R145–R495 of extra revenue, automatically.
              </li>
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
