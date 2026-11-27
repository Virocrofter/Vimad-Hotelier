/* apps/web/src/app/marketing/platform/chains/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'How does shared guest identity work?',
    a: 'One profile across the group — merge rules keep duplicates out, so a repeat guest is recognised at every front desk.',
  },
  {
    q: 'Can central office take bookings for all properties?',
    a: 'Yes — central reservations sees live availability across the group and books any property without phone tag.',
  },
  {
    q: 'What does chain billing mean?',
    a: 'Corporate accounts and city ledgers that span properties, consolidated into one statement — hospitality groups stop reconciling by email.',
  },
  {
    q: "Is each property's money separate?",
    a: 'Yes — every property settles into its own Paystack account. The group shares data, not bank balances.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Armada tier and above</p>
          <h1>One guest. Four properties. One truth.</h1>
          <p className="mkh-hero-sub">
            Shared guest identity across properties, central reservations, cross-property booking,
            chain billing and loyalty — fleet control from one spine.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              Multi-Property & Chains<span className="mkh-num">SAMPLE DATA · SHIPPED FEATURES</span>
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
                <span className="mkh-hk-task">Shared guest: T. Nkosi stays at both</span>
                <span className="mkh-hk-badge mkh-hk-inspect">Identity ✓</span>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>A guest known at every property: preferences, history, balances follow them.</li>
              <li>Central reservations with a property switcher your team will actually use.</li>
              <li>Chain billing, consolidated reporting and loyalty that crosses properties.</li>
            </ul>
            <p className="mkh-tierline">
              Included from <b>Armada</b> ·{' '}
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
        <h2 className="mkh-h2">Questions about multi-property</h2>
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
