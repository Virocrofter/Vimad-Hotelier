/* apps/web/src/app/marketing/alternatives/{cloudbeds,hilton-onq,opera-5}/page.jsx — [M1] honest compare page.
 * Replaces the old template alternative page. Self-published, claim-lint-gated;
 * competitor strengths marked as theirs. Part of the Money Pages set. */
import { Link } from 'react-router-dom';

export default function ComparePage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Vimad vs the legacy PMS</p>
          <h1>
            Priced in euros. Supported from a call centre.
            <br />
            <em>Updated never.</em>
          </h1>
          <p className="mkh-hero-sub">
            Legacy systems carry decades of features — and the baggage of decades. The question
            isn't what they can do; it's whether you use 10% of it while it uses 100% of your
            patience.
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
                <th>Legacy PMS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="cap">Priced in rand, quoted per property, no euro surprises</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">
                  Founder-on-the-phone support, in your timezone, in plain language
                </td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">EFT proof-of-payment matching</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">TOMSA 1% levy auto-calculated</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Load-shedding: offline queue + printable shift pack</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">POPIA erasure, ID-scan purge, breach ledger</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Ships improvements every week</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Cutover in one afternoon + 30-day parallel run</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Export everything, any time, no exit fee</td>
                <td>
                  <span className="mkh-cmp-yes">✓ Included</span>
                </td>
                <td>
                  <span className="mkh-cmp-no">—</span>
                </td>
              </tr>
              <tr>
                <td className="cap">Feature depth from 20 years in the market</td>
                <td>
                  <span className="mkh-cmp-theirs">Growing fast — ask for the roadmap</span>
                </td>
                <td>
                  <span className="mkh-cmp-theirs">✓ Their real strength</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mkh-verdict">
          <b>The honest verdict</b>
          <p>
            Legacy vendors know more about hotels than we'll ever need to — most of it is features
            you'll never touch, at prices negotiated in another currency, with updates measured in
            years. Vimad is the opposite bet: everything shipped is running code you can see working
            on your own numbers in 15 minutes.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <p className="mkh-kicker">Straight answers</p>
        <h2 className="mkh-h2">The questions owners ask</h2>
        <div className="mkh-faq">
          <details>
            <summary>Will I lose features I rely on?</summary>
            <p>
              Maybe — if the feature is genuinely exotic. Run the 30-day parallel against your
              current system and you'll know by week two. Our side of the matrix above is live
              today, not roadmap.
            </p>
          </details>
          <details>
            <summary>How does migration actually work?</summary>
            <p>
              We export from your current system (CSV), import, run parallel for 30 days, and cut
              over on a Tuesday afternoon. Your team keeps working through all of it.
            </p>
          </details>
          <details>
            <summary>What about our data?</summary>
            <p>
              It's yours. Export guests, history and financials at any time — that clause is the
              point, not the fine print.
            </p>
          </details>
          <details>
            <summary>Who answers when something breaks at 21:00 in Durban?</summary>
            <p>The founder. +27 65 074 8802. No ticket queue, no timezone math.</p>
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
