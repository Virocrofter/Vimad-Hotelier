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

export default function SecurityPage() {
  return (
    <Shell title="Security posture" updated="27 November 2026">
      <p className="note">
        We publish our posture, not promises. Every item below describes how the system is built
        today — ask us to demonstrate any of it on a walk-in.
      </p>
      <h2>Account security</h2>
      <ul>
        <li>
          Two-factor authentication (TOTP, compatible with standard authenticator apps) for every
          account.
        </li>
        <li>Role-based access: staff see what their role requires — nothing more.</li>
        <li>Money-actions are audited: who, when, what, on an immutable trail.</li>
      </ul>
      <h2>Payments</h2>
      <p>
        Card data is tokenised and processed by Paystack. Card numbers never touch our servers — see{' '}
        <Link to="/pci-dss">payments &amp; PCI</Link>. Each property&rsquo;s money settles into its
        own Paystack account; we cannot move your funds.
      </p>
      <h2>Infrastructure</h2>
      <ul>
        <li>
          Encryption in transit (TLS) on every connection; access-controlled hosting in South
          Africa.
        </li>
        <li>Nightly backups with test-restore drills; backups roll off on a fixed cycle.</li>
        <li>
          Offline-tolerant front desk: short outages queue work locally rather than losing it.
        </li>
      </ul>
      <h2>POPIA</h2>
      <p>
        Guest erasure on request, ID-scan purging, and a breach-ledger are built into the product.
        If a breach affecting personal information occurs, we will notify the Information Regulator
        and affected data subjects as the law requires. Read the full{' '}
        <Link to="/privacy">privacy policy</Link>.
      </p>
      <h2>Transparency</h2>
      <p>
        Live uptime and incident history on our <Link to="/status">status page</Link>. Found a
        vulnerability? Write to <b>efeohise@gmail.com</b> — we treat responsible disclosures
        seriously and never pursue good-faith researchers.
      </p>
    </Shell>
  );
}
