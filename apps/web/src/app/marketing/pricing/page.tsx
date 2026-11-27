import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Building2,
  Hotel,
  Crown,
  Globe,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

/* [CLAIM-PURGE] Phase 0+ — full honest rewrite of the pricing page.
 * Doctrine (addendum §1): NO public prices, no free tier, founder-quoted contracts.
 * Tier cards publish the FULL contents; price by quote only. */

const tiers = [
  {
    name: 'Compass',
    icon: Hotel,
    forWho: 'Guesthouses & B&Bs · 6–20 rooms',
    description: 'Direction for small properties',
    features: [
      'Core PMS — tape chart & front desk',
      '3-tap multilingual housekeeping board',
      'Direct booking engine (0% commission)',
      'Paystack payments + EFT proof-of-payment matching',
      'TOMSA 1% levy auto-calculated',
      'SARS-ready accounting + Xero/Sage CSV export',
    ],
    cta: 'Get your quote',
    popular: false,
    included: [
      'Unlimited users',
      'Founder support — phone & WhatsApp',
      'Guided onboarding',
      'Load-shedding shift pack',
      'Public live status page',
    ],
  },
  {
    name: 'Command',
    icon: Building2,
    forWho: 'Boutique hotels · 20–80 rooms',
    description: 'The full operating system',
    features: [
      'Everything in Compass',
      'Channel manager + booking engine sync',
      'Rate guardrails & seasonal rules',
      'Folio splitting + City Ledger (corporate AR)',
      'Guest portal with pre-arrival upsells',
      'Conversational upsell loop (verified R145→R495)',
    ],
    cta: 'Get your quote',
    popular: true,
    included: [
      'Everything in Compass',
      'Priority phone + WhatsApp support',
      'Full API access',
      'Offline-tolerant front desk',
      'Custom reports',
    ],
  },
  {
    name: 'Constellation',
    icon: Crown,
    forWho: 'Large properties · 80+ rooms',
    description: 'Deep ops + intelligence',
    features: [
      'Everything in Command',
      'Needs Attention exception queue',
      'BI roll-ups & advanced analytics',
      'Advanced automations',
      'Sales & catering',
      '3-click rate overrides, fully audited',
    ],
    cta: 'Get your quote',
    popular: false,
    included: [
      'Everything in Command',
      '24/7 phone support',
      'Advanced user permissions',
      'On-site training available',
      'Dedicated account manager',
    ],
  },
  {
    name: 'Armada',
    icon: Globe,
    forWho: 'Groups · 2+ properties',
    description: 'Fleet control',
    features: [
      'Everything in Constellation',
      'Multi-property switcher & rollups',
      'Shared guest profiles & contracts',
      'Central reservations',
      'Cross-property booking',
      'Chain billing & loyalty',
    ],
    cta: 'Get your quote',
    popular: false,
    accentColor: 'border-accent',
    included: [
      'Everything in Constellation',
      'Chain onboarding playbook',
      'Per-group contract pricing',
      'Dedicated success check-ins',
    ],
  },
];

const faqs = [
  {
    q: 'How is pricing worked out?',
    a: 'Every contract is quoted for your property: room count, the tiers you need, the add-ons you want. Founding hotels lock founder pricing for the life of the contract.',
  },
  {
    q: 'What payment methods do you accept?',
    a: "Cards via Paystack, EFT with proof-of-payment matching, and instant EFT. Processing fees are Paystack's own and always shown separately.",
  },
  {
    q: 'Is there a trial period?',
    a: "No free tier. We run a guided demo on your own numbers, then a paid founding plan. If Vimad doesn't earn its keep in the first 30 days, we move you back — free.",
  },
  {
    q: 'Can I change tiers later?',
    a: 'Yes — and because contracts are line-item based, add-ons move freely as you grow. Upgrade or downgrade at renewal.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'A 30-day money-back guarantee on every plan. No questions asked.',
  },
  {
    q: 'Is there a limit on reservations or users?',
    a: 'No. Unlimited reservations and user accounts on every tier.',
  },
];

export default function PricingPage() {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="bg-background">
      {/* Hero */}
      <div className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-text-primary sm:text-5xl">
              Founder-quoted, not list-priced
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
              No two hotels run the same. Every contract is priced for your property — here is
              exactly what each tier includes.
            </p>
          </div>

          {/* Tier Cards — full contents, quoted per property */}
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-surface p-6 transition-all hover:shadow-lg',
                  tier.popular
                    ? 'border-secondary ring-1 ring-secondary'
                    : tier.accentColor
                      ? 'border-accent ring-1 ring-accent'
                      : 'border-border'
                )}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}
                {tier.name === 'Armada' && !tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    Groups
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-elevated">
                    <tier.icon
                      className={cn(
                        'h-5 w-5',
                        tier.popular ? 'text-secondary' : 'text-text-secondary'
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{tier.name}</h3>
                    <p className="text-xs text-text-muted">{tier.description}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-text-secondary">{tier.forWho}</p>
                  <p className="mt-2 inline-block rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-primary">
                    Quoted per property
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm text-text-secondary"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/contact"
                  className={cn(
                    'mt-8 flex w-full items-center justify-center rounded-md py-2.5 text-sm font-medium transition-colors',
                    tier.popular
                      ? 'bg-secondary text-white hover:bg-secondary/90'
                      : tier.name === 'Armada'
                        ? 'border border-accent bg-accent/5 text-[var(--accent-soft-fg)] hover:bg-accent/10'
                        : 'border border-border bg-background text-text-primary hover:bg-surface-elevated'
                  )}
                >
                  {tier.cta}
                </Link>

                {/* Expandable What's Included */}
                <div className="mt-4 border-t border-border pt-4">
                  <button
                    onClick={() => setExpandedTier(expandedTier === tier.name ? null : tier.name)}
                    className="flex w-full items-center justify-between text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5" /> Full contents
                    </span>
                    {expandedTier === tier.name ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {expandedTier === tier.name && (
                    <ul className="mt-3 space-y-2">
                      {tier.included.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-xs text-text-secondary"
                        >
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-text-muted" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Armada banner */}
          <div className="mt-12 rounded-xl border border-border bg-surface p-8 text-center">
            <h3 className="text-lg font-semibold text-text-primary">
              Running multiple properties — or one big one with venue space?
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Tell us the room count and setup; you will have a founder-priced quote within 24
              hours.
            </p>
            <Link
              to="/contact"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-secondary px-6 text-sm font-medium text-white hover:bg-secondary/90 transition-colors"
            >
              Get your quote <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="border-t border-border bg-surface py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary">Pricing FAQ</h2>
            <p className="mt-4 text-text-secondary">
              Got questions? We answer the phone ourselves.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-background overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-medium text-text-primary">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed border-t border-border/50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-text-muted">
              Still have questions?{' '}
              <Link to="/contact" className="text-secondary hover:underline font-medium">
                Talk to the founder
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
