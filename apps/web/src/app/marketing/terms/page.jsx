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

export default function TermsPage() {
  return (
    <Shell title="Terms of service" updated="27 November 2026">
      <h2>1. The agreement</h2>
      <p>
        This website is an invitation to do business, not an offer. Our services are provided under
        a written quote and contract for your property, incorporating these terms. Where the
        contract and these terms differ, the contract prevails.
      </p>
      <h2>2. The service</h2>
      <p>
        Hosted hotel-management software, quoted per property. Payment processing is provided by
        Paystack; their processing fees are theirs, are shown separately in your contract, and are
        governed by Paystack&rsquo;s own terms.
      </p>
      <h2>3. Your data</h2>
      <p>
        You own your data. You can export guests, history and financial records at any time, without
        asking permission. On termination you receive an export window; after it closes we delete
        your data (backups roll off on schedule), keeping only what the law requires us to keep. You
        are responsible for lawfully collecting your guests&rsquo; data into the service and for
        your own POPIA duties as responsible party.
      </p>
      <h2>4. Acceptable use</h2>
      <p>
        Use the service lawfully. Don&rsquo;t upload unlawful content, attempt to breach the
        service, or process data you have no right to process. We may suspend access that endangers
        the service or other customers, with notice where practicable.
      </p>
      <h2>5. Fees</h2>
      <p>
        As per your contract. Founder pricing applies for the lock-in period stated in your
        contract. Third-party fees (Paystack, SMS bundles) are pass-through and always disclosed.
      </p>
      <h2>6. Warranties and liability</h2>
      <p>
        We provide the service with reasonable skill and care. To the maximum extent the law allows,
        other warranties are excluded, and our total liability for any claim is capped at the fees
        you paid in the 3 months before the claim arose. We are not liable for indirect or
        consequential loss (lost profits, lost bookings). Nothing in these terms excludes liability
        that South African law does not allow to be excluded.
      </p>
      <h2>7. Term, termination and move-back</h2>
      <p>
        Your contract states its term and renewal. You may export and leave at any time; where our
        Switch offer applies, move-back assistance follows its published terms. Sections on data
        export, liability and law survive termination.
      </p>
      <h2>8. General</h2>
      <p>
        South African law governs. Disputes go to the courts of Durban, unless your contract says
        otherwise. Electronic records and signatures are recognised (ECTA). If a clause is invalid,
        the rest stands. This agreement is the whole agreement — no side promises count unless
        written.
      </p>
    </Shell>
  );
}
