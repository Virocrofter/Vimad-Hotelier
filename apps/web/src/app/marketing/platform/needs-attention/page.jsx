/* apps/web/src/app/marketing/platform/needs-attention/page.jsx — Content Mass module page.
 * Claim-lint-gated; every statement traces to the claim register v3.1. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'What lands in the queue?',
    a: 'Whatever breaks the rules you set: a room dirty an hour before arrival, an EFT POP nobody matched, a rate override outside guardrails, a channel sync lagging.',
  },
  {
    q: "Is this another dashboard I'll ignore?",
    a: 'It is the opposite of a dashboard — a to-do list that thinks. If it is on the queue, it needs a human; if it is not, nothing needs you.',
  },
  {
    q: 'What do I get at the higher tiers?',
    a: 'Constellation adds the full exceptions engine, BI roll-ups across departments, and automations that close the loop without a human.',
  },
  {
    q: 'Does it work for groups?',
    a: 'Armada rolls the queue up across properties — one morning glance sees the whole portfolio.',
  },
];

export default function ModulePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform · Command tier and above</p>
          <h1>The queue that thinks ahead of your day.</h1>
          <p className="mkh-hero-sub">
            One exception queue for the whole property: dirty rooms blocking arrivals, unmatched
            payments, guardrail breaches, sync drift — surfaced before they cost you.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-switch-stage">
          <div className="mkh-uicard">
            <h4>
              Needs Attention & Intelligence<span className="mkh-num">LIVE CROP · DEMO TENANT</span>
            </h4>
            <div className="mkh-hk">
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">!</span>
                <span className="mkh-hk-task">Room 104 check-out passed, still dirty</span>
                <span className="mkh-hk-badge mkh-hk-dirty">Now</span>
              </div>
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">!</span>
                <span className="mkh-hk-task">EFT POP awaiting match · R1,500</span>
                <span className="mkh-hk-badge mkh-hk-inspect">Today</span>
              </div>
              <div className="mkh-hk-row">
                <span className="mkh-hk-room">✓</span>
                <span className="mkh-hk-task">Rate override logged · within guardrail</span>
                <span className="mkh-hk-badge mkh-hk-clean">Info</span>
              </div>
            </div>
          </div>
          <div>
            <ul className="mkh-bullets">
              <li>Exceptions ranked by money and time, not by which system noticed them.</li>
              <li>Full engine with BI roll-ups and advanced automations in Constellation.</li>
              <li>Every alert traces back to the exact record — one click from queue to fix.</li>
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
        <h2 className="mkh-h2">Questions about needs attention</h2>
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
