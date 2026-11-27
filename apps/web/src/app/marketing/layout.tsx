import { Outlet, Link } from 'react-router-dom';
import { Menu, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import '../../styles/generated/marketing.css';
import '../../styles/marketing-home.css';

interface NavLink {
  to: string;
  label: string;
}

interface DropItem {
  to: string;
  label: string;
  desc: string;
}

/* [F3.7] Mews-pattern mega menu on Ember & Paper: left rail + grouped columns.
 * Groups mirror the product's own module spine (navGroups): house / money / guest. */
const PLATFORM_GROUPS: { label: string; desc: string; items: DropItem[] }[] = [
  {
    label: 'Run the house',
    desc: 'Everything the front desk and the floor need, on one spine.',
    items: [
      {
        to: '/features',
        label: 'Front Desk & Reservations',
        desc: 'Tape chart, walk-ins, check-in under 45 seconds',
      },
      {
        to: '/features',
        label: 'Housekeeping & Maintenance',
        desc: 'Three-tap multilingual board — included, not an add-on',
      },
    ],
  },
  {
    label: 'Run the money',
    desc: 'Payments, folios and books that reconcile themselves.',
    items: [
      {
        to: '/features',
        label: 'Payments',
        desc: 'Paystack, EFT proof-of-payment matching, TOMSA levy',
      },
      {
        to: '/features',
        label: 'Accounting & SARS',
        desc: 'Continuous tie-out, Xero/Sage CSV, no night-audit freeze',
      },
    ],
  },
  {
    label: 'Serve the guest',
    desc: 'Direct revenue and stays that sell themselves.',
    items: [
      {
        to: '/features',
        label: 'Direct Booking & Distribution',
        desc: '0% commission widget, channel sync where it counts',
      },
      {
        to: '/features',
        label: 'Guest Portal & Upsells',
        desc: 'Pre-arrival offers — verified R145 to R495 per stay',
      },
    ],
  },
];

const SOLUTION_ITEMS: DropItem[] = [
  {
    to: '/solutions/boutique-hotels',
    label: 'Boutique Hotels & Lodges',
    desc: 'The full operating system for 20–80 rooms',
  },
  {
    to: '/solutions/hotel-chains',
    label: 'Multi-Property Groups',
    desc: 'Shared guests, central reservations, chain billing',
  },
  {
    to: '/solutions/contactless-checkin',
    label: 'Guesthouses & B&Bs',
    desc: 'Compass tier — the diary replacement that pays for itself',
  },
  {
    to: '/demo',
    label: 'Conference & Wedding Venues',
    desc: 'Banqueting and events on the same folio spine',
  },
];

const RESOURCE_ITEMS: DropItem[] = [
  {
    to: '/blog',
    label: "The Switcher's Library",
    desc: 'Migration playbooks from real South African cutovers',
  },
  {
    to: '/alternatives',
    label: 'Compare',
    desc: 'Vimad vs the widget, the spreadsheet, the legacy stack',
  },
  { to: '/help', label: 'Help Center', desc: 'Guides for every department' },
  { to: '/status', label: 'Live Status', desc: 'Our uptime and incidents, published in public' },
];

export default function MarketingLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const flatLinks: NavLink[] = [
    { to: '/features', label: 'Platform' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/alternatives', label: 'Compare' },
    { to: '/blog', label: 'Resources' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <div data-vimad-marketing className="mkh flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-[var(--mk-hairline)] bg-[var(--mk-canvas)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-[family-name:var(--mk-font-display)] text-xl font-bold text-[var(--mk-espresso)]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--mk-espresso)] text-lg font-bold text-[var(--mk-on-dark)]">
              V
            </div>
            Vimad
          </Link>

          {/* Desktop mega nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            <div className="mkh-drop">
              <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--mk-espresso-soft)] transition-colors hover:text-[var(--mk-espresso)]">
                Platform <ChevronDown className="mkh-caret h-3.5 w-3.5" />
              </button>
              <div className="mkh-drop-panel">
                <div className="mkh-drop-panel-inner" style={{ width: 'auto', display: 'block' }}>
                  <div className="mkh-drop-mega">
                    <div className="mkh-drop-rail">
                      <Link to="/features" className="mkh-railcard mkh-railcard-dark">
                        <div className="mkh-minicrop" aria-hidden="true">
                          <div className="ln">
                            <span>NEEDS ATTENTION</span>
                            <span className="ok">4</span>
                          </div>
                          <div className="ln">
                            <span>Check-out 305 → inspect</span>
                            <span className="ok">queued</span>
                          </div>
                          <div className="ln">
                            <span>EFT POP - Nkosi</span>
                            <span className="ok">matched</span>
                          </div>
                          <div className="ln">
                            <span>Rate override - 104</span>
                            <span className="ok">logged</span>
                          </div>
                        </div>
                        <b>Platform overview</b>
                        <span>Explore the whole operating system, module by module.</span>
                        <span className="go">Overview →</span>
                      </Link>
                      <Link to="/status" className="mkh-railcard mkh-railcard-paper">
                        <b>Live status page</b>
                        <span>Uptime and incidents, published in public.</span>
                        <span className="go">Status →</span>
                      </Link>
                    </div>
                    <div className="mkh-drop-groups">
                      {PLATFORM_GROUPS.map((group) => (
                        <div key={group.label} className="mkh-drop-group">
                          <div className="mkh-drop-label">{group.label}</div>
                          <p>{group.desc}</p>
                          {group.items.map((item) => (
                            <Link key={item.label} to={item.to} className="mkh-drop-item">
                              <b>{item.label}</b>
                              <span>{item.desc}</span>
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mkh-drop">
              <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--mk-espresso-soft)] transition-colors hover:text-[var(--mk-espresso)]">
                Solutions <ChevronDown className="mkh-caret h-3.5 w-3.5" />
              </button>
              <div className="mkh-drop-panel">
                <div
                  className="mkh-drop-panel-inner"
                  style={{ width: '500px', gridTemplateColumns: '1fr' }}
                >
                  {SOLUTION_ITEMS.map((item) => (
                    <Link key={item.label} to={item.to} className="mkh-drop-item">
                      <b>{item.label}</b>
                      <span>{item.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <Link
              to="/pricing"
              className="rounded-md px-3 py-2 text-sm font-medium text-[var(--mk-espresso-soft)] transition-colors hover:text-[var(--mk-espresso)]"
            >
              Pricing
            </Link>
            <div className="mkh-drop">
              <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--mk-espresso-soft)] transition-colors hover:text-[var(--mk-espresso)]">
                Resources <ChevronDown className="mkh-caret h-3.5 w-3.5" />
              </button>
              <div className="mkh-drop-panel">
                <div className="mkh-drop-panel-inner" style={{ width: '460px' }}>
                  {RESOURCE_ITEMS.map((item) => (
                    <Link key={item.label} to={item.to} className="mkh-drop-item">
                      <b>{item.label}</b>
                      <span>{item.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <Link
              to="/about"
              className="rounded-md px-3 py-2 text-sm font-medium text-[var(--mk-espresso-soft)] transition-colors hover:text-[var(--mk-espresso)]"
            >
              About
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/contact"
              className="hidden h-10 items-center justify-center rounded-full bg-[var(--mk-ember)] px-5 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[var(--mk-ember-soft)] sm:inline-flex"
            >
              Get your quote
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--mk-hairline)] text-[var(--mk-espresso)] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile sheet */}
        {mobileMenuOpen && (
          <div className="border-t border-[var(--mk-hairline)] bg-[var(--mk-canvas)] px-4 py-4 lg:hidden">
            <nav className="flex flex-col gap-3">
              {flatLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium text-[var(--mk-espresso-soft)] hover:text-[var(--mk-espresso)]"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--mk-ember)] px-5 text-[11px] font-bold uppercase tracking-[0.08em] text-white"
              >
                Get your quote
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Mega footer */}
      <footer className="mkh-footer">
        <div className="mkh-footer-grid">
          <div className="mkh-footer-brand">
            <div className="flex items-center gap-2.5 font-[family-name:var(--mk-font-display)] text-lg font-bold text-[var(--mk-espresso)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--mk-espresso)] text-sm font-bold text-[var(--mk-on-dark)]">
                V
              </div>
              Vimad
            </div>
            <p>
              One hotel. One system. No leaks. The hotel operating system, built in Durban for South
              African properties.
            </p>
            <p className="mkh-mono" style={{ fontSize: 12 }}>
              +27 65 074 8802
              <br />
              efeohise@gmail.com
            </p>
          </div>
          <div>
            <h4>Platform</h4>
            <Link to="/features">Front Desk</Link>
            <Link to="/features">Housekeeping</Link>
            <Link to="/features">Payments</Link>
            <Link to="/features">Accounting & SARS</Link>
            <Link to="/features">Guest Portal</Link>
          </div>
          <div>
            <h4>Solutions</h4>
            <Link to="/solutions/boutique-hotels">Boutique Hotels</Link>
            <Link to="/solutions/hotel-chains">Multi-Property</Link>
            <Link to="/solutions/contactless-checkin">Guesthouses & B&Bs</Link>
            <Link to="/demo">Venues & Events</Link>
          </div>
          <div>
            <h4>Compare & switch</h4>
            <Link to="/alternative/cloudbeds">vs the booking widget</Link>
            <Link to="/alternative/hilton-onq">vs the spreadsheet</Link>
            <Link to="/alternative/opera-5">vs the legacy stack</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/demo">Book a walk-in demo</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/about">About</Link>
            <Link to="/blog">Switcher&rsquo;s Library</Link>
            <Link to="/status">Live status</Link>
            <Link to="/help">Help center</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
        <div className="mkh-footer-base">
          <div className="mkh-footer-base-in">
            <span>© 2026 Vimad. VIMAD (Pty) Ltd · CIPC Reg 2026/949106/07</span>
            <span>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/gdpr">POPIA</Link>
              <Link to="/security">Security</Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
