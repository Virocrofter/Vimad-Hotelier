/* src/app/guest-portal/StayBanner.jsx — P49 Phase 9.1: contextual stay
 * banner. Consumes GET /v1/guest-portal/banner/:token (pinned by the p49
 * suite) and shifts with the live stay state: pre-arrival check-in, room
 * being prepared, key ready, departure with balance-aware checkout. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { getGuestToken } from '../../hooks/useGuestPortalData';

const CTA_ROUTE = {
  start_checkin: '/guest-portal/check-in',
  digital_key: '/guest-portal/keys',
  express_checkout: '/guest-portal/check-out',
};

const STATE_TONE = {
  pre_arrival: 'border-info/40 bg-info/5',
  arrived_dirty: 'border-warning/40 bg-warning/5',
  in_house: 'border-accent/40 bg-accent/5',
  departure: 'border-border bg-background-secondary',
};

export default function StayBanner() {
  const navigate = useNavigate();
  const [banner, setBanner] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const token = getGuestToken();
    if (!token) return;
    fetch(`/v1/guest-portal/banner/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((body) => setBanner(body?.data ?? null))
      .catch(() => setErr('banner-unavailable'));
  }, []);

  if (err) return null; // banner never blocks the home page
  if (!banner) {
    return (
      <div className="rounded-lg border border-border p-4 flex items-center gap-2 text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Preparing your stay…</span>
      </div>
    );
  }

  const route = CTA_ROUTE[banner.cta?.action];
  const clickable = Boolean(route);

  return (
    <div className={`rounded-lg border p-5 ${STATE_TONE[banner.state] ?? 'border-border'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-text-primary">{banner.headline}</p>
          {banner.state === 'departure' && banner.balance > 0 && (
            <p className="text-sm text-text-secondary mt-1">
              Outstanding balance: R {Number(banner.balance).toFixed(2)}
            </p>
          )}
        </div>
        <button
          onClick={() => clickable && navigate(route)}
          disabled={!clickable}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            clickable
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-background-secondary text-text-muted cursor-default'
          }`}
        >
          {banner.cta?.label ?? '—'}
        </button>
      </div>

      {Array.isArray(banner.offers) && banner.offers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {banner.offers.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-text-secondary"
            >
              <Sparkles className="h-3 w-3 text-accent" />
              {o.name} · R {Number(o.price).toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
