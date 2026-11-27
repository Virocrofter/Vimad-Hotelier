/* about/page.jsx — the old page listed an imaginary team and invented stats.
 * This is the true story, and it is better. */
import { Link } from 'react-router-dom';

const FACTS = [
  { value: '01', label: 'founder — the person who answers your calls also writes the code' },
  { value: '09', label: 'modules on one spine, from front desk to SARS' },
  {
    value: '05',
    label: 'founding properties — the cohort every early number on this site will come from',
  },
  { value: 'Durban', label: 'built here, for South African load-shedding, EFTs and TOMSA' },
];

export default function AboutPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 40px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">About</p>
          <h1>
            One hotel. One system. <em>No leaks.</em>
          </h1>
          <p className="mkh-hero-sub">
            Vimad is a South African company — VIMAD (Pty) Ltd, registered November 2026 — building
            the hotel operating system the local market never got: rand-priced, load-shedding-proof,
            POPIA-native, and honest enough to publish its claim register.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-statstrip">
          {FACTS.map((f) => (
            <div key={f.label} className="mkh-stat">
              <b>{f.value}</b>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="mkh-section mkh-founder" style={{ paddingTop: 16 }}>
        <div>
          <p className="mkh-kicker">The team</p>
          <h2 className="mkh-h2">The founder is the support desk.</h2>
          <p>
            No account managers, no ticket queues, no offshore call centre. You phone +27 65 074
            8802 and the person who answers wrote the system — ask for the thing you need, and if it
            belongs in a hotel operating system, it ships.
          </p>
          <p className="mkh-contactline">
            efeohise@gmail.com ·{' '}
            <Link to="/status" style={{ color: 'var(--mk-teal)', fontWeight: 700 }}>
              live status page
            </Link>
          </p>
        </div>
        <div className="mkh-statuscard">
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--mk-espresso)' }}>
            Why trust a young company?
          </p>
          <p style={{ fontSize: 13, color: 'var(--mk-body)', lineHeight: 1.6 }}>
            Because every claim on this site traces to running code, every page passes a claim-lint
            gate, your money never touches our accounts, and you can leave with a full export any
            time. Trust is a feature here.
          </p>
        </div>
      </section>
    </div>
  );
}
