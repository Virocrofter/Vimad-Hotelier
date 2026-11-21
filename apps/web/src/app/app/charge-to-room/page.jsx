/* /app/charge-to-room — Phase 3: post an ad-hoc charge to an in-house guest. */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import { formatMoney } from '../../../lib/money';

export default function ChargeToRoomPage() {
  const qc = useQueryClient();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const search = async () => {
    setMsg(null);
    if (term.trim().length < 2) return;
    try {
      const res = await apiClient.get('/reservations', {
        params: { search: term.trim(), status: 'checked_in', limit: 10 },
      });
      const d = res?.data?.data ?? res?.data ?? [];
      setResults(Array.isArray(d) ? d : (d.reservations ?? []));
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.error?.message ?? 'Search failed' });
    }
  };

  const post = async () => {
    if (!picked || !description.trim() || !Number(amount) || Number(amount) <= 0) {
      setMsg({ ok: false, text: 'Pick a guest, enter a description and a positive amount.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post('/folios/charge-to-room', {
        reservationId: picked.id,
        description: description.trim(),
        amount: Number(amount),
      });
      setMsg({
        ok: true,
        text: `Posted ${formatMoney(Number(amount))} to ${picked.guestName ?? picked.confirmationNumber}.`,
      });
      setDescription('');
      setAmount('');
      setPicked(null);
      setResults([]);
      qc.invalidateQueries();
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.error?.message ?? 'Post failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="hq-text-title font-semibold">Charge to room</h1>
        <p className="hq-text-caption text-text-muted">
          Post an incidental charge to an in-house guest&apos;s folio.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
          placeholder="Search guest name or confirmation number"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button
          onClick={search}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </div>
      {results.length > 0 && !picked && (
        <div className="space-y-1 rounded-lg border border-border bg-surface p-2">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => setPicked(r)}
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-surface-elevated"
            >
              <span>
                {r.guestName ?? 'Guest'} · {r.confirmationNumber}
              </span>
              <span className="text-[11px] text-text-muted">
                balance {formatMoney(r.balance ?? 0)}
              </span>
            </button>
          ))}
        </div>
      )}
      {picked && (
        <div className="rounded-lg border border-border bg-surface p-3 text-sm">
          <span className="font-medium">{picked.guestName ?? 'Guest'}</span> ·{' '}
          {picked.confirmationNumber}
          <button
            onClick={() => setPicked(null)}
            className="ml-2 text-[11px] text-text-muted underline"
          >
            change
          </button>
        </div>
      )}
      <div className="space-y-2">
        <input
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          placeholder="Description (e.g. Minibar restock)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          placeholder="Amount (R, e.g. 150)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <button
        onClick={post}
        disabled={busy || !picked}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        {busy ? 'Posting…' : 'Post charge'}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
    </div>
  );
}
