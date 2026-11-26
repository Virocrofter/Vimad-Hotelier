/* apps/web/src/app/fnb/page.jsx — F3 guest menu: scan QR → browse → cart →
 * hosted Paystack checkout. Public, no login; code-scoped like /book/:code. */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Loader2, Minus, Plus, ShoppingCart, ArrowRight, UtensilsCrossed } from 'lucide-react';

const fmt = (n) =>
  `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FnbMenuPage() {
  const { code } = useParams();
  const [sp] = useSearchParams();
  const table = sp.get('table') ?? undefined;

  const [menu, setMenu] = useState(null);
  const [cart, setCart] = useState({});
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState('menu'); // menu | paying
  const [idem] = useState(() => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())));

  useEffect(() => {
    fetch(`/v1/fnb/menu/${encodeURIComponent(code)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Menu unavailable');
        return r.json();
      })
      .then((b) => setMenu(b.data))
      .catch((e) => setError(e.message));
  }, [code]);

  const lines = useMemo(
    () =>
      (menu?.items ?? [])
        .filter((i) => cart[i.id])
        .map((i) => ({ ...i, quantity: cart[i.id], line: i.price * cart[i.id] })),
    [menu, cart]
  );
  const total = lines.reduce((s, l) => s + l.line, 0);

  const submit = async () => {
    setError(null);
    setPhase('paying');
    try {
      const created = await fetch(`/v1/fnb/orders/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idem },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.id, quantity: l.quantity })),
          email,
          tableLabel: table,
        }),
      }).then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b?.error?.message ?? 'Could not place the order');
        return b.data;
      });

      const pay = await fetch(`/v1/fnb/orders/${created.orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b?.error?.message ?? 'Could not start payment');
        return b.data;
      });

      window.location.href = pay.authorizationUrl;
    } catch (e) {
      setError(e.message);
      setPhase('menu');
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold tracking-tight">vimad</span>
          {menu && (
            <div className="text-right">
              <div className="text-sm font-semibold">{menu.property.name}</div>
              <div className="flex items-center justify-end gap-1 text-xs text-text-muted">
                <UtensilsCrossed className="h-3 w-3" /> Order & pay from your phone
                {table ? ` · ${table}` : ''}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {!menu && !error && (
          <div className="py-16 text-center text-text-muted">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            <p className="mt-3 text-sm">Loading the menu…</p>
          </div>
        )}

        {menu && menu.items.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-text-muted">
            Nothing on the menu yet — ask the team to add items in the upsell catalog.
          </div>
        )}

        <div className="space-y-3">
          {menu?.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-text-muted">{item.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{fmt(item.price)}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setCart({ ...cart, [item.id]: Math.max(0, (cart[item.id] ?? 0) - 1) })
                    }
                    className="rounded-md border border-border p-1"
                    aria-label="remove one"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm tabular-nums">{cart[item.id] ?? 0}</span>
                  <button
                    onClick={() => setCart({ ...cart, [item.id]: (cart[item.id] ?? 0) + 1 })}
                    className="rounded-md border border-border p-1"
                    aria-label="add one"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {lines.length > 0 && (
          <div className="sticky bottom-0 mt-6 rounded-2xl border border-border bg-surface p-4 shadow-lg">
            <div className="space-y-1 text-sm">
              {lines.map((l) => (
                <div key={l.id} className="flex justify-between text-text-secondary">
                  <span>
                    {l.quantity} × {l.name}
                  </span>
                  <span>{fmt(l.line)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-semibold text-text-primary">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email (for the receipt)"
              className="mt-3 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
            <button
              onClick={submit}
              disabled={phase === 'paying' || !email.includes('@')}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-semibold text-white disabled:opacity-50"
            >
              {phase === 'paying' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              Pay {fmt(total)} securely
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-2 text-center text-[11px] text-text-muted">
              Card, Capitec Pay or bank via Paystack · 3-D Secure
            </p>
          </div>
        )}

        <p className="mt-8 text-center">
          <Link to="/" className="text-xs text-text-muted hover:text-text-primary">
            Powered by vimad
          </Link>
        </p>
      </main>
    </div>
  );
}
