/* apps/web/src/app/marketing/page.jsx — Foundation F3.6 (density pass).
 * Homepage on Ember & Paper: module switcher w/ UI stage, six-leak architecture,
 * 01/02/03 flow, segment grid, 65/35 bento, stat strip, tiers, risk reversal,
 * SA chips, founder, FAQ. Spine: "One hotel. One system. No leaks." */
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/marketing-home.css';

const MODULES = [
  {
    tab: 'Front Desk',
    ui: 'tape',
    title: 'Tape chart & check-in',
    sub: 'SAMPLE DATA · SHIPPED FEATURES',
    bullets: [
      'Walk-ins to checked-in in under 45 seconds, key issued, deposit held.',
      'Rate overrides in three clicks — every change logged with a guardrail check.',
      'Arrivals, departures and room state on one screen, not three systems.',
    ],
  },
  {
    tab: 'Housekeeping',
    ui: 'hk',
    title: 'Three-tap board, any language',
    sub: 'INCLUDED FROM COMPASS — NOT AN ADD-ON',
    bullets: [
      'Clean, dirty, inspect — the whole floor on a phone screen.',
      'Multilingual task cards your whole team actually reads.',
      'Room flips prioritised by arrival time, automatically.',
    ],
  },
  {
    tab: 'Money',
    ui: 'folio',
    title: 'Folios that split themselves',
    sub: 'PAYSTACK + EFT PROOF-OF-PAYMENT',
    bullets: [
      'Corporate to City Ledger, leisure to the card, levy to TOMSA — one bill at checkout.',
      'EFT proof-of-payment uploaded, verified, matched to the folio. No more spreadsheet hunting.',
      'SARS-ready books with Xero and Sage CSV export, tied out continuously.',
    ],
  },
  {
    tab: 'Guest Portal',
    ui: 'upsell',
    title: 'Pre-arrival offers that convert',
    sub: 'VERIFIED R145 → R495 LOOP',
    bullets: [
      'Dinner, late check-out, airport run — offered conversationally before arrival.',
      'Accepted offers post straight to the folio. No paper, no phone tag.',
      'Verified at a live property: R145 to R495 per stay in upsell value.',
    ],
  },
];

