/* apps/web/src/app/app/ar/page.jsx
 * Accounts Receivable — corporate ledger.
 * Replaces the fully-mocked page with live data from /v1/ar.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  X,
  Send,
  Ban,
  RotateCcw,
  Building2,
  FileText,
  Wallet,
  Download,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '../../../hooks/use-toast';
import { formatMoney } from '../../../lib/money';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { getArStatementCsvUrl, getArStatement } from '../../../api/ar';
import {
  useArSummary,
  useArAccounts,
  useArAccount,
  useArInvoices,
  useArInvoice,
  useArPayments,
  useCreateArAccount,
  useUpdateArAccount,
  useCreateArInvoice,
  useSendArInvoice,
  useCancelArInvoice,
  useRecordArPayment,
  useReverseArPayment,
} from '../../../hooks/useAr';

// ─── Helpers ───

const fmtMoney = (n) => formatMoney(Number(n ?? 0));

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

const STATUS_STYLE = {
  draft: 'bg-[var(--hq-surface-2)] text-text-secondary',
  sent: 'bg-accent/15 text-accent',
  partially_paid: 'bg-warning/15 text-warning',
  overdue: 'bg-danger/15 text-danger',
  paid: 'bg-success/15 text-success',
  cancelled: 'bg-[var(--hq-surface-2)] text-text-muted line-through',
};

const STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  partially_paid: 'Partial',
  overdue: 'Overdue',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

// ─── AR stack: segmented invoice-status bar (AR completion) ───
function InvoiceStatusBar({ invoices }) {
  const counts = {};
  for (const inv of invoices ?? []) counts[inv.status] = (counts[inv.status] ?? 0) + 1;
  const keys = Object.keys(STATUS_STYLE).filter((k) => counts[k] > 0);
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Invoice status summary">
      {keys.map((k) => (
        <span
          key={k}
          className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-medium ${STATUS_STYLE[k]}`}
        >
          <span className="hq-tnum font-semibold">{counts[k]}</span>
          {STATUS_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300';
const thCls = 'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted';
const tdCls = 'px-4 py-2.5 text-sm text-text-secondary';

// ─── Small building blocks ───

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto rounded-xl bg-card shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-[var(--hq-surface-2)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* StatCard (blueprint S2/S6): micro-label above the numeral, tabular figures,
 * soft icon chip; red chip for alert (overdue). */
