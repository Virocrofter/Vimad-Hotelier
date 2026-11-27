/* apps/web/src/app/marketing/solutions/page.jsx — solutions hub.
 * By property and by role; every card lands on a claim-lint-gated page. */
import { Link } from 'react-router-dom';

const BY_PROPERTY = [
  {
    to: '/solutions/boutique-hotels',
    title: 'Boutique Hotels & Lodges',
    body: '20–80 rooms: full ops, rate guardrails, City Ledger, upsells.',
  },
  {
    to: '/solutions/hotel-chains',
    title: 'Multi-Property Groups',
    body: 'Shared guests, central reservations, chain billing.',
  },
  {
    to: '/solutions/contactless-checkin',
    title: 'Guesthouses & B&Bs',
    body: '6–20 rooms: the diary replacement that pays for itself.',
  },
  {
    to: '/demo',
    title: 'Conference & Wedding Venues',
    body: 'Banqueting and events on the same folio spine.',
  },
];
const BY_ROLE = [
  {
    to: '/platform/needs-attention',
    title: 'Owners & GMs',
    body: 'The exception queue that thinks ahead of your day.',
  },
  {
    to: '/platform/front-desk',
    title: 'Front Desk',
    body: '45-second check-in, tape chart, audited rate overrides.',
  },
  {
    to: '/platform/accounting',
    title: 'Finance & Bookkeepers',
    body: 'Continuous tie-out, TOMSA remittance-ready, Xero/Sage CSV.',
  },
  {
    to: '/platform/housekeeping',
    title: 'Housekeeping & Maintenance',
    body: 'The three-tap multilingual board.',
  },
];

export default function SolutionsPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Solutions</p>
          <h1>
            By property. <em>By role.</em>
          </h1>
          <p className="mkh-hero-sub">
            However your operation is shaped, there is a spine for it. Start with what you run — or
            with the hat you wear.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <p className="mkh-kicker">By property</p>
        <div className="mkh-segs">
          {BY_PROPERTY.map((s) => (
            <Link key={s.to} to={s.to} className="mkh-seg">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <span className="go">
                Explore <span className="arr">→</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="mkh-kicker" style={{ marginTop: 40 }}>
          By role
        </p>
        <div className="mkh-segs">
          {BY_ROLE.map((s) => (
            <Link key={s.to} to={s.to} className="mkh-seg">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <span className="go">
                Explore <span className="arr">→</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="mkh-cta-row" style={{ marginTop: 32 }}>
          <Link className="mkh-pill" to="/get-quote">
            Get your quote
          </Link>
        </div>
      </section>
    </div>
  );
}
