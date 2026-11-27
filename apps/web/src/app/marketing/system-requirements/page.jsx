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

export default function SysReqPage() {
  return (
    <Shell title="System requirements" updated="27 November 2026">
      <h2>To run Vimad</h2>
      <ul>
        <li>
          Any modern device: laptop, tablet or phone. No installation — it runs in the browser.
        </li>
        <li>A current version of Chrome, Edge, Firefox or Safari.</li>
        <li>
          An internet connection for live features. The front desk tolerates short outages by
          queuing work locally and flushing when you&rsquo;re back online; a printable shift pack
          covers extended power cuts.
        </li>
      </ul>
      <h2>Optional</h2>
      <ul>
        <li>A printer for the paper shift pack (recommended for load-shedding cover).</li>
        <li>Receipt printer and cash drawer for the till module — standard USB models work.</li>
      </ul>
      <p>
        No servers, no on-site hardware, no IT department required. If a device runs WhatsApp, it
        runs Vimad.
      </p>
    </Shell>
  );
}
