/* apps/web/src/app/app/stock/page.jsx — F6/F9 surface: stock items with
 * derived on-hand counts + low flags, movement ledger, recipe/BOM builder,
 * and the item-performance ranking. Rides the pinned p56 API. */
import { useCallback, useEffect, useState } from 'react';
import { useProperties } from '../../../hooks/useProperties';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';
import {
  Loader2,
  RefreshCw,
  Package,
  AlertTriangle,
  ChefHat,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

const fmt = (n) =>
  `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StockPage() {
  const { properties } = useProperties();
  const property = properties?.[0];
  const [tab, setTab] = useState('items');
  const [items, setItems] = useState(null);
  const [recipes, setRecipes] = useState(null);
  const [perf, setPerf] = useState(null);
  const [err, setErr] = useState(null);
  const [movementsFor, setMovementsFor] = useState(null);
  const [movements, setMovements] = useState([]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- stable refresh identity drives the polling effect
  const refresh = useCallback(async () => {
    if (!property?.id) return;
    try {
      const [i, r, p] = await Promise.all([
        apiClient.get('/stock/items', { params: { propertyId: property.id } }),
        apiClient.get('/stock/recipes', { params: { propertyId: property.id } }),
        apiClient.get('/stock/performance', { params: { propertyId: property.id } }),
      ]);
      setItems(i?.data?.data ?? []);
      setRecipes(r?.data?.data ?? []);
      setPerf(p?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e?.data?.error?.msg ?? 'Stock failed to load');
    }
  }, [property?.id]);

  useEffect(() => {
    Promise.resolve().then(refresh);
  }, [refresh]);

  const act = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast({ title: ok });
      await refresh();
    } catch (e) {
      toast({ title: 'Failed', description: e?.data?.error?.msg, variant: 'destructive' });
    }
  };

  const openMovements = async (item) => {
    setMovementsFor(item);
    const r = await apiClient.get(`/stock/items/${item.id}/movements`);
    setMovements(r?.data?.data ?? []);
  };

  if (!property) {
    return (
      <div className="p-6 text-sm text-text-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading property…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Stock & Recipes</h1>
          <p className="mt-1 text-sm text-text-secondary">
            On-hand counts derive from the movement ledger; sold items deduct through recipes.
          </p>
        </div>
        <button
          onClick={refresh}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary"
        >
          <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-1 rounded-lg border border-border p-0.5 w-fit">
        {[
          ['items', 'Items', Package],
          ['recipes', 'Recipes / BOM', ChefHat],
          ['performance', 'Performance', TrendingUp],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === key ? 'bg-primary text-primary-foreground' : 'text-text-muted'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}

      {tab === 'items' && (
        <ItemsTab property={property} items={items} onAdjust={act} onMovements={openMovements} />
      )}
      {tab === 'recipes' && (
        <RecipesTab property={property} recipes={recipes} items={items} onAct={act} />
      )}
      {tab === 'performance' && <PerfTab perf={perf} />}

      {movementsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {movementsFor.name} — movements
              </h2>
              <button onClick={() => setMovementsFor(null)} className="text-text-muted">
                ✕
              </button>
            </div>
            <div className="mt-3 max-h-80 space-y-1 overflow-y-auto text-xs">
              {movements.length === 0 && <p className="text-text-muted">No movements yet.</p>}
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b border-border/50 py-1.5"
                >
                  <span className="flex items-center gap-1.5">
                    {Number(m.quantityDelta) < 0 ? (
                      <ArrowDownCircle className="h-3.5 w-3.5 text-danger" />
                    ) : (
                      <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    <span className="capitalize">{m.kind}</span>
                    {m.note ? <span className="text-text-muted">· {m.note}</span> : null}
                  </span>
                  <span className="font-mono">
                    {Number(m.quantityDelta) > 0 ? '+' : ''}
                    {Number(m.quantityDelta)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemsTab({ property, items, onAdjust, onMovements }) {
  const [form, setForm] = useState({ name: '', unit: 'ea', parLevel: '', costPerUnit: '' });

  const adjust = (item, kind) => {
    const qty = window.prompt(`${kind} — quantity for "${item.name}" (${item.unit})?`, '1');
    if (qty === null) return;
    const note = window.prompt('Note (optional)') ?? undefined;
    onAdjust(
      () =>
        apiClient.post(`/stock/items/${item.id}/adjust`, {
          kind,
          quantityDelta: Number(qty),
          note,
        }),
      'Movement recorded'
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Item name (Burger patties)"
          className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <input
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          placeholder="Unit (ea/L/kg)"
          className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm"
        />
        <input
          value={form.parLevel}
          onChange={(e) => setForm({ ...form, parLevel: e.target.value })}
          placeholder="Par level"
          type="number"
          className="h-9 w-28 rounded-md border border-border bg-background px-3 text-sm"
        />
        <input
          value={form.costPerUnit}
          onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
          placeholder="Cost/unit (R)"
          type="number"
          step="0.01"
          className="h-9 w-32 rounded-md border border-border bg-background px-3 text-sm"
        />
        <button
          disabled={!form.name.trim()}
          onClick={() =>
            onAdjust(
              () =>
                apiClient.post('/stock/items', {
                  propertyId: property.id,
                  name: form.name.trim(),
                  unit: form.unit.trim() || 'ea',
                  parLevel: form.parLevel ? Number(form.parLevel) : undefined,
                  costPerUnit: form.costPerUnit ? Number(form.costPerUnit) : undefined,
                }),
              'Item added'
            ).then(() => setForm({ name: '', unit: 'ea', parLevel: '', costPerUnit: '' }))
          }
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Add item
        </button>
      </div>

      {!items && <p className="text-sm text-text-muted">Loading…</p>}
      {items && items.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
          No stock items yet — add what the kitchen and bar hold.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items?.map((i) => (
          <div
            key={i.id}
            className={`rounded-xl border bg-surface p-4 ${
              i.low ? 'border-danger/40' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-text-primary">{i.name}</p>
                <p className="text-xs text-text-muted">
                  {i.unit}
                  {i.costPerUnit != null ? ` · ${fmt(i.costPerUnit)}` : ''}
                </p>
              </div>
              {i.low && <AlertTriangle className="h-4 w-4 text-danger" />}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-text-primary">{i.onHand}</span>
              <span className="text-xs text-text-muted">
                on hand{i.parLevel != null ? ` · par ${i.parLevel}` : ''}
              </span>
            </div>
            <div className="mt-3 flex gap-1.5">
              <button
                onClick={() => adjust(i, 'purchase')}
                className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white"
              >
                + Purchase
              </button>
              <button
                onClick={() => adjust(i, 'waste')}
                className="rounded-md border border-danger/40 px-2 py-1.5 text-xs text-danger"
              >
                Waste
              </button>
              <button
                onClick={() => onMovements(i)}
                className="rounded-md border border-border px-2 py-1.5 text-xs text-text-secondary"
              >
                Ledger
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecipesTab({ property, recipes, items, onAct }) {
  const [form, setForm] = useState({ name: '', productId: '' });
  const [ings, setIngs] = useState([{ stockItemId: '', quantity: '' }]);

  const create = () =>
    onAct(
      () =>
        apiClient.post('/stock/recipes', {
          propertyId: property.id,
          name: form.name.trim(),
          productId: form.productId || undefined,
          ingredients: ings
            .filter((g) => g.stockItemId && Number(g.quantity) > 0)
            .map((g) => ({ stockItemId: g.stockItemId, quantity: Number(g.quantity) })),
        }),
      'Recipe created'
    ).then(() => {
      setForm({ name: '', productId: '' });
      setIngs([{ stockItemId: '', quantity: '' }]);
    });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-semibold text-text-primary">New recipe / BOM</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Recipe name"
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
            placeholder="Catalog product ID (optional link)"
            className="h-9 w-64 rounded-md border border-border bg-background px-3 font-mono text-xs"
          />
        </div>
        {ings.map((g, idx) => (
          <div key={idx} className="mt-2 flex gap-2">
            <select
              value={g.stockItemId}
              onChange={(e) =>
                setIngs(ings.map((x, j) => (j === idx ? { ...x, stockItemId: e.target.value } : x)))
              }
              className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Ingredient…</option>
              {items?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
            <input
              value={g.quantity}
              onChange={(e) =>
                setIngs(ings.map((x, j) => (j === idx ? { ...x, quantity: e.target.value } : x)))
              }
              placeholder="Qty"
              type="number"
              step="0.001"
              className="h-9 w-24 rounded-md border border-border bg-background px-2 text-sm"
            />
            <button
              onClick={() => setIngs(ings.filter((_, j) => j !== idx))}
              className="rounded-md border border-border px-2 text-text-muted"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setIngs([...ings, { stockItemId: '', quantity: '' }])}
            className="text-xs text-text-muted underline"
          >
            + Ingredient
          </button>
          <button
            onClick={create}
            disabled={
              !form.name.trim() || !ings.some((g) => g.stockItemId && Number(g.quantity) > 0)
            }
            className="ml-auto h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save recipe
          </button>
        </div>
      </div>

      {recipes?.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <p className="font-semibold text-text-primary">{r.name}</p>
          {r.productId && <p className="text-xs text-text-muted">Linked product: {r.productId}</p>}
          <ul className="mt-2 space-y-0.5 text-xs text-text-secondary">
            {r.ingredients.map((g) => {
              const item = items?.find((i) => i.id === g.stockItemId);
              return (
                <li key={g.id}>
                  {Number(g.quantity)} × {item?.name ?? g.stockItemId}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PerfTab({ perf }) {
  if (!perf) return <p className="text-sm text-text-muted">Loading…</p>;
  if (perf.length === 0)
    return (
      <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
        No sales in the last 30 days yet — performance appears as the till and QR take orders.
      </p>
    );
  return (
    <div className="rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2 text-right">Sold</th>
            <th className="px-4 py-2 text-right">Comps</th>
            <th className="px-4 py-2 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {perf.map((row, i) => (
            <tr key={row.productId} className="border-b border-border/50 last:border-0">
              <td className="px-4 py-2 text-text-muted">{i + 1}</td>
              <td className="px-4 py-2 font-medium text-text-primary">{row.name}</td>
              <td className="px-4 py-2 text-right tabular-nums">{row.qty}</td>
              <td className="px-4 py-2 text-right tabular-nums text-text-muted">{row.comps}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(row.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
