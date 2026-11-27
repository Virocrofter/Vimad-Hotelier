/* partners/page.jsx — the old page promised commission tiers and showed a logo
 * wall of companies we have never integrated. Replaced with what is actually true. */
import { Link } from 'react-router-dom';

const PATHS = [
  {
    title: 'Accountants & bookkeepers',
    body: 'Your practice stays yours. Vimad does the plumbing — continuous tie-out, TOMSA remittance-ready, Xero/Sage CSV export — and refers clients in your area when properties ask us who to trust.',
  },
  {
    title: 'Hospitality consultants',
    body: 'Take the walk-in demo kit to your clients: the iPad tour, the leave-behind, the 15-minute look at their own numbers. If your client signs, you did the work — write to us about referral terms.',
  },
  {
    title: 'Integrators & developers',
    body: 'API access is included from the Command tier and webhooks already ship. Tell us what two properties need and it goes on the roadmap — we build against demand, not logo walls.',
  },
];

export default function PartnersPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 40px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Work with Vimad</p>
          <h1>
            Partnerships, <em>honestly.</em>
          </h1>
          <p className="mkh-hero-sub">
            There is no commission structure yet and no logo wall — there will be, once it is real.
            What exists today is three genuine ways to work together.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-segs">
          {PATHS.map((p) => (
            <div key={p.title} className="mkh-seg">
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mkh-cta-row" style={{ marginTop: 32 }}>
          <Link className="mkh-pill" to="/contact">
            Start the conversation
          </Link>
        </div>
      </section>
    </div>
  );
}
