import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Phone, MapPin, Check, MessageSquare, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '../../../components/ui/input';
import { submitLead } from '../../../api/leads';

/* [FORM-WIRING] Phase 0+ — the old submit was setTimeout(success, 1500): leads
 * went nowhere. Now posts to POST /v1/public/leads (consent required, UTM captured). */

export default function ContactPage() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    hotel: '',
    message: '',
    consent: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent) {
      setError('Please tick the consent box so we are allowed to reply to you.');
      return;
    }
    setStatus('loading');
    setError('');
    const params = new URLSearchParams(window.location.search);
    try {
      await submitLead({
        source: 'contact',
        name: form.name,
        email: form.email,
        propertyName: form.hotel || undefined,
        message: form.message,
        consent: form.consent,
        page: window.location.pathname,
        utmSource: params.get('utm_source') || undefined,
        utmMedium: params.get('utm_medium') || undefined,
        utmCampaign: params.get('utm_campaign') || undefined,
      });
      setStatus('success');
    } catch (err) {
      setStatus('idle');
      setError(
        err?.data?.error ||
          'Something went wrong sending your message. Please try again, or phone/WhatsApp us on +27 65 074 8802.'
      );
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <Check className="h-6 w-6 text-accent" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-text-primary">Message received</h2>
          <p className="mt-2 text-text-secondary">
            The founder reads every message personally — expect a reply within one business day.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-secondary px-6 text-sm font-medium text-white hover:bg-secondary/90"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-bold text-text-primary sm:text-5xl">Get in touch</h1>
              <p className="mt-4 text-lg text-text-secondary">
                Pricing, migration, a demo on your own numbers — you get the founder, not a call
                centre.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 text-text-secondary">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                    <Phone className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Phone / WhatsApp</p>
                    <p className="text-sm">+27 65 074 8802</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-text-secondary">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                    <Mail className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Email</p>
                    <p className="text-sm">efeohise@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-text-secondary">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                    <MapPin className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Based in</p>
                    <p className="text-sm">Durban, South Africa</p>
                  </div>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-border bg-surface p-6 sm:p-8 space-y-4"
            >
              <Input
                label="Name"
                placeholder="Your name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@property.co.za"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Property Name"
                placeholder="e.g. Ocean View Guesthouse"
                value={form.hotel}
                onChange={(e) => setForm({ ...form, hotel: e.target.value })}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="How can we help?"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {error && (
                <p className="flex items-start gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs text-text-secondary">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
              <label className="flex items-start gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  required
                  checked={form.consent}
                  onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span>
                  I agree to Vimad storing these details so the founder can reply to my enquiry
                  (POPIA). No marketing lists, ever.
                </span>
              </label>
              <Button
                type="submit"
                className="w-full"
                isLoading={status === 'loading'}
                disabled={!form.consent}
              >
                <MessageSquare className="mr-1.5 h-4 w-4" /> Send Message
              </Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
