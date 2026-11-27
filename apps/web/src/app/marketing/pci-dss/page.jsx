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

export default function PciPage() {
  return (
    <Shell title="Payments &amp; PCI" updated="27 November 2026">
      <h2>The short version</h2>
      <p>
        Your guests&rsquo; card details go to Paystack — a PCI DSS Level 1 certified payment
        provider — and never touch Vimad&rsquo;s servers. We store no card numbers, no CVVs, no card
        expiry data. There is no cardholder-data environment to breach on our side.
      </p>
      <h2>What that means for your property</h2>
      <ul>
        <li>
          Deposits and payments are taken through Paystack&rsquo;s hosted flows, tokenised end to
          end.
        </li>
        <li>
          Each property settles into its own Paystack account. We never hold, pool or move your
          funds — reconciliation is yours to the cent.
        </li>
        <li>
          EFT payments run bank-to-bank; uploaded proofs of payment are matched to folios in the
          system, and the paper trail stays yours.
        </li>
      </ul>
      <h2>Honest scope</h2>
      <p>
        Because card data never enters our environment, our PCI scope is minimal by architecture,
        not by paperwork. When your bank or accountant asks, the answer is simple: card processing
        is Paystack&rsquo;s regulated environment; Vimad touches tokens and payment status only.
        Questions: <b>efeohise@gmail.com</b>.
      </p>
    </Shell>
  );
}
