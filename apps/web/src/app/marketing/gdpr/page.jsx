/* [LEGAL-BATCH] Claim-lint-gated legal page for VIMAD (Pty) Ltd.
 * Drafted against POPIA 4/2013, ECTA 25/2002, CPA 68/2008. Founder review before public launch. */
import { Link } from 'react-router-dom';

function Shell({ title, updated, children }) {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 32px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">VIMAD (Pty) Ltd · CIPC Reg 2026/949106/07</p>
          <h1>{title}</h1>
          <p className="updated">Last updated: {updated}</p>
        </div>
      </section>
      <section className="mkh-section mkh-legal" style={{ paddingTop: 8 }}>
        {children}
        <p style={{ marginTop: 40, fontSize: 12, color: 'var(--mk-muted)' }}>
          Questions: <b style={{ color: 'var(--mk-espresso)' }}>efeohise@gmail.com</b> · +27 65 074
          8802 ·{' '}
          <Link to="/contact" style={{ color: 'var(--mk-teal)' }}>
            contact page
          </Link>
        </p>
      </section>
    </div>
  );
}

export default function GdprPage() {
  return (
    <Shell title="Privacy for EU/UK visitors (GDPR note)" updated="27 November 2026">
      <p>
        Vimad is built for and hosted in South Africa, and South African law (POPIA) governs our
        processing. We do not market into the EU and have not appointed an EU representative.
      </p>
      <p>
        If you are an EU/UK data subject and you contact us, the rights you would expect — access,
        rectification, erasure, restriction, objection, portability — are honoured on request to{' '}
        <b>efeohise@gmail.com</b>, to the extent GDPR applies to our processing. The legal basis is
        your consent (enquiries) or contract (customers); data is processed in South Africa, and
        payment data is processed by Paystack under its own privacy terms.
      </p>
      <p>
        Complaints may be raised with your local supervisory authority; we would rather you wrote to
        us first — the founder answers every message.
      </p>
    </Shell>
  );
}
