/* case-studies/page.jsx — the four "case studies" that lived here were invented
 * (named people, invented percentages). Replaced with an honest shelf: the
 * first real, named pilot stories land with the founding cohort. */
import { Link } from 'react-router-dom';

export default function CaseStudiesPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '80px 24px 48px' }}>
        <div className="mkh-hero-inner" style={{ maxWidth: 720 }}>
          <p className="mkh-kicker">Pilot stories</p>
          <h1>
            Real numbers, <em>named properties,</em> or nothing.
          </h1>
          <p className="mkh-hero-sub">
            You have read enough invented case studies to smell one from a mile away. So this page
            stays empty until it isn&rsquo;t: the first stories here will come from our founding
            cohort of five South African properties — with their names, their room counts, and
            numbers we can show the working for.
          </p>
          <div className="mkh-cta-row">
            <Link className="mkh-pill" to="/demo">
              Become a founding property
            </Link>
            <Link className="mkh-ghost" to="/blog">
              Read the Switcher&rsquo;s Library
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
