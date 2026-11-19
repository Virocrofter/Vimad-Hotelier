import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, ShoppingBag, Banknote, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '../../../lib/guest-utils';
import { useReservations } from '../../../hooks/useReservations';
import { useProperties } from '../../../hooks/useProperties';
import {
  listUpsellProducts,
  createUpsellProduct,
  sellUpsell,
  getUpsellSalesReport,
} from '../../../api/upsell-api';
import { apiPost } from '../../../api/client';

const CATEGORIES = ['Dining', 'Spa', 'Transport', 'Activity', 'Other'];
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function UpsellPage() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selling, setSelling] = useState(null);
  const [error, setError] = useState('');

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['upsell-products'],
    queryFn: listUpsellProducts,
  });
  const products = productsData ?? [];

  const { data: report } = useQuery({
    queryKey: ['upsell-report', todayISO()],
    queryFn: () => getUpsellSalesReport({ from: todayISO(), to: todayISO() }),
  });

  const { data: resData } = useReservations({ status: 'checked_in' });
  const inHouse = resData?.data?.items ?? resData?.data ?? [];

  const { data: propData } = useProperties();
  const properties = propData?.data?.items ?? propData?.data ?? [];
  const propertyId = products[0]?.propertyId ?? properties[0]?.id ?? inHouse[0]?.propertyId ?? '';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['upsell-products'] });
    queryClient.invalidateQueries({ queryKey: ['upsell-report'] });
  };

  const createMutation = useMutation({
    mutationFn: (input) =>
      apiPost('/v1/upsell/products' + (propertyId ? `?propertyId=${propertyId}` : ''), input).then(
        (r) => r.data
      ),
    onSuccess: () => {
      setShowNew(false);
      setError('');
      invalidate();
    },
    onError: (e) => setError(e.message || 'Create failed'),
  });

  const sellMutation = useMutation({
    mutationFn: sellUpsell,
    onSuccess: () => {
      setSelling(null);
      setError('');
      invalidate();
    },
    onError: (e) => setError(e.message || 'Sale failed'),
  });

  const kpis = [
    { label: 'Products', value: products.length, icon: Package },
    { label: 'Sold today', value: report?.totalSales ?? 0, icon: ShoppingBag },
    {
      label: 'Revenue today',
      value: formatCurrency(report?.totalRevenue ?? 0),
      icon: Banknote,
      revenue: true,
    },
  ];

  return (
    <div className="hq-surface-0 min-h-full space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Upsells</h1>
          <p className="text-sm text-text-secondary">
            In-stay revenue — sell extras to checked-in guests.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New product
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map(({ label, value, icon: Icon, revenue }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {label}
                </p>
                <p
                  className={`text-3xl font-semibold tabular-nums ${
                    revenue ? 'hq-revenue' : 'text-text-primary'
                  }`}
                >
                  {value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading products…</p>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Package className="h-8 w-8 text-text-muted" />
            <p className="text-sm font-medium text-text-primary">No products yet</p>
            <p className="text-xs text-text-muted">
              Create your first upsell — spa slots, airport transfers, late checkout.
            </p>
            <Button className="mt-2" onClick={() => setShowNew(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                  <Tag className="h-3 w-3" />
                  {p.category}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums hq-revenue">
                  {formatCurrency(Number(p.price))}
                  <span className="ml-1 text-xs font-normal text-text-muted">
                    {p.taxInclusive ? 'incl. tax' : '+ tax'}
                  </span>
                </p>
                <Button className="mt-3 w-full" onClick={() => setSelling(p)}>
                  <ShoppingBag className="mr-1.5 h-4 w-4" />
                  Sell
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {report?.byProduct?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's sales</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-text-muted">
                  <th className="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide">
                    Product
                  </th>
                  <th className="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide">
                    Qty
                  </th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.byProduct.map((row) => (
                  <tr key={row.productId} className="border-b border-border/50">
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.quantity}</td>
                    <td className="py-2 text-right tabular-nums hq-revenue">
                      {formatCurrency(Number(row.revenue))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {showNew && (
        <NewProductModal
          onClose={() => setShowNew(false)}
          onSubmit={(input) => createMutation.mutate(input)}
          isSubmitting={createMutation.isPending}
        />
      )}

      {selling && (
        <SellModal
          product={selling}
          reservations={inHouse}
          onClose={() => setSelling(null)}
          onSubmit={(reservationId, quantity) =>
            sellMutation.mutate({ productId: selling.id, reservationId, quantity })
          }
          isSubmitting={sellMutation.isPending}
        />
      )}
    </div>
  );
}

function NewProductModal({ onClose, onSubmit, isSubmitting }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState('');
  const [taxInclusive, setTaxInclusive] = useState(true);
  const valid = name.trim() && Number(price) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-base font-semibold text-text-primary">New product</h2>
        <div className="mt-4 space-y-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name (e.g. Spa Session)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (ZAR)"
            inputMode="decimal"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm tabular-nums outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={taxInclusive}
              onChange={(e) => setTaxInclusive(e.target.checked)}
            />
            Tax inclusive
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || isSubmitting}
            onClick={() =>
              onSubmit({ name: name.trim(), category, price: Number(price), taxInclusive })
            }
          >
            {isSubmitting ? 'Saving…' : 'Create product'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SellModal({ product, reservations, onClose, onSubmit, isSubmitting }) {
  const [reservationId, setReservationId] = useState('');
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-base font-semibold text-text-primary">Sell — {product.name}</h2>
        <p className="mt-1 text-sm tabular-nums hq-revenue">
          {formatCurrency(Number(product.price))}
        </p>
        <div className="mt-4 space-y-3">
          {reservations.length === 0 ? (
            <p className="text-sm text-text-muted">No in-house guests to sell to.</p>
          ) : (
            <select
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none"
            >
              <option value="">Select in-house reservation…</option>
              {reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.guestName ?? 'Guest') + ' — ' + (r.confirmationNumber ?? r.id.slice(0, 8))}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Quantity</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                −
              </Button>
              <span className="w-6 text-center text-sm tabular-nums">{quantity}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuantity(Math.min(9, quantity + 1))}
              >
                +
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!reservationId || reservations.length === 0 || isSubmitting}
            onClick={() => onSubmit(reservationId, quantity)}
          >
            {isSubmitting ? 'Selling…' : 'Confirm sale'}
          </Button>
        </div>
      </div>
    </div>
  );
}
