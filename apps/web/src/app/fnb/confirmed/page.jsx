/* apps/web/src/app/fnb/confirmed/page.jsx — F3 payment return page.
 * Paystack redirects here with ?reference=; we verify server-side and show
 * the outcome. Handles success, failure and pending honestly. */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function FnbConfirmedPage() {
  const [sp] = useSearchParams();
  const reference = sp.get('reference') ?? '';
  const [state, setState] = useState({ phase: 'checking' });

  useEffect(() => {
    if (!reference) {
      setState({ phase: 'failed', reason: 'Missing payment reference' });
      return;
    }
    let live = true;
    const attempt = (n) =>
      fetch(`/v1/fnb/orders/verify/${encodeURIComponent(reference)}`)
        .then(async (r) => {
          const b = await r.json();
          if (!r.ok) throw new Error(b?.error?.message ?? 'Verification failed');
          return b.data;
        })
        .then((order) => {
          if (!live) return;
          if (order.status === 'paid') setState({ phase: 'paid', order });
          else if (order.status === 'failed' || order.failureReason)
            setState({ phase: 'failed', reason: order.failureReason, order });
          else if (n > 0) setTimeout(() => attempt(n - 1), 2500);
          else setState({ phase: 'pending', order });
        })
        .catch((e) => {
          if (live && n > 0) setTimeout(() => attempt(n - 1), 2500);
          else if (live) setState({ phase: 'failed', reason: e.message });
        });
    attempt(4);
    return () => {
      live = false;
    };
  }, [reference]);

  const icon =
    state.phase === 'paid' ? (
      <CheckCircle2 className="h-14 w-14 text-emerald-500" />
    ) : state.phase === 'checking' || state.phase === 'pending' ? (
      <Loader2 className="h-14 w-14 animate-spin text-text-muted" />
    ) : (
      <XCircle className="h-14 w-14 text-danger" />
    );

  const title =
    state.phase === 'paid'
      ? 'Order paid — the kitchen has it'
      : state.phase === 'checking'
        ? 'Confirming your payment…'
        : state.phase === 'pending'
          ? 'Still confirming…'
          : 'Payment did not go through';

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="flex justify-center">{icon}</div>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        {state.phase === 'paid' && state.order && (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-6 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Order</span>
              <span className="font-mono font-semibold">{state.order.reference}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-text-muted">Total</span>
              <span>R {Number(state.order.amount).toFixed(2)}</span>
            </div>
            {state.order.tableLabel && (
              <div className="mt-1 flex justify-between">
                <span className="text-text-muted">Table</span>
                <span>{state.order.tableLabel}</span>
              </div>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Show this screen if the team asks. A receipt was emailed to you.
            </p>
          </div>
        )}
        {state.phase === 'failed' && (
          <p className="mt-2 text-sm text-text-secondary">
            {state.reason ?? 'No money was taken, or a refund was issued.'} Scan the QR again to
            retry.
          </p>
        )}
        <Link to="/" className="mt-8 block text-sm text-text-muted hover:text-text-primary">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
