/* /app/ar/statement — consolidated corporate statement (print → PDF). */
import { useEffect, useState } from 'react';
import { apiClient } from '../../../../api/client';
import { formatMoney } from '../../../../lib/money';

const accountId = new URLSearchParams(window.location.search).get('account');

export default function ConsolidatedStatementPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!accountId) return;
    apiClient
      .post(`/ar/accounts/${accountId}/consolidated-statement`)
      .then((r) => setData(r?.data?.data ?? r?.data))
      .catch((e) => setErr(e?.response?.data?.error?.message ?? 'Failed to load statement'));
  }, []);

  if (!accountId)
    return <div className="p-6 text-sm text-danger">Missing ?account= parameter.</div>;
  if (err) return <div className="p-6 text-sm text-danger">{err}</div>;
  if (!data) return <div className="p-6 text-sm text-text-muted">Loading statement…</div>;

  const { account, invoices, totalOutstanding, generatedAt } = data;
  const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8 print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="hq-text-title font-semibold">Consolidated statement</h1>
          <p className="text-sm text-text-muted">{account.name}</p>
          {account.vatNumber && (
            <p className="text-[11px] text-text-muted">VAT {account.vatNumber}</p>
          )}
        </div>
        <div className="text-right text-[11px] text-text-muted">
          <p>Generated {fmtDate(generatedAt)}</p>
          <p>
            Terms {account.paymentTermsDays ?? 30} days
            {account.creditLimit != null
              ? ` · Limit ${formatMoney(Number(account.creditLimit))}`
              : ''}
          </p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-muted">
            <th className="py-2">Invoice</th>
            <th className="py-2">Due</th>
            <th className="py-2 text-right">Total</th>
            <th className="py-2 text-right">Paid</th>
            <th className="py-2 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-border/50">
              <td className="py-2">{inv.number}</td>
              <td className="py-2">{fmtDate(inv.dueDate)}</td>
              <td className="py-2 text-right hq-tnum">{formatMoney(Number(inv.total))}</td>
              <td className="py-2 text-right hq-tnum">
                {formatMoney(Number(inv.amountPaid ?? 0))}
              </td>
              <td className="py-2 text-right hq-tnum font-medium">
                {formatMoney(Number(inv.balance ?? 0))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-base font-semibold">
            <td className="pt-3" colSpan={4}>
              Total outstanding
            </td>
            <td className="pt-3 text-right hq-tnum">{formatMoney(Number(totalOutstanding))}</td>
          </tr>
        </tfoot>
      </table>
      {invoices.length === 0 && (
        <p className="text-sm text-text-muted">No open invoices for this account.</p>
      )}
      <button
        onClick={() => window.print()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground print:hidden"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
