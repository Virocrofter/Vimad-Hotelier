/* apps/web/src/app/marketing/page.jsx — Foundation F3.
 * Homepage rebuilt on the Ember & Paper Marketing Edition sheet (DS-M1).
 * Spine (locked 2026-11-27): "One hotel. One system. No leaks."
 * Old template (36KB, quarantined) replaced wholesale. Image-free per policy;
 * the ghost-grid + floating card composition is pure CSS.
 */
import { Link } from 'react-router-dom';
import '../../styles/marketing-home.css';

const LEAKS = [
  {
    num: '01',
    title: 'Money',
    body: 'Two direct bookings a month cover the fee — the other thirty shouldn’t pay for someone’s yacht. 0% booking widget plus a verified upsell loop (R145→R495 per stay).',
  },
  {
    num: '02',
    title: 'Money you never see',
    body: 'Guest payments land in your own Paystack account. Vimad never touches them — you reconcile to the cent, and nobody here can.',
  },
  {
    num: '03',
    title: 'Continuity',
    body: 'Power cut mid-check-in? The queue holds every mutation and flushes when you’re back online — plus a printable shift pack for when the generator wins.',
  },
  {
    num: '04',
    title: 'Compliance',
    body: 'TOMSA 1% levy auto-calculated. SARS-ready books. TGCSA grade and liquor licences flagged 60 days before expiry. POPIA erasure built in.',
  },
  {
    num: '05',
    title: 'Time',
    body: 'No night audit. No double entry. A Needs Attention queue that tells your team the next action instead of making them hunt for it.',
  },
  {
    num: '06',
    title: 'Trust',
    body: 'Export everything, any time. Run parallel for 30 days. Move back free if it doesn’t win. And the founder answers the phone — no ticket queue.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'A guest books direct',
    body: 'On your own website, at 0% commission, with a Paystack deposit. Channels stay in sync where it counts.',
  },
  {
    num: '02',
    title: 'The house knows before they park',
    body: 'Housekeeping sees the arrival on a three-tap multilingual board. Front desk checks them in under 45 seconds.',
  },
  {
    num: '03',
    title: 'The money sorts itself',
    body: 'The folio splits — corporate to City Ledger, the levy to TOMSA, VAT to SARS-ready books. One bill at checkout.',
  },
];

const TIERS = [
  {
    name: 'Compass',
    who: 'Guesthouses · 6–20 rooms',
    points: [
      'Front desk + tape chart',
      'Housekeeping board',
      'Direct bookings',
      'Paystack + EFT matching',
    ],
  },
  {
    name: 'Command',
    who: 'Boutique hotels · 20–80 rooms',
    points: [
      'Everything in Compass',
      'Rate guardrails',
      'Folio split + City Ledger',
      'Guest portal upsells',
    ],
  },
  {
    name: 'Constellation',
    who: 'Large properties · 80+',
    points: [
      'Everything in Command',
      'Needs Attention queue',
      'BI roll-ups',
      'Audited 3-click overrides',
    ],
  },
  {
    name: 'Armada',
    who: 'Groups · 2+ properties',
    points: [
      'Everything in Constellation',
      'Shared guest profiles',
      'Central reservations',
      'Chain billing + loyalty',
    ],
  },
];

const FAQS = [
  {
    q: 'Do I still need my booking widget?',
    a: 'A widget takes the booking — then what? Vimad takes the booking, cleans the room, splits the folio, and files the VAT. See the comparison pages for the honest matrix.',
  },
  {
    q: 'Is my data POPIA-safe?',
    a: 'POPIA-compliant out of the box: guest erasure on request, ID-scan purge, and a breach ledger — running code, not a policy PDF. Your guests’ card details are tokenised by Paystack; we never see card numbers.',
  },
  {
    q: 'What happens when the power cuts?',
    body: 'The front desk keeps working — check-ins and changes queue locally and flush when you’re back online. For the long outages there’s a printable shift pack: arrivals, departures, room states on paper.',
  },
  {
    q: 'How is pricing worked out?',
    a: 'Per property, by quote — room count, the tier you need, the add-ons you want. Founding hotels lock founder pricing for the life of the contract. Paystack’s processing fees are always shown separately.',
  },
  {
    q: 'Can I leave if it doesn’t work out?',
    a: 'Yes — that’s the point of the 30-day parallel run. Export your guests, history, and books any time. If Vimad doesn’t win, we move you back ourselves, free.',
  },
  {
    q: 'How do I actually see it working?',
    a: 'Book a walk-in demo — it runs on an iPad, on your own numbers, in about 15 minutes. Or take the guided demo sandbox for a spin.',
  },
];

