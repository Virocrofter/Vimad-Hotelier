/* apps/web/src/app/marketing/alternatives/{cloudbeds,hilton-onq,opera-5}/page.jsx — [M1] honest compare page.
 * Replaces the old template alternative page. Self-published, claim-lint-gated;
 * competitor strengths marked as theirs. Part of the Money Pages set. */
import { Link } from 'react-router-dom';

export default function ComparePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Vimad vs the booking widget</p>
          <h1>
            A widget takes the booking.
            <br />
            <em>Then what?</em>
          </h1>
          <p className="mkh-hero-sub">
            Booking widgets are good at one thing: putting a reservation form on your website. This
            is the honest comparison of what happens after the booking is made.
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
                <th>Booking widget</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="cap">
                  Front desk & reservations — tape chart, walk-ins, 45-second check-in
                </td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Housekeeping & maintenance board (included, not an add-on)</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Guest profiles & stay history</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Payments + automatic reconciliation (your own Paystack)</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">EFT proof-of-payment matching to the folio</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">TOMSA 1% levy auto-calculated, remittance-ready</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">SARS-ready accounting with Xero/Sage CSV export</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Conversational pre-arrival upsells</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">
                  Multi-property: shared guests, chain billing, central reservations
                </td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Live public status page</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Direct booking engine on your own website</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-theirs">✓ Their core job</span>
                </td>
              </tr>
              <tr>
                <td className="cap">OTA channel connections</td>
                <td>
                  <span className="mkh-cmp-theirs">In pilot — LIVE/PILOT pills on our site</span>
                </td>
                <td>
                  <span className="mkh-cmp-theirs">✓ Their other core job</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mkh-verdict">
          <b>The honest verdict</b>
          <p>
            If all you need is a booking button, keep the widget — they are good at it. But a button
            can't clean a room, split a folio, match an EFT, or file your TOMSA. That is the other
            90% of running a hotel, and it is the part Vimad does. Most properties end up running
            the widget <i>plus</i> a diary <i>plus</i> spreadsheets — one system replaces all three.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <p className="mkh-kicker">Straight answers</p>
        <h2 className="mkh-h2">The questions owners ask</h2>
        <div className="mkh-faq">
          <details>
            <summary>Can I keep my booking widget and still use Vimad?</summary>
            <p>
              You can keep any distribution you love. Vimad replaces what happens after the booking
              — front desk, housekeeping, money, compliance. When you're ready, the direct engine at
              0% commission is already inside.
            </p>
          </details>
          <details>
            <summary>Will I pay double for a booking engine?</summary>
            <p>
              No — the direct booking engine with Paystack deposits is included from Compass, at 0%
              commission on your own site.
            </p>
          </details>
          <details>
            <summary>What happens to my existing bookings if I switch?</summary>
            <p>
              We import them (CSV), you run parallel for 30 days, and cut over on a Tuesday
              afternoon. If it doesn't win, we move you back — free.
            </p>
          </details>
          <details>
            <summary>Is this comparison fair?</summary>
            <p>
              The widget's two rows are marked as theirs on purpose. We don't claim to beat a
              booking engine at being a booking engine — we claim the widget was never meant to run
              a hotel, and the matrix above is what 'running a hotel' actually consists of.
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