const LEAKS = [
  {
    num: '01',
    title: 'Money',
    body: 'Two direct bookings a month typically cover the fee — the other thirty shouldn’t pay for someone’s yacht. 0% booking widget plus a verified upsell loop.',
  },
  {
    num: '02',
    title: 'Money you never see',
    body: 'Guest payments land in your own Paystack account. Vimad never touches them — you reconcile to the cent, and nobody here can.',
  },
  {
    num: '03',
    title: 'Continuity',
    body: 'Power cut mid-check-in? The queue holds every mutation and flushes when you’re back online — plus a printable shift pack.',
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
    body: 'Export everything, any time. Run parallel for 30 days. Move back free if it doesn’t win. And the founder answers the phone.',
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

const SEGMENTS = [
  {
    to: '/solutions/boutique-hotels',
    title: 'Boutique Hotels & Lodges',
    body: '20–80 rooms: full ops, rate guardrails, City Ledger, upsells.',
  },
  {
    to: '/solutions/hotel-chains',
    title: 'Multi-Property Groups',
    body: '2+ properties: shared guests, central reservations, chain billing.',
  },
  {
    to: '/solutions/contactless-checkin',
    title: 'Guesthouses & B&Bs',
    body: '6–20 rooms: the diary replacement that pays for itself.',
  },
  {
    to: '/demo',
    title: 'Conference & Wedding Venues',
    body: 'Banqueting, functions and stays on the same folio spine.',
  },
  {
    to: '/demo',
    title: 'Owners & GMs',
    body: 'The Needs Attention queue: your whole property as a to-do list that thinks.',
  },
  {
    to: '/demo',
    title: 'Finance & Bookkeepers',
    body: 'Continuous tie-out, TOMSA remittance-ready, Xero/Sage CSV. Month-end without the pain.',
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
    body: 'A widget takes the booking — then what? Vimad takes the booking, cleans the room, splits the folio, and files the VAT. See the comparison pages for the honest matrix.',
  },
  {
    q: 'Is my data POPIA-safe?',
    body: 'POPIA-compliant out of the box: guest erasure on request, ID-scan purge, and a breach ledger — running code, not a policy PDF. Card details are tokenised by Paystack; we never see card numbers.',
  },
  {
    q: 'What happens when the power cuts?',
    body: 'The front desk keeps working — check-ins and changes queue locally and flush when you’re back online. For long outages there’s a printable shift pack: arrivals, departures, room states on paper.',
  },
  {
    q: 'How is pricing worked out?',
    body: 'Per property, by quote — room count, the tier you need, the add-ons you want. Founding hotels lock founder pricing for the life of the contract. Paystack’s processing fees are always shown separately.',
  },
  {
    q: 'Can I leave if it doesn’t work out?',
    body: 'Yes — that’s the point of the 30-day parallel run. Export your guests, history, and books any time. If Vimad doesn’t win, we move you back ourselves, free.',
  },
  {
    q: 'How do I actually see it working?',
    body: 'Book a walk-in demo — it runs on an iPad, on your own numbers, in about 15 minutes. Or take the guided demo sandbox for a spin.',
  },
];

function TapeChart() {
  const rooms = ['101', '102', '103', '104', '201', '202'];
  const state = ['occ', 'arr', 'occ', 'dep', 'occ', 'arr'];
  return (
    <div className="mkh-tapechart">
      <div className="mkh-tc mkh-tc-room">Room</div>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <div key={'h' + i} className="mkh-tc">
          {d}
        </div>
      ))}
      {rooms.map((r, ri) => (
        <Fragment key={r}>
          <div className="mkh-tc mkh-tc-room">{r}</div>
          {state.map((s, ci) => (
            <div key={r + ci} className={'mkh-tc mkh-tc-' + (ci === ri % 7 ? s : 'dep')}>
              {ci === ri % 7 ? (s === 'occ' ? 'IN' : s === 'arr' ? 'ARR' : '') : ''}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

function HousekeepingBoard() {
  const rows = [
    { room: '104', task: 'Departure clean + inspect', badge: 'dirty', label: 'Dirty' },
    { room: '203', task: 'Stayover, towels', badge: 'inspect', label: 'Inspect' },
    { room: '305', task: 'Arrival ready by 14:00', badge: 'clean', label: 'Clean' },
    { room: '107', task: 'Deep clean — Monday', badge: 'dirty', label: 'Dirty' },
  ];
  return (
    <div className="mkh-hk">
      {rows.map((r) => (
        <div key={r.room} className="mkh-hk-row">
          <span className="mkh-hk-room">{r.room}</span>
          <span className="mkh-hk-task">{r.task}</span>
          <span className={'mkh-hk-badge mkh-hk-' + r.badge}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function FolioCard() {
  return (
    <div className="mkh-checkin">
      <div className="row">
        <span>Ndlovu · Deluxe DBB · 2 nights</span>
        <b>R3,700.00</b>
      </div>
      <div className="row">
        <span>Corporate split → City Ledger</span>
        <b>-R2,200.00</b>
      </div>
      <div className="row">
        <span>EFT proof-of-payment matched</span>
        <b>R1,500.00 ✓</b>
      </div>
      <div className="row">
        <span>TOMSA 1% levy</span>
        <b>R37.00</b>
      </div>
      <div className="row timerow">
        <span>Balance due at checkout</span>
        <b>R0.00</b>
      </div>
    </div>
  );
}

function UpsellThread() {
  const msgs = [
    { who: 'Vimad', text: 'Welcome! Dinner for two at 7pm? R450, added to your room.' },
    { who: 'Guest', text: 'Yes please — and a late check-out if possible.' },
    {
      who: 'Vimad',
      text: 'Done. Dinner R450 + late check-out R250, on your folio. See you Friday.',
    },
  ];
  return (
    <div className="mkh-checkin">
      {msgs.map((m) => (
        <div key={m.text} className="row">
          <span style={{ fontWeight: m.who === 'Vimad' ? 700 : 400 }}>{m.text}</span>
        </div>
      ))}
      <div className="row timerow">
        <span>Posted to folio</span>
        <b>+R700</b>
      </div>
    </div>
  );
}

const UI = { tape: TapeChart, hk: HousekeepingBoard, folio: FolioCard, upsell: UpsellThread };

export default function MarketingHomePage() {
  const [activeModule, setActiveModule] = useState(0);
  const ActiveUI = UI[MODULES[activeModule].ui];

  return (
    <div className="mkh">
      {/* HERO + STAT STRIP */}
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
          <div className="mkh-statstrip">
            <div className="mkh-stat">
              <b>&lt;45s</b>
              <span>check-in, timed at a live desk</span>
            </div>
            <div className="mkh-stat">
              <b>0%</b>
              <span>commission on your own bookings</span>
            </div>
            <div className="mkh-stat">
              <b>R145→495</b>
              <span>verified upsell value per stay</span>
            </div>
            <div className="mkh-stat">
              <b>30 days</b>
              <span>parallel run before you commit</span>
            </div>
          </div>
        </div>
      </section>

      {/* MODULE SWITCHER */}
      <section className="mkh-section">
        <p className="mkh-kicker">One system, every department</p>
        <h2 className="mkh-h2">The whole hotel on one spine</h2>
        <div className="mkh-switch">
          <div className="mkh-switch-tabs" role="tablist">
            {MODULES.map((m, i) => (
              <button
                key={m.tab}
                role="tab"
                aria-selected={i === activeModule}
                className="mkh-switch-tab"
                onClick={() => setActiveModule(i)}
              >
                {m.tab}
              </button>
            ))}
          </div>
          <div className="mkh-switch-stage">
            <div className="mkh-uicard">
              <h4>
                {MODULES[activeModule].title}
                <span className="mkh-num">{MODULES[activeModule].sub}</span>
              </h4>
              <ActiveUI />
            </div>
            <div>
              <ul className="mkh-bullets">
                {MODULES[activeModule].bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <Link
                to="/features"
                className="mkh-tierlink"
                style={{ display: 'inline-block', marginTop: 14 }}
              >
                All six modules →
              </Link>
            </div>
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

      {/* SEGMENTS */}
      <section className="mkh-section">
        <p className="mkh-kicker">Built for how you run</p>
        <h2 className="mkh-h2">By property. By role.</h2>
        <div className="mkh-segs">
          {SEGMENTS.map((s) => (
            <Link key={s.title} to={s.to} className="mkh-seg">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <span className="go">
                Explore <span className="arr">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* BENTO 65/35 */}
      <section className="mkh-section">
        <p className="mkh-kicker">Proof, not promises</p>
        <h2 className="mkh-h2">The front desk, minus the swivel chair</h2>
        <div className="mkh-bento">
          <div className="mkh-bento-card">
            <h3>Check-in on one card</h3>
            <p className="cap">Guest, room, rate, deposit, key — 45 seconds, no tabs.</p>
            <div className="mkh-checkin">
              <div className="row">
                <span>Guest</span>
                <b>T. Nkosi · BB ref 4471</b>
              </div>
              <div className="row">
                <span>Room</span>
                <b>305 · Deluxe DBB</b>
              </div>
              <div className="row">
                <span>Rate</span>
                <b>R1,850/night · guardrail ✓</b>
              </div>
              <div className="row">
                <span>Deposit held (Paystack)</span>
                <b>R1,000</b>
              </div>
              <div className="row timerow">
                <span>Key issued · folio opened</span>
                <b>00:44</b>
              </div>
            </div>
          </div>
          <div className="mkh-bento-card">
            <h3>Housekeeping in three taps</h3>
            <p className="cap">The board your whole team reads, in their language.</p>
            <HousekeepingBoard />
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
            No sales team, no ticket queue. You phone, it rings, a human answers — the same human
            who writes the code. Ask for the thing you need; if it’s right for hotels like yours, it
            ships.
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
