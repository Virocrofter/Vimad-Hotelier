/* apps/web/src/app/app/vouchers/page.jsx — D7 gift vouchers: sell (code
 * revealed once), redeem against a folio, liability strip, refund. Owner/admin
 * (server-enforced; the page surfaces the 403 honestly). */
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';

const STATUS_BADGE = {
  sold: 'bg-blue-100 text-blue-800',
  redeemed: 'bg-emerald-100 text-emerald-800',
  refunded: 'bg-gray-200 text-gray-700',
};

const friendly = (e) =>
  e?.data?.error?.code === 'FORBIDDEN'
    ? 'Gift vouchers are owner/admin only — your role cannot manage them.'
    : (e?.data?.error?.msg ?? e?.data?.error?.code ?? 'Request failed');

export default function VouchersPage() {
  const [liability, setLiability] = useState(null);
  const [vouchers, setVouchers] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sellForm, setSellForm] = useState({
    amount: '',
    purchaserName: '',
    purchaserEmail: '',
    recipientName: '',
    paymentRef: '',
  });
  const [redeemForm, setRedeemForm] = useState({ code: '', folioId: '' });
  const [revealed, setRevealed] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [l, v] = await Promise.all([
        apiClient.get('/vouchers/liability'),
        apiClient.get('/vouchers', { params: { pageSize: 50 } }),
      ]);
      setLiability(l?.data?.data ?? null);
      setVouchers(v?.data?.data?.items ?? []);
      setErr(null);
    } catch (e) {
      setErr(friendly(e));
      setVouchers([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) toast({ title: okMsg });
      await refresh();
      return r?.data?.data;
    } catch (e) {
      toast({ title: 'Failed', description: friendly(e), variant: 'destructive' });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sell = () =>
    act(async () => {
      const r = await apiClient.post('/vouchers/sell', {
        amount: Number(sellForm.amount),
        purchaserName: sellForm.purchaserName,
        purchaserEmail: sellForm.purchaserEmail,
        recipientName: sellForm.recipientName || undefined,
        paymentRef: sellForm.paymentRef || undefined,
      });
      const d = r?.data?.data;
      if (d?.code) setRevealed(d);
      setSellForm({
        amount: '',
        purchaserName: '',
        purchaserEmail: '',
        recipientName: '',
        paymentRef: '',
      });
      return r;
    });

  const redeem = () =>
    act(async () => {
      const r = await apiClient.post('/vouchers/redeem', {
        code: redeemForm.code.trim(),
        folioId: redeemForm.folioId.trim(),
      });
      setRedeemForm({ code: '', folioId: '' });
      return r;
    }, 'Voucher redeemed');

  const refund = (id) =>
    act(async () => {
      return apiClient.post(`/vouchers/${id}/refund`, { reason: 'Refunded at desk' });
    }, 'Voucher refunded');

  const copy = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    toast({ title: 'Code copied' });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Gift Vouchers</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Sell, redeem and refund vouchers. Redemption posts the payment straight to the folio.
        </p>
      </div>

      {err && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-primary">
          {err}
        </div>
      )}

      {liability && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Outstanding liability</p>
            <p className="mt-1 font-mono text-xl font-bold text-text-primary">
              R {liability.outstanding?.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Sold</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{liability.soldCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Redeemed</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">
              {liability.redeemedCount}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Refunded</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">
              {liability.refundedCount}
            </p>
          </div>
        </div>
      )}

      {revealed && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="text-xs text-text-secondary">Voucher code (give this to the purchaser):</p>
          <code className="flex-1 rounded bg-background px-2 py-1 font-mono text-sm text-text-primary">
            {revealed.code}
          </code>
          <button
            onClick={() => copy(revealed.code)}
            className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-elevated"
          >
            Copy
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-text-primary">Sell a voucher</h2>
          <div className="mt-3 space-y-2">
            <input
              value={sellForm.amount}
              onChange={(e) => setSellForm({ ...sellForm, amount: e.target.value })}
              placeholder="Amount (ZAR)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
            <input
              value={sellForm.purchaserName}
              onChange={(e) => setSellForm({ ...sellForm, purchaserName: e.target.value })}
              placeholder="Purchaser name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
            <input
              value={sellForm.purchaserEmail}
              onChange={(e) => setSellForm({ ...sellForm, purchaserEmail: e.target.value })}
              placeholder="Purchaser email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
            <input
              value={sellForm.recipientName}
              onChange={(e) => setSellForm({ ...sellForm, recipientName: e.target.value })}
              placeholder="Recipient (optional)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
            <input
              value={sellForm.paymentRef}
              onChange={(e) => setSellForm({ ...sellForm, paymentRef: e.target.value })}
              placeholder="Payment reference (optional)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
            <button
              onClick={sell}
              disabled={
                busy ||
                !sellForm.amount ||
                Number(sellForm.amount) <= 0 ||
                !sellForm.purchaserName ||
                !sellForm.purchaserEmail
              }
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Sell
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-text-primary">Redeem a voucher</h2>
          <div className="mt-3 space-y-2">
            <input
              value={redeemForm.code}
              onChange={(e) => setRedeemForm({ ...redeemForm, code: e.target.value })}
              placeholder="Voucher code (VIM-…)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-text-primary"
            />
            <input
              value={redeemForm.folioId}
              onChange={(e) => setRedeemForm({ ...redeemForm, folioId: e.target.value })}
              placeholder="Folio ID to pay"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-text-primary"
            />
            <button
              onClick={redeem}
              disabled={busy || !redeemForm.code.trim() || !redeemForm.folioId.trim()}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
            >
              Redeem to folio
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text-primary">Vouchers</h2>
        {vouchers === null ? (
          <p className="mt-2 text-xs text-text-muted">Loading…</p>
        ) : vouchers.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">No vouchers yet.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {vouchers.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 text-xs text-text-secondary"
              >
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_BADGE[v.status]}`}
                >
                  {v.status}
                </span>
                <code className="font-mono">{v.code}</code>
                <span>R {v.amount?.toFixed(2)}</span>
                <span>{v.purchaserName}</span>
                {v.status === 'sold' && (
                  <button
                    onClick={() => refund(v.id)}
                    disabled={busy}
                    className="rounded border border-danger/40 px-2 py-0.5 text-danger hover:bg-danger/10"
                  >
                    Refund
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
