/* apps/web/src/app/marketing/platform/page.jsx — Content Mass hub.
 * Targets "hotel management software South Africa" honestly. */
import { Link } from 'react-router-dom';

const MODULES = [
  {
    to: '/platform/front-desk',
    title: 'Front Desk & Reservations',
    body: 'Tape chart, walk-ins, 45-second check-in.',
  },
  {
    to: '/platform/housekeeping',
    title: 'Housekeeping & Maintenance',
    body: 'Three-tap multilingual board — included, not an add-on.',
  },
  {
    to: '/platform/payments',
    title: 'Payments',
    body: 'Paystack, EFT proof-of-payment matching, your own account.',
  },
  {
    to: '/platform/accounting',
    title: 'Accounting & SARS',
    body: 'Continuous tie-out, TOMSA, Xero/Sage CSV.',
  },
  {
    to: '/platform/direct-booking',
    title: 'Direct Booking & Distribution',
    body: '0% commission widget, honest channel pills.',
  },
  {
    to: '/platform/guest-portal',
    title: 'Guest Portal & Upsells',
    body: 'Verified R145 to R495 per stay.',
  },
  {
    to: '/platform/fnb',
    title: 'F&B / QR Order & Pay',
    body: 'Order to folio, one bill at checkout.',
  },
  {
    to: '/platform/needs-attention',
    title: 'Needs Attention & Intelligence',
    body: 'The exception queue that thinks ahead.',
  },
  {
    to: '/platform/chains',
    title: 'Multi-Property & Chains',
    body: 'Shared guests, central reservations, chain billing.',
  },
];

export default function PlatformPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Platform</p>
          <h1>
            Hotel management software, <em>built in South Africa.</em>
          </h1>
          <p className="mkh-hero-sub">
            Nine modules on one spine — front desk to SARS. Every module below is running code you
            can see working on your own numbers in 15 minutes.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-modgrid">
          {MODULES.map((m) => (
            <Link key={m.to} to={m.to} className="mkh-modcard">
              <h3>{m.title}</h3>
              <p>{m.body}</p>
            </Link>
          ))}
        </div>
        <div className="mkh-cta-row" style={{ marginTop: 32 }}>
          <Link className="mkh-pill" to="/get-quote">
            Get your quote
          </Link>
          <Link className="mkh-ghost" to="/south-africa">
            Why South Africa-first matters
          </Link>
        </div>
      </section>
    </div>
  );
}
