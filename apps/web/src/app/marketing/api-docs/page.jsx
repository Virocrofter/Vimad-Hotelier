/* api-docs/page.jsx — the old page listed endpoints, SDKs and specs nobody wrote,
 * hosted at a nonsense URL. Replaced with what is real today and how to get more. */
import { Link } from 'react-router-dom';

export default function ApiDocsPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 40px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Developers</p>
          <h1>
            An API that exists <em>beats a spec that doesn&rsquo;t.</em>
          </h1>
          <p className="mkh-hero-sub">
            The old version of this page listed imaginary endpoints and SDKs. This one lists only
            what runs — and tells you how to get the rest.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-leaks">
          <article className="mkh-leak">
            <span className="mkh-num">LIVE</span>
            <h3>Webhooks</h3>
            <p>
              Event subscriptions ship today — your systems can listen to bookings, payments and
              check-ins as they happen.
            </p>
          </article>
          <article className="mkh-leak">
            <span className="mkh-num">LIVE</span>
            <h3>Public status &amp; booking APIs</h3>
            <p>
              The live status feed and the embeddable booking widget (
              <span className="mkh-mono">vimad-booking.js</span>) are public, documented in your
              tenant, and working now.
            </p>
          </article>
          <article className="mkh-leak">
            <span className="mkh-num">INCLUDED</span>
            <h3>Full API access — Command tier up</h3>
            <p>
              Tenant-scoped API keys, issued from your dashboard. Self-serve docs ship inside the
              product; integration help is a phone call to the founder.
            </p>
          </article>
        </div>
        <div className="mkh-verdict" style={{ marginTop: 24 }}>
          <b>Need something specific?</b>
          <p>
            Tell us the integration on the{' '}
            <Link to="/contact" style={{ color: 'var(--mk-ember)', fontWeight: 700 }}>
              contact page
            </Link>{' '}
            — if two properties need it, it goes on the roadmap. What you won&rsquo;t find here
            anymore: a reference for endpoints we haven&rsquo;t shipped.
          </p>
        </div>
      </section>
    </div>
  );
}
