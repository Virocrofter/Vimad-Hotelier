/* Booking Engine (blueprint S8) — staff config for the public booking widget.
 * Embed snippet + live availability test: what staff test here is exactly what
 * a guest sees on the hotel website (same public endpoints the widget calls). */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, Globe, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProperties } from '../../../hooks/useProperties';
import { apiGet } from '../../../api/client';
import { formatCurrency } from '../../../lib/guest-utils';

const toISO = (d) => d.toISOString().slice(0, 10);
const today = toISO(new Date());
const tomorrow = toISO(new Date(Date.now() + 86400000));

export default function BookingEnginePage() {
  const { properties } = useProperties();
  const property = Array.isArray(properties) ? properties[0] : (properties?.items ?? [])[0];
  const code = property?.code ?? '';

  const [copied, setCopied] = useState(false);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [results, setResults] = useState(null); // null = idle, array = rooms
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const host = window.location.origin;
  const snippet =
    '<div id="vimad-booking"></div>\n' +
    '<script src="' +
    host +
    '/vimad-booking.js"\n' +
    '        data-property="' +
    code +
    '"\n' +
    '        data-api="' +
    host +
    '/v1" defer></script>';

  const runTest = async () => {
    setTesting(true);
    setError('');
    setResults(null);
    try {
      const body = await apiGet(
        '/v1/public/properties/' + encodeURIComponent(code) + '/availability',
        { checkIn, checkOut, adults, children }
      );
      const data = body?.data ?? body;
      const rooms = data?.roomTypes ?? data?.results ?? (Array.isArray(data) ? data : []);
      setResults(rooms);
    } catch (e) {
      setError(e.message || 'Availability check failed');
    } finally {
      setTesting(false);
    }
  };

  const copySnippet = () => {
    navigator.clipboard?.writeText(snippet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="hq-surface-0 min-h-full space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Booking Engine</h1>
        <p className="text-sm text-text-secondary">
          Your bookable website widget — embed snippet and a live test of what guests see.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Embed snippet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {code === '' ? (
              <p className="text-sm text-text-muted">Loading property code…</p>
            ) : (
              <>
                <p className="text-xs text-text-muted">
                  Paste into any page of the hotel website. Property code{' '}
                  <span className="font-mono font-semibold text-text-primary">{code}</span>.
                </p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">
                  {snippet}
                </pre>
                <Button variant="ghost" size="sm" onClick={copySnippet}>
                  {copied ? (
                    <Check className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Copy className="mr-1.5 h-4 w-4" />
                  )}
                  {copied ? 'Copied' : 'Copy snippet'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Test availability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <label className="text-xs text-text-secondary">
                Check-in
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Check-out
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Adults
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-text-secondary">
                Children
                <select
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                  className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                >
                  {[0, 1, 2].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button onClick={runTest} disabled={testing || code === ''}>
              <Search className="mr-1.5 h-4 w-4" />
              {testing ? 'Checking…' : 'Check availability'}
            </Button>
            {error && (
              <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {results !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              What a guest sees — {results.length} room type{results.length === 1 ? '' : 's'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-text-muted">
                No rooms available for those dates — the widget would show the same.
              </p>
            ) : (
              <div className="space-y-2">
                {results.map((r) => {
                  const id = r.roomTypeId ?? r.id;
                  const rate = r.total ?? r.rate ?? r.price ?? r.nightlyRate;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                    >
                      <span className="text-sm font-medium text-text-primary">{r.name}</span>
                      <span className="text-sm font-semibold tabular-nums hq-revenue">
                        {rate != null && !Number.isNaN(Number(rate))
                          ? formatCurrency(Number(rate))
                          : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
