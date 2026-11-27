/* apps/web/src/app/marketing/platform/housekeeping/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'Is housekeeping really included from the lowest tier?',
    a: 'Yes. Some global vendors bought a housekeeping company and gated it behind their expensive tier. Here it is core, from Compass up.',
  },
  {
    q: "Our cleaners aren't technical.",
    a: 'Three taps is the whole interface. If a cleaner can use WhatsApp, they can run this board — and task cards render in their language.',
  },
  {
    q: 'Can maintenance issues be logged the same way?',
    a: 'Yes — a leaking tap is a task like a dirty room. Track who fixed it, when, and whether it came back.',
  },
  {
    q: 'Does the front desk see it?',
    a: 'That is the point: housekeeping status flows straight to the tape chart, so nobody sells a dirty room.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Compass tier and above</p>
          <h1>The board your whole team reads.</h1>
          <p className="mkh-hero-sub">
            A three-tap, multilingual housekeeping and maintenance board — included from Compass,
            not gated behind an enterprise tier.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              Housekeeping & Maintenance
              <span className="mkh-num">SAMPLE DATA · SHIPPED FEATURES</span>
            </h4>
            <div className="mkh-hk">
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">104</span>
                <span className="mkh-hk-task">Departure clean + inspect</span>
                <span className="mkh-hk-badge mkh-hk-dirty">Dirty</span>
              </div>
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">203</span>
                <span className="mkh-hk-task">Stayover, towels</span>
                <span className="mkh-hk-badge mkh-hk-inspect">Inspect</span>
              </div>
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">305</span>
                <span className="mkh-hk-task">Arrival ready by 14:00</span>
                <span className="mkh-hk-badge mkh-hk-clean">Clean</span>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>
                Clean, dirty, inspect — the whole floor on a phone screen, prioritised by arrival
                time.
              </li>
              <li>Task cards in the languages your team actually speaks.</li>
              <li>Maintenance tickets attached to rooms, tracked to completion.</li>
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
        <h2 className="mkh-h2">Questions about housekeeping</h2>
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
