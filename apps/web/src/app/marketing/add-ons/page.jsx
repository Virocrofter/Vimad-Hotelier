/* apps/web/src/app/marketing/add-ons/page.jsx — Content Mass.
 * Add-on line items attachable to any contract. Doctrine: contracts are
 * line-item based, so individual charges move freely. */
import { Link } from 'react-router-dom';

const ADDONS = [
  {
    name: 'SMS credit bundles',
    what: 'Guest notifications and portal links by SMS, sold in bundles at cost-plus.',
    note: 'Real per-message cost — we pass it through.',
  },
  {
    name: 'Onboarding & migration',
    what: 'CSV import, the 30-day parallel run, and the Tuesday-afternoon cutover.',
    note: 'The standard playbook is included; this is the white-glove version.',
  },
  {
    name: 'Training sessions',
    what: 'Remote or on-site sessions for new staff or new seasons.',
    note: 'Per session, booked by the hour.',
  },
  {
    name: 'Priority support SLA',
    what: 'Response-time guarantee below Constellation.',
    note: 'Constellation includes priority support already.',
  },
  {
    name: 'Additional properties',
    what: 'Armada expands per property — shared guests, central reservations.',
    note: 'Priced per property on the group contract.',
  },
];

const NOT = [
  'Parking / bookable spaces — included in Compass (we do not meter what others charge for)',
  'Housekeeping board — core, from Compass up',
  'Core payments — Paystack is part of the spine; only their processing fees apply',
  'The direct booking engine — included from Compass at 0% commission',
];

export default function AddOnsPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Add-ons</p>
          <h1>
            Attach what you need. <em>Never rent the basics.</em>
          </h1>
          <p className="mkh-hero-sub">
            Contracts are line-item based, so add-ons attach cleanly and move freely as you grow.
            Processing fees are Paystack&rsquo;s own and always shown separately.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-cmp-table">
          <table>
            <thead>
              <tr>
                <th>Add-on</th>
                <th>What it is</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {ADDONS.map((a) => (
                <tr key={a.name}>
                  <td className="cap">{a.name}</td>
                  <td>{a.what}</td>
                  <td>{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mkh-verdict" style={{ borderLeftColor: 'var(--mk-teal)' }}>
          <b>Deliberately not add-ons</b>
          <p>{NOT.join(' · ')}.</p>
        </div>
        <div className="mkh-cta-row" style={{ marginTop: 32 }}>
          <Link className="mkh-pill" to="/get-quote">
            Get your quote
          </Link>
          <Link className="mkh-ghost" to="/pricing">
            See the tiers
          </Link>
        </div>
      </section>
    </div>
  );
}
