/* apps/web/src/app/app/content/page.jsx — staff content surface: room types
 * and catalog items with photos + descriptions, rendered by the booking page
 * and the QR menu. Upload via the files module; fields ride the pinned
 * p65/p66 payloads. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProperties } from '../../../hooks/useProperties';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';
import { Loader2, ImagePlus, RefreshCw } from 'lucide-react';

const imgUrl = (key) => `/v1/public/image/${encodeURIComponent(key)}`;

export default function ContentPage() {
  const { properties } = useProperties();
  const property = properties?.[0];
  const [roomTypes, setRoomTypes] = useState(null);
  const [products, setProducts] = useState(null);
  const [err, setErr] = useState(null);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- stable refresh identity drives the polling effect
  const refresh = useCallback(async () => {
    if (!property?.id) return;
    try {
      const [rt, up] = await Promise.all([
        apiClient.get('/content/room-types', { params: { propertyId: property.id } }),
        apiClient.get('/content/upsell-products', { params: { propertyId: property.id } }),
      ]);
      setRoomTypes(rt?.data?.data ?? []);
      setProducts(up?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e?.data?.error?.msg ?? 'Content failed to load');
    }
  }, [property?.id]);

  useEffect(() => {
    Promise.resolve().then(refresh);
  }, [refresh]);

  const patch = async (path, id, body, okMsg) => {
    try {
      await apiClient.patch(`/content/${path}/${id}`, body);
      toast({ title: okMsg });
      await refresh();
    } catch (e) {
      toast({ title: 'Failed', description: e?.data?.error?.msg, variant: 'destructive' });
    }
  };

  if (!property) {
    return (
      <div className="p-6 text-sm text-text-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading property…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Hotel page content</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Photos and descriptions shown on your booking page ({' '}
            <code className="text-xs">/book/{property.code}</code> ) and the QR menu.
          </p>
        </div>
        <button
          onClick={refresh}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary"
        >
          <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">Rooms</h2>
        {!roomTypes && <p className="text-sm text-text-muted">Loading…</p>}
        {roomTypes && roomTypes.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-5 text-sm text-text-muted">
            No room types yet — add them in onboarding first.
          </p>
        )}
        <div className="space-y-3">
          {roomTypes?.map((rt) => (
            <ContentCard
              key={rt.id}
              title={rt.name}
              imageKey={rt.imageKey}
              description={rt.description}
              onSave={(body) => patch('room-types', rt.id, body, 'Room updated')}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">
          Menu &amp; experiences
        </h2>
        {!products && <p className="text-sm text-text-muted">Loading…</p>}
        {products && products.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-5 text-sm text-text-muted">
            No items yet — the catalog also powers the QR menu and upsells.
          </p>
        )}
        <div className="space-y-3">
          {products?.map((p) => (
            <ContentCard
              key={p.id}
              title={p.name}
              imageKey={p.imageKey}
              description={p.description}
              extra={`R ${Number(p.price).toFixed(2)} · ${p.category}`}
              onSave={(body) => patch('upsell-products', p.id, body, 'Item updated')}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ContentCard({ title, imageKey, description, extra, onSave }) {
  const [desc, setDesc] = useState(description ?? '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => setDesc(description ?? ''), [description]);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = '';
      new Uint8Array(buf).forEach((b) => (binary += String.fromCharCode(b)));
      const r = await apiClient.post('/files/images', {
        name: file.name,
        contentBase64: btoa(binary),
      });
      const key = r?.data?.data?.key;
      if (key) {
        onSave({ imageKey: key });
      }
    } catch (e) {
      toast({ title: 'Upload failed', description: e?.data?.error?.msg, variant: 'destructive' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-surface p-4">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="relative flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-background text-text-muted hover:text-text-primary"
        title="Upload photo"
      >
        {imageKey ? (
          <img
            src={imgUrl(imageKey)}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <ImagePlus className="h-5 w-5" />
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-text-primary">{title}</p>
          {extra && <p className="text-xs text-text-muted">{extra}</p>}
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          placeholder="Description shown on the booking page…"
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onSave({ description: desc.trim() || null })}
            disabled={busy || desc.trim() === (description ?? '').trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Save description
          </button>
          {imageKey && (
            <button
              onClick={() => onSave({ imageKey: null })}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
