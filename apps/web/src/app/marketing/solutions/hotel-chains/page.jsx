/* apps/web/src/app/marketing/solutions/hotel-chains/page.jsx — Content Mass solution page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'How does shared guest identity actually work?',
    a: 'One profile across the group with merge rules keeping duplicates out, so a repeat guest is recognised at every check-in — and their preferences arrive with them.',
  },
  {
    q: 'Can central reservations see all properties at once?',
    a: 'Yes — live availability across the group, booked in one action, with cross-property moves handled without cancel-and-rebook games.',
  },
  {
    q: 'Does group billing mix the properties&rsquo; money?',
    a: 'No. Each property settles into its own Paystack account. The group shares data — guests, rates, reporting — not bank balances.',
  },
  {
    q: 'We have four sites on four different systems today.',
    a: 'That is the standard starting point, not a blocker. We migrate site by site, keep the group on parallel until each cutover earns its keep, and roll the queue up to a group view as sites land.',
  },
];

export default function SolutionPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Solution · Multi-property groups</p>
          <h1>
            Multi-property groups: <em>one guest. Every property. One truth.</em>
          </h1>
          <p className="mkh-hero-sub">
            Armada tier runs fleets: shared guest identity, central reservations, cross-property
            booking, chain billing — with each property&rsquo;s money still settling into its own
            Paystack.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              What it looks like<span className="mkh-num">LIVE CROP · DEMO TENANT</span>
            </h4>
            <div className="mkh-hk">
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">DBN</span>
                <span className="mkh-hk-task">Ocean View · 12 rooms · 94% occ</span>
                <span className="mkh-hk-badge mkh-hk-clean">Live</span>
              </div>
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">Berea</span>
                <span className="mkh-hk-task">Grange Gardens · 33 rooms · 81%</span>
                <span className="mkh-hk-badge mkh-hk-clean">Live</span>
              </div>
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">Group</span>
                <span className="mkh-hk-task">Central reservations · cross-property guest</span>
                <span className="mkh-hk-badge mkh-hk-inspect">Identity ✓</span>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>
                A guest known at every front desk: history, preferences and balances follow them.
              </li>
              <li>
                Central office books any property from live availability — no phone tag, no
                overbooking.
              </li>
              <li>
                Chain billing and loyalty that cross properties; consolidated reporting for the
                group.
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