function StatCard({ label, value, sub, alert }) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 shadow-sm ${
        alert ? 'border-danger/40' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={
            alert
              ? { background: 'color-mix(in srgb, #ef4444 15%, transparent)', color: '#ef4444' }
              : { background: 'color-mix(in srgb, #3b82f6 15%, transparent)', color: '#3b82f6' }
          }
        >
          <Wallet className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              alert ? 'text-danger' : 'text-text-primary'
            }`}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-text-muted">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function AgingBar({ buckets }) {
  const entries = [
    ['Not due', buckets?.not_due ?? 0, 'bg-muted'],
    ['1–30', buckets?.['1-30'] ?? 0, 'bg-amber-400'],
    ['31–60', buckets?.['31-60'] ?? 0, 'bg-orange-500'],
    ['61–90', buckets?.['61-90'] ?? 0, 'bg-red-500'],
    ['90+', buckets?.['90+'] ?? 0, 'bg-red-700'],
  ];
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Aging — outstanding by bucket
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-md">
        {entries.map(([label, v, cls]) => (
          <div
            key={label}
            title={`${label}: ${fmtMoney(v)}`}
            style={{ width: `${(v / total) * 100}%` }}
            className={`${cls} h-full border-r border-white last:border-0`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        {entries.map(([label, v, cls]) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${cls}`} />
            {label}: <span className="font-medium">{fmtMoney(v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <Badge
      className={`${STATUS_STYLE[status] ?? 'bg-[var(--hq-surface-2)] text-text-secondary'} hover:bg-none`}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

// ─── New account modal ───

function NewAccountModal({ onClose }) {
  const { toast } = useToast();
  const createAccount = useCreateArAccount();
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    taxNumber: '',
    billingEmail: '',
    paymentTermsDays: 30,
    creditLimit: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    createAccount.mutate(
      {
        name: form.name,
        contactName: form.contactName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        taxNumber: form.taxNumber || undefined,
        billingEmail: form.billingEmail || undefined,
        paymentTermsDays: Number(form.paymentTermsDays) || 30,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: 'Account created' });
          onClose();
        },
        onError: (err) =>
          toast({
            title: 'Failed to create account',
            description: err.message,
            variant: 'destructive',
          }),
      }
    );
  };

  return (
    <Modal title="New corporate account" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-xs font-medium text-text-secondary">
          Company name *
          <input className={inputCls} value={form.name} onChange={set('name')} required />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Contact
          <input className={inputCls} value={form.contactName} onChange={set('contactName')} />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Phone
          <input className={inputCls} value={form.phone} onChange={set('phone')} />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          AP email
          <input className={inputCls} type="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Billing email
          <input
            className={inputCls}
            type="email"
            value={form.billingEmail}
            onChange={set('billingEmail')}
          />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          VAT / tax number
          <input className={inputCls} value={form.taxNumber} onChange={set('taxNumber')} />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Credit limit (R)
          <input
            className={inputCls}
            type="number"
            min="0"
            value={form.creditLimit}
            onChange={set('creditLimit')}
          />
        </label>
        <label className="col-span-2 text-xs font-medium text-text-secondary">
          Payment terms (days)
          <input
            className={inputCls}
            type="number"
            min="0"
            max="365"
            value={form.paymentTermsDays}
            onChange={set('paymentTermsDays')}
          />
        </label>
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createAccount.isPending}>
            {createAccount.isPending ? 'Saving…' : 'Create account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── New invoice modal ───

function NewInvoiceModal({ accounts, onClose }) {
  const { toast } = useToast();
  const createInvoice = useCreateArInvoice();
  const [form, setForm] = useState({
    corporateAccountId: '',
    vatRate: 15,
    dueDate: '',
    notes: '',
  });
  const [items, setItems] = useState([{ description: '', amount: '' }]);

  const total = useMemo(() => items.reduce((s, i) => s + (Number(i.amount) || 0), 0), [items]);
  const vat = (total * (Number(form.vatRate) || 0)) / 100;

  const setItem = (idx, k) => (e) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, [k]: e.target.value } : it)));

  const submit = (e) => {
    e.preventDefault();
    createInvoice.mutate(
      {
        corporateAccountId: form.corporateAccountId,
        vatRate: Number(form.vatRate),
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
        items: items
          .filter((i) => i.description && Number(i.amount) > 0)
          .map((i) => ({ description: i.description, amount: Number(i.amount) })),
      },
      {
        onSuccess: () => {
          toast({ title: 'Invoice created as draft' });
          onClose();
        },
        onError: (err) =>
          toast({
            title: 'Failed to create invoice',
            description: err.message,
            variant: 'destructive',
          }),
      }
    );
  };

  return (
    <Modal title="New AR invoice" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <label htmlFor="sel-361" className="col-span-2 text-xs font-medium text-text-secondary">
            Corporate account *
            <select
              id="sel-361"
              className={inputCls}
              value={form.corporateAccountId}
              onChange={(e) => setForm((f) => ({ ...f, corporateAccountId: e.target.value }))}
              required
            >
              <option value="">Select account…</option>
              {(accounts?.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-text-secondary">
            VAT %
            <input
              className={inputCls}
              type="number"
              min="0"
              max="100"
              value={form.vatRate}
              onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-text-secondary">
            Due date (blank = account terms)
            <input
              className={inputCls}
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </label>
          <label className="col-span-2 text-xs font-medium text-text-secondary">
            Notes
            <input
              className={inputCls}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Line items
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="mb-2 flex gap-2">
              <input
                className={inputCls}
                placeholder="Description (e.g. Room block — Oct, folio F-1029)"
                value={it.description}
                onChange={setItem(idx, 'description')}
              />
              <input
                className={`${inputCls} w-32`}
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={it.amount}
                onChange={setItem(idx, 'amount')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((arr) => arr.filter((_, i) => i !== idx))}
                disabled={items.length === 1}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((arr) => [...arr, { description: '', amount: '' }])}
          >
            <Plus size={14} className="mr-1" /> Add line
          </Button>
        </div>

        <div className="flex items-end justify-between border-t border-border pt-3">
          <div className="text-sm text-text-secondary">
            Subtotal: <span className="font-medium">{fmtMoney(total)}</span>
            <span className="mx-2">·</span>
            VAT: <span className="font-medium">{fmtMoney(vat)}</span>
            <span className="mx-2">·</span>
            Total: <span className="font-bold text-text-primary">{fmtMoney(total + vat)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createInvoice.isPending}>
              {createInvoice.isPending ? 'Creating…' : 'Create draft'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Record payment modal ───

function PaymentModal({ accounts, preselected, onClose }) {
  const { toast } = useToast();
  const recordPayment = useRecordArPayment();
  const [accountId, setAccountId] = useState(preselected?.accountId ?? '');
  const [form, setForm] = useState({
    invoiceId: preselected?.invoiceId ?? '',
    amount: '',
    method: 'bank_transfer',
    reference: '',
    note: '',
  });

  const { data: accountInvoices } = useArInvoices(
    accountId ? { accountId, status: 'open', pageSize: 100 } : undefined
  );

  const submit = (e) => {
    e.preventDefault();
    recordPayment.mutate(
      {
        corporateAccountId: accountId,
        invoiceId: form.invoiceId || undefined,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || undefined,
        note: form.note || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: 'Payment recorded' });
          onClose();
        },
        onError: (err) =>
          toast({
            title: 'Failed to record payment',
            description: err.message,
            variant: 'destructive',
          }),
      }
    );
  };

  return (
    <Modal title="Record payment" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label htmlFor="sel-518" className="col-span-2 text-xs font-medium text-text-secondary">
          Corporate account *
          <select
            id="sel-518"
            className={inputCls}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            <option value="">Select account…</option>
            {(accounts?.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="sel-534" className="col-span-2 text-xs font-medium text-text-secondary">
          Apply to invoice (blank = on-account)
          <select
            id="sel-534"
            className={inputCls}
            value={form.invoiceId}
            onChange={(e) => setForm((f) => ({ ...f, invoiceId: e.target.value }))}
            disabled={!accountId}
          >
            <option value="">On-account payment</option>
            {(accountInvoices?.data ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} — balance {fmtMoney(i.balance)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Amount (R) *
          <input
            className={inputCls}
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
          />
        </label>
        <label htmlFor="sel-562" className="text-xs font-medium text-text-secondary">
          Method
          <select
            id="sel-562"
            className={inputCls}
            value={form.method}
            onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
          >
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Reference (idempotency guard)
          <input
            className={inputCls}
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="Bank ref / EFT no."
          />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Note
          <input
            className={inputCls}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </label>
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={recordPayment.isPending || !accountId}>
            {recordPayment.isPending ? 'Recording…' : 'Record payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Invoice detail modal ───

function InvoiceModal({ invoiceId, onClose }) {
  const { toast } = useToast();
  const { data: inv, isLoading } = useArInvoice(invoiceId);
  const sendInvoice = useSendArInvoice();
  const cancelInvoice = useCancelArInvoice();
  const recordPayment = useRecordArPayment();
  const [payAmount, setPayAmount] = useState('');
  const [cancelReason, setCancelReason] = useState(null); // '' = awaiting inline reason (S11)

  if (isLoading || !inv)
    return (
      <Modal title="Invoice" onClose={onClose}>
        Loading…
      </Modal>
    );

  const canPay = ['sent', 'partially_paid', 'overdue'].includes(inv.status);
  const quickPay = () => {
    recordPayment.mutate(
      {
        corporateAccountId: inv.corporateAccount.id,
        invoiceId: inv.id,
        amount: Number(payAmount),
        method: 'bank_transfer',
      },
      {
        onSuccess: () => {
          toast({ title: 'Payment applied' });
          setPayAmount('');
        },
        onError: (err) =>
          toast({ title: 'Payment failed', description: err.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <Modal title={`${inv.number} — ${inv.corporateAccount.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={inv.status} />
          {inv.daysOverdue > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle size={13} /> {inv.daysOverdue} days overdue
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {inv.status === 'draft' && (
              <Button
                size="sm"
                onClick={() =>
                  sendInvoice.mutate(inv.id, {
                    onSuccess: () => toast({ title: 'Invoice marked as sent' }),
                    onError: (err) =>
                      toast({
                        title: 'Send failed',
                        description: err.message,
                        variant: 'destructive',
                      }),
                  })
                }
                disabled={sendInvoice.isPending}
              >
                <Send size={14} className="mr-1" /> Mark sent
              </Button>
            )}
            {inv.status !== 'cancelled' && inv.status !== 'paid' && (
              <Button size="sm" variant="outline" onClick={() => setCancelReason('')}>
                <Ban size={14} className="mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>

        {cancelReason !== null && (
          <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2">
            <input
              autoFocus
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCancelReason(null);
                if (e.key === 'Enter') {
                  cancelInvoice.mutate(
                    { id: inv.id, reason: cancelReason.trim() || undefined },
                    {
                      onSuccess: () => {
                        toast({ title: 'Invoice cancelled' });
                        onClose();
                      },
                      onError: (err) =>
                        toast({
                          title: 'Cancel failed',
                          description: err.message,
                          variant: 'destructive',
                        }),
                    }
                  );
                }
              }}
              placeholder="Cancellation reason (optional) — Enter confirms, Esc backs"
              className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
            />
            <Button
              size="sm"
              className="h-7"
              disabled={cancelInvoice.isPending}
              onClick={() =>
                cancelInvoice.mutate(
                  { id: inv.id, reason: cancelReason.trim() || undefined },
                  {
                    onSuccess: () => {
                      toast({ title: 'Invoice cancelled' });
                      onClose();
                    },
                    onError: (err) =>
                      toast({
                        title: 'Cancel failed',
                        description: err.message,
                        variant: 'destructive',
                      }),
                  }
                )
              }
            >
              Confirm cancel
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setCancelReason(null)}>
              Back
            </Button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-text-muted">Issued</div>
            {fmtDate(inv.issueDate)}
          </div>
          <div>
            <div className="text-xs text-text-muted">Due</div>
            {fmtDate(inv.dueDate)}
          </div>
          <div>
            <div className="text-xs text-text-muted">Total</div>
            {fmtMoney(inv.total)}
          </div>
          <div>
            <div className="text-xs text-text-muted">Balance</div>
            <span className="font-semibold">{fmtMoney(inv.balance)}</span>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Date</th>
              <th className={thCls}>Description</th>
              <th className={`${thCls} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it) => (
              <tr key={it.id} className="border-b border-slate-50">
                <td className={tdCls}>{fmtDate(it.date)}</td>
                <td className={tdCls}>
                  {it.description}
                  {it.folioId && (
                    <span className="ml-2 text-xs text-text-muted">folio {it.folioId}</span>
                  )}
                </td>
                <td className={`${tdCls} text-right`}>{fmtMoney(it.amount)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className={`${tdCls} text-right text-text-muted`}>
                Subtotal / VAT ({inv.vatRate}%)
              </td>
              <td className={`${tdCls} text-right text-text-muted`}>
                {fmtMoney(inv.subtotal)} / {fmtMoney(inv.vatAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        {inv.payments.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Payments
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {inv.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className={tdCls}>{fmtDate(p.receivedAt)}</td>
                    <td className={tdCls}>
                      {p.method}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </td>
                    <td className={`${tdCls} text-right`}>{fmtMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canPay && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--hq-surface-2)] p-3">
            <input
              className={`${inputCls} w-44`}
              type="number"
              min="0.01"
              step="0.01"
              placeholder={`Max ${formatMoney(inv.balance)}`}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <Button
              size="sm"
              onClick={quickPay}
              disabled={recordPayment.isPending || !Number(payAmount)}
            >
              {recordPayment.isPending ? 'Applying…' : 'Apply payment'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Account drawer ───

function AccountDrawer({ accountId, onClose }) {
  const { data: account } = useArAccount(accountId);
  const { data: invoices } = useArInvoices({ accountId, pageSize: 50 });
  const { data: payments } = useArPayments({ accountId, pageSize: 50 });
  const updateAccount = useUpdateArAccount();
  const [stmtRange, setStmtRange] = useState({ from: '', to: '' });
  const { data: statement } = useQuery({
    queryKey: ['ar', 'statement', accountId, stmtRange],
    queryFn: () =>
      getArStatement(accountId, {
        from: stmtRange.from || undefined,
        to: stmtRange.to || undefined,
      }),
    enabled: !!accountId,
  });

  if (!account) return null;
  const creditLimit =
    account.creditLimit === null || account.creditLimit === undefined
      ? null
      : Number(account.creditLimit);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{account.name}</h3>
          <button
            onClick={() => (window.location.href = '/app/ar/statement?account=' + account.id)}
            className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-elevated"
          >
            Consolidated statement
          </button>
          <div className="text-xs text-text-muted">
            Terms {account.paymentTermsDays ?? 30} days
            {account.taxNumber ? ` · VAT ${account.taxNumber}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={account.isActive ? 'outline' : 'default'}
            onClick={() =>
              updateAccount.mutate({ id: account.id, input: { isActive: !account.isActive } })
            }
          >
            {account.isActive ? 'Place on hold' : 'Reactivate'}
          </Button>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-[var(--hq-surface-2)]"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 px-5 py-4">
        <StatCard label="Outstanding" value={fmtMoney(account.outstanding)} />
        <StatCard label="Credit limit" value={creditLimit === null ? '—' : fmtMoney(creditLimit)} />
        <StatCard
          label="Available credit"
          value={
            account.availableCredit === null || account.availableCredit === undefined
              ? '—'
              : fmtMoney(account.availableCredit)
          }
          alert={account.availableCredit !== null && account.availableCredit < 0}
        />
      </div>

      <div className="px-5">
        <div className="mb-2 flex items-center gap-2">
          <input
            type="date"
            className={inputCls}
            value={stmtRange.from}
            onChange={(e) => setStmtRange((r) => ({ ...r, from: e.target.value }))}
          />
          <input
            type="date"
            className={inputCls}
            value={stmtRange.to}
            onChange={(e) => setStmtRange((r) => ({ ...r, to: e.target.value }))}
          />
          <a
            href={getArStatementCsvUrl(accountId, stmtRange)}
            download
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-[var(--hq-surface-2)]"
          >
            <Download size={13} /> CSV
          </a>
        </div>
        {statement && (
          <div className="mb-4 rounded-lg bg-[var(--hq-surface-2)] p-3 text-sm text-text-secondary">
            Opening balance:{' '}
            <span className="font-medium">{fmtMoney(statement.openingBalance)}</span>
            <span className="mx-2">·</span>
            Closing balance:{' '}
            <span className="font-semibold">{fmtMoney(statement.closingBalance)}</span>
          </div>
        )}

        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Invoices
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {(invoices?.data ?? []).map((i) => (
              <tr key={i.id} className="border-b border-slate-50">
                <td className={tdCls}>{i.number}</td>
                <td className={tdCls}>{fmtDate(i.issueDate)}</td>
                <td className={tdCls}>
                  <StatusBadge status={i.status} />
                </td>
                <td className={`${tdCls} text-right`}>{fmtMoney(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Payments
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {(payments?.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className={tdCls}>{fmtDate(p.receivedAt)}</td>
                <td className={tdCls}>
                  {p.method}
                  {p.reference ? ` · ${p.reference}` : ''}
                </td>
                <td className={`${tdCls} text-right`}>{fmtMoney(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="h-8" />
      </div>
    </div>
  );
}

// ─── Main page ───

export default function ArPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agingFilter, setAgingFilter] = useState('');
  const [modal, setModal] = useState(null); // 'account' | 'invoice' | 'payment'
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [paymentPreset, setPaymentPreset] = useState(null);
  const reversePayment = useReverseArPayment();
  const [reverseId, setReverseId] = useState(null); // pending inline reversal (S11)
  const [reverseReason, setReverseReason] = useState('');

  const { data: summary } = useArSummary();
  const accountParams = useMemo(
    () => ({ search: search || undefined, includeInactive: true, pageSize: 100 }),
    [search]
  );
  const { data: accounts } = useArAccounts(accountParams);
  const invoiceParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      aging: agingFilter || undefined,
      pageSize: 100,
    }),
    [search, statusFilter, agingFilter]
  );
  const { data: invoices, isLoading: invoicesLoading } = useArInvoices(invoiceParams);
  const { data: payments } = useArPayments({ pageSize: 100 });

  const exportInvoicesCsv = () => {
    const rows = [
      ['Number', 'Account', 'Issued', 'Due', 'Status', 'Total', 'Paid', 'Balance'].join(','),
      ...(invoices?.data ?? []).map((i) =>
        [
          i.number,
          `"${i.corporateAccount?.name ?? ''}"`,
          fmtDate(i.issueDate),
          fmtDate(i.dueDate),
          i.status,
          formatMoney(i.total),
          formatMoney(i.amountPaid),
          formatMoney(i.balance),
        ].join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ar-invoices.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="hq-surface-0 min-h-full space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary">
            <Wallet size={20} className="text-text-muted" />
            Accounts Receivable
          </h1>
          <p className="text-sm text-text-muted">
            Corporate ledger — invoices, remittances, aging.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModal('account')}>
            <Building2 size={14} className="mr-1" /> New account
          </Button>
          <Button variant="outline" onClick={() => setModal('invoice')}>
            <FileText size={14} className="mr-1" /> New invoice
          </Button>
          <Button
            onClick={() => {
              setPaymentPreset(null);
              setModal('payment');
            }}
          >
            <Plus size={14} className="mr-1" /> Record payment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total outstanding"
          value={fmtMoney(summary?.outstanding)}
          sub={`${summary?.openInvoiceCount ?? 0} open invoices`}
        />
        <StatCard
          label="Overdue"
          value={fmtMoney(summary?.overdue)}
          sub={`${summary?.overdueCount ?? 0} invoices past due`}
          alert={Number(summary?.overdue) > 0}
        />
        <StatCard
          label="Collected this month"
          value={fmtMoney(summary?.collectedThisMonth)}
          sub={`Billed ${fmtMoney(summary?.billedThisMonth)}`}
        />
        <StatCard
          label="DSO"
          value={summary?.dso != null ? `${summary.dso} days` : '—'}
          sub={`${summary?.activeAccounts ?? 0} active accounts`}
        />
      </div>

      <AgingBar buckets={summary?.buckets} />
      <InvoiceStatusBar invoices={invoices} />

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          {[
            ['invoices', 'Invoices'],
            ['accounts', 'Accounts'],
            ['payments', 'Payments'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-text-secondary hover:bg-[var(--hq-surface-2)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            className={`${inputCls} w-56 pl-8`}
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {tab === 'invoices' && (
          <>
            <select
              aria-label="Filter by status"
              id="sel-1135"
              className={`${inputCls} w-36`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partially_paid">Partially paid</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              aria-label="Filter by aging"
              id="sel-1149"
              className={`${inputCls} w-36`}
              value={agingFilter}
              onChange={(e) => setAgingFilter(e.target.value)}
            >
              <option value="">All aging</option>
              <option value="not_due">Not due</option>
              <option value="1-30">1–30 days</option>
              <option value="31-60">31–60 days</option>
              <option value="61-90">61–90 days</option>
              <option value="90+">90+ days</option>
            </select>
            <Button variant="outline" size="sm" onClick={exportInvoicesCsv}>
              <Download size={14} className="mr-1" /> CSV
            </Button>
          </>
        )}
      </div>

      {/* Invoices tab */}
      {tab === 'invoices' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-[var(--hq-surface-2)]">
                <th className={thCls}>Invoice</th>
                <th className={thCls}>Account</th>
                <th className={thCls}>Issued</th>
                <th className={thCls}>Due</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} text-right`}>Total</th>
                <th className={`${thCls} text-right`}>Balance</th>
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {(invoices?.data ?? []).map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-slate-50 hover:bg-[var(--hq-surface-2)]/60"
                >
                  <td className={`${tdCls} font-medium`}>{i.number}</td>
                  <td className={tdCls}>{i.corporateAccount?.name}</td>
                  <td className={tdCls}>{fmtDate(i.issueDate)}</td>
                  <td
                    className={`${tdCls} ${i.status === 'overdue' ? 'font-medium text-red-600' : ''}`}
                  >
                    {fmtDate(i.dueDate)}
                  </td>
                  <td className={tdCls}>
                    <StatusBadge status={i.status} />
                  </td>
                  <td className={`${tdCls} text-right`}>{fmtMoney(i.total)}</td>
                  <td className={`${tdCls} text-right font-medium`}>{fmtMoney(i.balance)}</td>
                  <td className={`${tdCls} text-right`}>
                    <button
                      className="rounded p-1 text-text-muted hover:bg-[var(--hq-surface-2)] hover:text-text-secondary"
                      onClick={() => setSelectedInvoice(i.id)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!invoicesLoading && (invoices?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-text-muted">
                    No invoices match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Accounts tab */}
      {tab === 'accounts' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-[var(--hq-surface-2)]">
                <th className={thCls}>Account</th>
                <th className={thCls}>Contact</th>
                <th className={thCls}>Terms</th>
                <th className={`${thCls} text-right`}>Credit limit</th>
                <th className={`${thCls} text-right`}>Outstanding</th>
                <th className={`${thCls} text-right`}>Available</th>
                <th className={thCls}>Status</th>
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {(accounts?.data ?? []).map((a) => {
                const limit =
                  a.creditLimit === null || a.creditLimit === undefined
                    ? null
                    : Number(a.creditLimit);
                const available =
                  a.availableCredit === null || a.availableCredit === undefined
                    ? null
                    : Number(a.availableCredit);
                const over = available !== null && available < 0;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-slate-50 hover:bg-[var(--hq-surface-2)]/60"
                  >
                    <td className={`${tdCls} font-medium`}>{a.name}</td>
                    <td className={tdCls}>
                      {a.contactName}
                      {a.email && <div className="text-xs text-text-muted">{a.email}</div>}
                    </td>
                    <td className={tdCls}>{a.paymentTermsDays ?? 30}d</td>
                    <td className={`${tdCls} text-right`}>
                      {limit === null ? '—' : fmtMoney(limit)}
                    </td>
                    <td className={`${tdCls} text-right font-medium`}>
                      {fmtMoney(a.outstanding ?? 0)}
                      {a.creditLimit ? (
                        <span className="mt-0.5 block text-[10px] text-text-muted">
                          limit {fmtMoney(a.creditLimit)} ·{' '}
                          {Math.min(
                            100,
                            Math.round((Number(a.outstanding ?? 0) / Number(a.creditLimit)) * 100)
                          )}
                          % used
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`${tdCls} text-right ${over ? 'font-semibold text-red-600' : ''}`}
                    >
                      {available === null ? '—' : fmtMoney(available)}
                    </td>
                    <td className={tdCls}>
                      <Badge
                        className={
                          a.isActive
                            ? 'bg-success/15 text-success'
                            : 'bg-[var(--hq-surface-2)] text-text-muted'
                        }
                      >
                        {a.isActive ? 'Active' : 'On hold'}
                      </Badge>
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <button
                        className="rounded p-1 text-text-muted hover:bg-[var(--hq-surface-2)] hover:text-text-secondary"
                        onClick={() => setSelectedAccount(a.id)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments tab */}
      {tab === 'payments' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {reverseId && (
            <div className="flex items-center gap-2 border-b border-danger/20 bg-danger/5 p-2">
              <input
                autoFocus
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setReverseId(null);
                  if (e.key === 'Enter') {
                    reversePayment.mutate(
                      { id: reverseId, reason: reverseReason.trim() || undefined },
                      {
                        onSuccess: () => {
                          toast({ title: 'Payment reversed' });
                          setReverseId(null);
                        },
                        onError: (err) =>
                          toast({
                            title: 'Reversal failed',
                            description: err.message,
                            variant: 'destructive',
                          }),
                      }
                    );
                  }
                }}
                placeholder="Reversal reason (optional) — Enter confirms, Esc backs"
                className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
              />
              <Button
                size="sm"
                className="h-7"
                disabled={reversePayment.isPending}
                onClick={() =>
                  reversePayment.mutate(
                    { id: reverseId, reason: reverseReason.trim() || undefined },
                    {
                      onSuccess: () => {
                        toast({ title: 'Payment reversed' });
                        setReverseId(null);
                      },
                      onError: (err) =>
                        toast({
                          title: 'Reversal failed',
                          description: err.message,
                          variant: 'destructive',
                        }),
                    }
                  )
                }
              >
                Confirm reversal
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setReverseId(null)}>
                Back
              </Button>
            </div>
          )}
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-[var(--hq-surface-2)]">
                <th className={thCls}>Date</th>
                <th className={thCls}>Account</th>
                <th className={thCls}>Invoice</th>
                <th className={thCls}>Method</th>
                <th className={thCls}>Reference</th>
                <th className={`${thCls} text-right`}>Amount</th>
                <th className={thCls}>Status</th>
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {(payments?.data ?? []).map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-50 hover:bg-[var(--hq-surface-2)]/60"
                >
                  <td className={tdCls}>{fmtDate(p.receivedAt)}</td>
                  <td className={tdCls}>{p.corporateAccount?.name}</td>
                  <td className={tdCls}>{p.invoice?.number ?? 'On account'}</td>
                  <td className={tdCls}>{p.method}</td>
                  <td className={tdCls}>{p.reference ?? '—'}</td>
                  <td className={`${tdCls} text-right`}>{fmtMoney(p.amount)}</td>
                  <td className={tdCls}>
                    <Badge
                      className={
                        p.status === 'applied'
                          ? 'bg-success/15 text-success'
                          : 'bg-[var(--hq-surface-2)] text-text-muted'
                      }
                    >
                      {p.status === 'applied' ? 'Applied' : 'Reversed'}
                    </Badge>
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {p.status === 'applied' && (
                      <button
                        className="rounded p-1 text-text-muted hover:bg-[var(--hq-surface-2)] hover:text-red-600"
                        title="Reverse payment"
                        onClick={() => {
                          setReverseId(p.id);
                          setReverseReason('');
                        }}
                      >
                        <RotateCcw size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals & drawers */}
      {modal === 'account' && <NewAccountModal onClose={() => setModal(null)} />}
      {modal === 'invoice' && (
        <NewInvoiceModal accounts={accounts} onClose={() => setModal(null)} />
      )}
      {modal === 'payment' && (
        <PaymentModal
          accounts={accounts}
          preselected={paymentPreset}
          onClose={() => setModal(null)}
        />
      )}
      {selectedInvoice && (
        <InvoiceModal invoiceId={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
      {selectedAccount && (
        <AccountDrawer accountId={selectedAccount} onClose={() => setSelectedAccount(null)} />
      )}
    </div>
  );
}
