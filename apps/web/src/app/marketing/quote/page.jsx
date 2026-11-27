/* apps/web/src/app/marketing/quote/page.jsx — [M2] quote-flow page.
 * The Mews-mechanic segmentation form: fields are exactly what the founder
 * needs to price a contract. Posts to /v1/public/leads with source "quote". */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitLead } from '../../../api/leads';

export default function QuotePage() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    property: '',
    rooms: '',
    ptype: '',
    current: '',
    role: '',
    notes: '',
    consent: false,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setc = (e) => setForm({ ...form, consent: e.target.checked });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent) {
      setError('Please tick the consent box so we may reply to you.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      await submitLead({
        source: 'quote',
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        propertyName: form.property || undefined,
        roomCount: form.rooms ? Number(form.rooms) : undefined,
        currentPms: form.current || undefined,
        message:
          [
            form.ptype && 'Property type: ' + form.ptype,
            form.role && 'Role: ' + form.role,
            form.notes,
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
        consent: form.consent,
        page: window.location.pathname,
      });
      setStatus('success');
    } catch (err) {
      setStatus('idle');
      setError(
        err?.data?.error ||
          'Something went wrong. Please try again, or phone/WhatsApp +27 65 074 8802.'
      );
    }
  };

  if (status === 'success') {
    return (
      <div className="mkh">
        <section className="mkh-hero" style={{ padding: '96px 24px' }}>
          <div className="mkh-hero-inner" style={{ maxWidth: 640 }}>
            <p className="mkh-kicker">Request received</p>
            <h1>
              You&rsquo;ll have a founder-priced quote <em>within 24 hours.</em>
            </h1>
            <p className="mkh-hero-sub">
              Usually faster on WhatsApp. If anything about your setup is unusual, that&rsquo;s the
              interesting part — expect questions.
            </p>
            <div className="mkh-cta-row">
              <Link className="mkh-ghost" to="/">
                Back to home
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mkh">
      <section className="mkh-hero" style={{ padding: '72px 24px 48px' }}>
        <div className="mkh-hero-inner">
          <p className="mkh-kicker">Founder-quoted, not list-priced</p>
          <h1>
            Tell us about your property.
            <br />
            <em>Get a real quote in 24 hours.</em>
          </h1>
          <p className="mkh-hero-sub">
            No sales call, no 30-minute discovery theatre. The person who prices it is the person
            who built it.
          </p>
        </div>
      </section>
      <section className="mkh-section" style={{ paddingTop: 8, maxWidth: 760 }}>
        <form
          onSubmit={handleSubmit}
          className="mkh-form-grid"
          style={{
            background: 'var(--mk-card)',
            border: '1px solid var(--mk-hairline)',
            borderRadius: 16,
            padding: 28,
          }}
        >
          <div>
            <label className="mkh-label" htmlFor="q-name">
              Your name
            </label>
            <input
              id="q-name"
              className="mkh-input"
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Thandi Nkosi"
            />
          </div>
          <div>
            <label className="mkh-label" htmlFor="q-email">
              Email
            </label>
            <input
              id="q-email"
              className="mkh-input"
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="you@property.co.za"
            />
          </div>
          <div>
            <label className="mkh-label" htmlFor="q-phone">
              Phone / WhatsApp
            </label>
            <input
              id="q-phone"
              className="mkh-input"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+27 82 000 0000"
            />
          </div>
          <div>
            <label className="mkh-label" htmlFor="q-prop">
              Property name
            </label>
            <input
              id="q-prop"
              className="mkh-input"
              value={form.property}
              onChange={set('property')}
              placeholder="Ocean View Guesthouse"
            />
          </div>
          <div>
            <label className="mkh-label" htmlFor="q-rooms">
              Number of rooms
            </label>
            <input
              id="q-rooms"
              className="mkh-input"
              type="number"
              min="1"
              max="5000"
              value={form.rooms}
              onChange={set('rooms')}
              placeholder="33"
            />
          </div>
          <div>
            <label className="mkh-label" htmlFor="q-ptype">
              Property type
            </label>
            <select id="q-ptype" className="mkh-select" value={form.ptype} onChange={set('ptype')}>
              <option value="">Select…</option>
              <option>Guesthouse / B&B</option>
              <option>Boutique hotel</option>
              <option>Lodge</option>
              <option>Conference / wedding venue</option>
              <option>Multi-property group</option>
            </select>
          </div>
          <div>
            <label className="mkh-label" htmlFor="q-current">
              Current system
            </label>
            <select
              id="q-current"
              className="mkh-select"
              value={form.current}
              onChange={set('current')}
            >
              <option value="">Select…</option>
              <option>Paper diary / spreadsheets</option>
              <option>Booking widget (NightsBridge etc.)</option>
              <option>Legacy PMS (Semper, Protel…)</option>
              <option>Another PMS</option>
              <option>Nothing yet</option>
            </select>
          </div>
          <div>
            <label className="mkh-label" htmlFor="q-role">
              Your role
            </label>
            <select id="q-role" className="mkh-select" value={form.role} onChange={set('role')}>
              <option value="">Select…</option>
              <option>Owner</option>
              <option>GM / Manager</option>
              <option>Front desk</option>
              <option>Finance / Bookkeeper</option>
              <option>Other</option>
            </select>
          </div>
          <div className="full">
            <label className="mkh-label" htmlFor="q-notes">
              Anything we should know?
            </label>
            <textarea
              id="q-notes"
              className="mkh-textarea"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Venue space, multiple sites, a migration deadline, a stubborn OTA habit…"
            />
          </div>
          {error && (
            <p className="full mkh-form-note" style={{ color: 'var(--mk-ember)' }}>
              {error}
            </p>
          )}
          <div className="full mkh-check">
            <input id="q-consent" type="checkbox" required checked={form.consent} onChange={setc} />
            <label htmlFor="q-consent">
              I agree to Vimad storing these details so the founder can prepare my quote (POPIA). No
              marketing lists, ever.
            </label>
          </div>
          <div className="full">
            <button type="submit" className="mkh-pill" disabled={status === 'loading'}>
              {status === 'loading' ? 'Sending…' : 'Get my quote'}
            </button>
            <p className="mkh-form-note" style={{ marginTop: 12 }}>
              Prefer to talk? Phone / WhatsApp{' '}
              <b style={{ color: 'var(--mk-espresso)' }}>+27 65 074 8802</b> · efeohise@gmail.com
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
