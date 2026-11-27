/* apps/web/src/app/marketing/alternatives/{cloudbeds,hilton-onq,opera-5}/page.jsx — [M1] honest compare page.
 * Replaces the old template alternative page. Self-published, claim-lint-gated;
 * competitor strengths marked as theirs. Part of the Money Pages set. */
import { Link } from 'react-router-dom';

export default function ComparePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Vimad vs the spreadsheet & paper diary</p>
          <h1>Your diary can't tell you Room 7 is dirty.</h1>
          <p className="mkh-hero-sub">
            The book works until the day it doesn't — the double-booking, the unmatched EFT, the
            licence that expired while nobody was watching. Here's the honest cost of paper.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 24 }}>
        <div className="mkh-cmp-table">
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Vimad</th>
                <th>Spreadsheet & diary</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="cap">Live availability across front desk, phone and online</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Housekeeping sees arrivals before the guest parks</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Guest history — preferences, allergies, no-show flags</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Automatic payment reconciliation, to the cent</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">EFT proof-of-payment matched to the folio</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">
                  TOMSA levy + SARS-ready books, without an accountant's weekend
                </td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Licence & TGCSA expiry alerts, 60 days out</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Pre-arrival upsells offered and collected automatically</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">No night audit — the books tie out continuously</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">POPIA: guest erasure, ID-scan purge, breach ledger</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Works when the power doesn't (offline queue + shift pack)</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Cheap</td>
                <td>
                  <span className="mkh-cmp-theirs">R0 — the book costs nothing</span>
                </td>
                <td>
                  <span className="mkh-cmp-theirs">✓ Until it costs you a booking</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mkh-verdict">
          <b>The honest verdict</b>
          <p>
            The diary is free the way a leak is free — you pay for it in double-bookings,
            uncollected EFTs, levy penalties and the owner's Sunday nights. Every row above is a job
            someone at your property is doing by hand today, or isn't doing at all.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <p className="mkh-kicker">Straight answers</p>
        <h2 className="mkh-h2">The questions owners ask</h2>
        <div className="mkh-faq">
          <details>
            <summary>My property is small. Isn't a PMS overkill?</summary>
            <p>
              Compass was designed for 6–20 rooms — the size where the owner IS the front desk. The
              whole point is giving you back the hours the book steals.
            </p>
          </details>
          <details>
            <summary>What about my bookkeeper?</summary>
            <p>
              They keep their job — they just stop chasing paper. Xero/Sage CSV export and a
              continuous tie-out mean month-end takes hours, not days.
            </p>
          </details>
          <details>
            <summary>We're not technical. Who sets this up?</summary>
            <p>
              We do. CSV import, a Tuesday-afternoon cutover, and a 30-day parallel run. You phone
              the founder directly if anything feels wrong — +27 65 074 8802.
            </p>
          </details>
          <details>
            <summary>What if it doesn't work out?</summary>
            <p>
              Export everything and we move you back, free. The 30-day parallel run exists precisely
              so you're never gambling.
            </p>
          </details>
        </div>
        <div className="mkh-cta-row" style={{ marginTop: 32 }}>
          <Link className="mkh-pill" to="/contact">
            Get your quote
          </Link>
          <Link className="mkh-ghost" to="/demo">
            Book a walk-in demo
          </Link>
        </div>
      </section>
    </div>
  );
}
