/* apps/web/src/app/marketing/integrations/page.jsx — [FULL-SWEEP FIX]
 * The fabricated vendor catalog (payments, POS, door-lock and CRM vendors we
 * have never integrated) was removed. This page lists ONLY what is live or in
 * pilot, with pills. Everything else is "ask us", not a logo wall. */
import { Link } from 'react-router-dom';

const LIVE = [
  {
    name: 'Paystack',
    what: 'Card payments, EFT, deposits and reconciliation — into your own Paystack account.',
    detail: 'LIVE · every tier',
  },
  {
    name: 'Xero / Sage',
    what: 'Accounting export as clean CSV — your bookkeeper keeps their package.',
    detail: 'LIVE · every tier',
  },
];
const PILOT = [
  {
    name: 'Channex',
    what: 'OTA channel sync — availability and reservations to and from the OTAs.',
    detail: 'PILOT · honest status while it proves itself',
  },
  {
    name: 'LekkeSlaap',
    what: 'South African booking-channel connectivity.',
    detail: 'PILOT · growing with pilot properties',
  },
];

export default function IntegrationsPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Integrations</p>
          <h1>
            Every integration, <em>honestly labeled.</em>
          </h1>
          <p className="mkh-hero-sub">
            You have been burned by logo walls before — vendors claiming a thousand connections that
            half-work. This page is short on purpose. When a connection graduates from pilot to
            live, its pill changes here.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <p className="mkh-kicker" style={{ color: 'var(--mk-teal)' }}>
          Live
        </p>
        <div className="mkh-segs">
          {LIVE.map((i) => (
            <div key={i.name} className="mkh-seg">
              <h3>{i.name}</h3>
              <p>{i.what}</p>
              <span className="go" style={{ color: 'var(--mk-teal)' }}>
                {i.detail}
              </span>
            </div>
          ))}
        </div>
        <p className="mkh-kicker" style={{ marginTop: 36, color: 'var(--mk-gold)' }}>
          Pilot
        </p>
        <div className="mkh-segs">
          {PILOT.map((i) => (
            <div key={i.name} className="mkh-seg">
              <h3>{i.name}</h3>
              <p>{i.what}</p>
              <span className="go" style={{ color: 'var(--mk-gold)' }}>
                {i.detail}
              </span>
            </div>
          ))}
        </div>
        <div className="mkh-verdict" style={{ marginTop: 32 }}>
          <b>Do not see your tool?</b>
          <p>
            We build integrations against real demand, not marketing slides. Tell us what you need
            on the{' '}
            <Link to="/contact" style={{ color: 'var(--mk-ember)', fontWeight: 700 }}>
              contact page
            </Link>{' '}
            — if two properties need it, it goes on the roadmap. What you will not find here: a wall
            of logos we have never touched.
          </p>
        </div>
      </section>
    </div>
  );
}