export default function MarketingHomePage() {
  return (
    <div className="mkh">
      {/* HERO */}
      <section className="mkh-hero">
        <div className="mkh-ghostgrid" aria-hidden="true" />
        <div className="mkh-floatcard" aria-hidden="true">
          <div className="t">Rate override · logged</div>
          <div className="r">
            <span>Deluxe DBB</span>
            <b>R1,850 → R2,100</b>
          </div>
          <div className="r">
            <span>By</span>
            <b>frontdesk@ yours</b>
          </div>
          <div className="r">
            <span>Guardrail</span>
            <b>min R1,800 ✓</b>
          </div>
        </div>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">The hotel operating system</p>
          <h1>
            One hotel. One system.
            <br />
            <em>No leaks.</em>
          </h1>
          <p className="mkh-hero-sub">
            Every rand, every room, every guest — running on one truth. Priced in rand, supported
            from Durban, and built to keep working when the power doesn’t.
          </p>
          <div className="mkh-cta-row">
            <Link className="mkh-pill" to="/contact">
              Get your quote
            </Link>
            <Link className="mkh-ghost" to="/demo">
              Book a walk-in demo
            </Link>
          </div>
        </div>
      </section>

      {/* SIX LEAKS */}
      <section className="mkh-section">
        <p className="mkh-kicker">Where does your hotel leak?</p>
        <h2 className="mkh-h2">
          Most systems plug one hole.
          <br />
          Yours is leaking from six.
        </h2>
        <div className="mkh-leaks">
          {LEAKS.map((l) => (
            <article key={l.num} className="mkh-leak">
              <span className="mkh-num">{l.num}</span>
              <h3>{l.title}</h3>
              <p>{l.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 01/02/03 */}
      <section className="mkh-section">
        <div className="mkh-steps">
          <p className="mkh-kicker">How a booking flows</p>
          <h2 className="mkh-h2">From booking to balance, without the swivel chair</h2>
          <div className="mkh-stepgrid">
            {STEPS.map((s) => (
              <div key={s.num} className="mkh-step">
                <span className="mkh-num">{s.num}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIERS */}
      <section className="mkh-section">
        <p className="mkh-kicker">Priced per property, never per surprise</p>
        <h2 className="mkh-h2">Four tiers. Full contents on the pricing page.</h2>
        <p className="mkh-lead">
          No published price lists — every contract is quoted for your property, and founding hotels
          lock founder pricing for life.
        </p>
        <div className="mkh-tiers">
          {TIERS.map((t) => (
            <div key={t.name} className="mkh-tier">
              <h3>{t.name}</h3>
              <small>{t.who}</small>
              <ul>
                {t.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link className="mkh-tierlink" to="/pricing">
                Full contents →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* RISK REVERSAL */}
      <section className="mkh-section">
        <div className="mkh-risk">
          <p className="mkh-kicker">Switch without the risk</p>
          <h2>
            We move you on a Tuesday afternoon. You run parallel for 30 days. If Vimad doesn’t win,
            we move you back — free.
          </h2>
          <p>
            You were never offline, and you’re never locked in.{' '}
            <b>Your money never touches our accounts</b> — guest payments settle straight into your
            own Paystack.
          </p>
          <div className="mkh-cta-row">
            <Link className="mkh-pill" to="/contact">
              Start the conversation
            </Link>
          </div>
        </div>
      </section>

      {/* SA */}
      <section className="mkh-section">
        <p className="mkh-kicker">Built for South Africa</p>
        <h2 className="mkh-h2">Not adapted for it. Built for it.</h2>
        <div className="mkh-chips">
          <span className="mkh-chip">TOMSA 1% auto-levy</span>
          <span className="mkh-chip">EFT proof-of-payment matching</span>
          <span className="mkh-chip">Load-shedding shift pack</span>
          <span className="mkh-chip">Offline-tolerant front desk</span>
          <span className="mkh-chip">POPIA out of the box</span>
          <span className="mkh-chip">Rand pricing · Durban support</span>
        </div>
      </section>

      {/* FOUNDER + STATUS */}
      <section className="mkh-section mkh-founder">
        <div>
          <p className="mkh-kicker">The person behind it</p>
          <h2 className="mkh-h2">Built in Durban, by the person who answers your calls.</h2>
          <p>
            No sales team, no ticket queue, no "your call is important to us". You phone, it rings,
            a human answers — the same human who writes the code. Ask for the thing you need; if
            it’s right for hotels like yours, it ships.
          </p>
          <p className="mkh-contactline">
            Phone / WhatsApp <b>+27 65 074 8802</b> · <b>efeohise@gmail.com</b>
          </p>
        </div>
        <div className="mkh-statuscard">
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--mk-espresso)' }}>
            <span className="dot" aria-hidden="true" />
            All systems — live status page
          </p>
          <p style={{ fontSize: 13, color: 'var(--mk-body)', lineHeight: 1.6 }}>
            We publish our uptime and incident history in public, because a hotel that trusts its
            system should be able to check it at 2am.
          </p>
          <Link to="/status" className="mkh-statuscard a">
            Open the status page →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mkh-section">
        <p className="mkh-kicker">Straight answers</p>
        <h2 className="mkh-h2">The questions owners actually ask</h2>
        <div className="mkh-faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.body}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mkh-final">
        <p className="mkh-kicker">One hotel. One system. No leaks.</p>
        <h2 className="mkh-h2">Where does your hotel leak?</h2>
        <div className="mkh-cta-row" style={{ justifyContent: 'center' }}>
          <Link className="mkh-pill" to="/contact">
            Get your quote
          </Link>
          <Link className="mkh-ghost" to="/demo">
            Book a walk-in demo
          </Link>
        </div>
        <p className="mkh-contactline">
          or phone the founder directly: <b>+27 65 074 8802</b>
        </p>
      </section>
    </div>
  );
}
