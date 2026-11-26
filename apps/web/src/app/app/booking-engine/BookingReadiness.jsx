/* src/app/app/booking-engine/BookingReadiness.jsx — P52 (9.6): readiness
 * banner. Consumes GET /v1/booking-engine/readiness and shows staff exactly
 * why the widget can or cannot take a booking today. */
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { apiGet } from '../../../api/client';

export default function BookingReadiness({ propertyId, propertyCode }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!propertyId) return;
    let live = true;
    const load = () =>
      apiGet('/v1/booking-engine/readiness', { propertyId })
        .then((body) => {
          if (live) setState(body?.data ?? null);
        })
        .catch(() => {
          if (live) setState({ unavailable: true });
        });
    load();
    const t = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [propertyId]);

  if (!state || state.unavailable) return null;

  return (
    <div
      className={`rounded-lg border p-4 ${
        state.ready
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-amber-500/40 bg-amber-500/5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">
          {state.ready
            ? 'Your booking engine is ready to take reservations.'
            : `Booking engine not ready — ${state.doneCount}/${state.total} checks pass.`}
        </p>
        {propertyCode && (
          <a
            href={`/book/${propertyCode}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
          >
            Open widget <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="mt-2 grid gap-1.5 md:grid-cols-2">
        {state.checks.map((c) => (
          <div key={c.key} className="flex items-start gap-1.5 text-xs">
            {c.done ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="text-text-secondary">
              <span className="font-medium text-text-primary">{c.label}</span>
              {c.hint ? ` — ${c.hint}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
