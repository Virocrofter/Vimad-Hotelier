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

export default function PrivacyPage() {
  return (
    <Shell title="Privacy & POPIA policy" updated="27 November 2026">
      <h2>1. Who we are</h2>
      <p>
        VIMAD (Pty) Ltd (registration 2026/949106/07), based in Durban, South Africa, is the
        responsible party for the personal information collected on this website and through our
        hotel-management service. Our Information Officer is Efeohise Vincent Okpeku —{' '}
        <b>efeohise@gmail.com</b> / +27 65 074 8802.
      </p>
      <h2>2. What we collect</h2>
      <ul>
        <li>
          <b>Enquiry data</b> (quote, demo and contact forms): your name, email, phone number,
          property name, room count, current system, message, and how you found us (page and
          campaign metadata). Submission records include the consent tick and timestamp.
        </li>
        <li>
          <b>Customer data</b> (once you subscribe): your property&rsquo;s configuration and the
          guest and operational data you load into the service. You remain the responsible party for
          your guests&rsquo; data; we act as operator, processing it only to provide the service.
        </li>
        <li>
          <b>Technical data</b>: standard server logs used for security and reliability.
        </li>
      </ul>
      <h2>3. Lawful basis and use</h2>
      <p>
        We process enquiry data with your consent, to respond to your request and prepare quotes. We
        process customer data to deliver the contracted service, keep it secure, and meet legal
        obligations (tax and levy reporting). We do <b>not</b> sell personal information, maintain
        marketing lists you didn&rsquo;t ask for, or profile visitors.
      </p>
      <h2>4. Sharing</h2>
      <p>
        We share data only as needed to run the service: payment processing by Paystack (an
        independent responsible party — card details go to Paystack, never to our servers), hosting
        within South Africa, and regulators or courts where the law compels us. No other disclosure.
      </p>
      <h2>5. Retention</h2>
      <p>
        Enquiry data is kept for up to 24 months unless you become a customer. Customer data is kept
        for the life of the contract and an export window after it ends, then deleted — with backups
        rolling off on their normal cycle. Financial records required by law are retained as the law
        requires.
      </p>
      <h2>6. Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal information, and
        object to processing, by emailing the Information Officer. Access requests are answered
        within the period the law allows (30 days under PAIA). If we can&rsquo;t resolve a
        complaint, you may contact the Information Regulator (South Africa) — inforeg@justice.gov.za
        / 010 023 5200.
      </p>
      <h2>7. Security and cookies</h2>
      <p>
        Summary measures are on our <Link to="/security">security page</Link>. This site currently
        sets no tracking cookies; when analytics are enabled they are cookieless. The booking flow
        and portal use strictly necessary storage to function.
      </p>
      <h2>8. Changes</h2>
      <p>
        If this policy changes materially, we will note the update here. Material changes affecting
        customers will also be notified in the service.
      </p>
    </Shell>
  );
}
