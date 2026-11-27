/* help/page.jsx — the old page listed articles that didn&rsquo;t exist and a chat
 * button that did nothing, with payments routed through "Stripe, Adyen". Replaced
 * with real answers and a phone that is answered. */
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'How do I get help?',
    a: 'Phone or WhatsApp +27 65 074 8802, or email efeohise@gmail.com. The founder answers — usually within the hour during the day. There is no ticket queue.',
  },
  {
    q: 'Where are the guides?',
    a: 'Written guides ship with onboarding, tuned to your property. The public Switcher&rsquo;s Library on this site covers migrations; help-centre articles grow from real pilot questions.',
  },
  {
    q: 'Which tier do I need?',
    a: 'Compass covers 6–20 rooms, Command 20–80, Constellation 80+, Armada runs groups. Every tier&rsquo;s full contents are on the pricing page — no surprises.',
  },
  {
    q: 'We are on another system. How does switching work?',
    a: 'CSV export from your current system, import, a 30-day parallel run, and a Tuesday-afternoon cutover. The Switch page has the details and the buyout offer.',
  },
  {
    q: 'What happens when the power cuts?',
    a: 'The front desk keeps working — changes queue locally and flush when you are back online. A printable shift pack covers extended outages.',
  },
  {
    q: 'Is my data safe?',
    a: 'POPIA-compliant out of the box, card data tokenised by Paystack (never on our servers), full export any time. The security page has the posture.',
  },
];

export default function HelpPage() {
  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 40px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Help</p>
          <h1>
            Real answers, <em>one phone number.</em>
          </h1>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8 }}>
        <div className="mkh-faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mkh-cta-row" style={{ marginTop: 32 }}>
          <Link className="mkh-pill" to="/contact">
            Contact the founder
          </Link>
          <Link className="mkh-ghost" to="/demo">
            Book a walk-in demo
          </Link>
        </div>
      </section>
    </div>
  );
}
