/* apps/web/src/app/marketing/alternatives/page.jsx — [M2] compare hub.
 * Landing for every "Compare" link. Each card points at a self-published,
 * claim-lint-gated comparison. */
import { Link } from 'react-router-dom';

const PAGES = [
  {
    to: '/alternative/cloudbeds',
    title: 'vs the booking widget',
    body: 'A widget takes the booking. Then what? The honest matrix — including the two rows the widget wins.',
  },
  {
    to: '/alternative/hilton-onq',
    title: 'vs the spreadsheet & paper diary',
    body: 'Your diary can&rsquo;t tell you Room 7 is dirty. The real cost of free.',
  },
  {
    to: '/alternative/opera-5',
    title: 'vs the legacy PMS',
    body: 'Priced in euros, supported from a call centre, updated never. And what they&rsquo;re genuinely good at.',
  },
];

export default function CompareHubPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Compare</p>
          <h1>The honest comparisons.</h1>
          <p className="mkh-hero-sub">
            Written by us, against running code. Every row is something you can ask us to
            demonstrate live — on your own numbers, in 15 minutes.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-segs">
          {PAGES.map((p) => (
            <Link key={p.to} to={p.to} className="mkh-seg">
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <span className="go">
                Read the comparison <span className="arr">→</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="mkh-cta-row" style={{ marginTop: 32 }}>
          <Link className="mkh-pill" to="/get-quote">
            Get your quote
          </Link>
        </div>
      </section>
    </div>
  );
}
