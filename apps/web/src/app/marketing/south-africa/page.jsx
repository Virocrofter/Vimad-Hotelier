/* apps/web/src/app/marketing/south-africa/page.jsx — Content Mass.
 * The SA-differentiation deep-dive: the five, plus the incentive pairing. */
import { Link } from 'react-router-dom';

const FIVE = [
  {
    title: 'TOMSA, handled',
    body: 'The 1% tourism levy accrues automatically on qualifying charges and produces a remittance report. No calculator, no forgotten line item, no penalty letters.',
  },
  {
    title: 'EFT proof-of-payment matching',
    body: 'Guests pay by EFT; the proof uploads, verifies, and matches to the folio at the payment chokepoint. Nobody hunts bank statements at month-end.',
  },
  {
    title: 'Load-shedding survival',
    body: 'An offline-tolerant front desk queues every mutation and flushes when power returns — plus a printable shift pack for the generator hours.',
  },
  {
    title: 'POPIA out of the box',
    body: 'Guest erasure on request, ID-scan purge, and a breach ledger. Compliance you can demonstrate, not a policy PDF you can hope.',
  },
  {
    title: 'Rand pricing, Durban support',
    body: 'Contracts in rand, quotes from the founder, support from the person who wrote the code. No exchange-rate drift, no ticket queue across an ocean.',
  },
];

const FAQS = [
  {
    q: 'Where is our data hosted?',
    a: 'On our own infrastructure, deployed in-country under your POPIA obligations — with your data exportable at any time, because that clause is the point.',
  },
  {
    q: 'Do you handle TGCSA grading and licences?',
    a: 'Grade, certificate and liquor-licence expiry dates live on the property record, with renewal tasks raised 60 days out. Pairing your grading with clean TOMSA records is also what unlocks Tourism Incentive Programme discounts — ask us about it on the walk-in.',
  },
  {
    q: 'What happens when the power cuts mid-check-in?',
    a: 'The check-in completes. Mutations queue locally and flush when you are back online; the shift pack covers the long outages on paper.',
  },
  {
    q: 'Is this just for small hotels?',
    a: 'Compass starts at 6 rooms and Armada runs multi-property groups on the same spine — the SA five apply at every tier.',
  },
];

export default function SouthAfricaPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Built for South Africa</p>
          <h1>
            Not adapted for it. <em>Built for it.</em>
          </h1>
          <p className="mkh-hero-sub">
            Load-shedding, EFTs, TOMSA, POPIA, rand — the realities global PMSs bolt on later are
            the foundation here. The five, in detail:
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-leaks">
          {FIVE.map((f, i) => (
            <article key={f.title} className="mkh-leak">
              <span className="mkh-num">0{i + 1}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <p className="mkh-kicker">Straight answers</p>
        <h2 className="mkh-h2">The SA questions</h2>
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
