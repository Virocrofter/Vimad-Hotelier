/* /app/dev-vrt — DS-06 VRT harness: renders state-matrix cells in isolation
 * for Playwright toHaveScreenshot baselines. DEV ONLY — renders null in
 * production builds. */
import { Button } from '../../../components/ui/button';

export default function VrtHarnessPage() {
  if (!import.meta.env.DEV) return null;
  return (
    <div className="space-y-10 bg-background p-8 text-text-primary">
      <section data-vrt="button-grid" className="flex flex-wrap items-center gap-3">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="primary" isLoading>
          Loading
        </Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
      </section>

      <section data-vrt="status-chips" className="flex flex-wrap gap-2">
        {[
          'bg-warning/25 text-[var(--warning-soft-fg)]',
          'bg-danger/25 text-[var(--danger-soft-fg)]',
          'bg-info/25 text-[var(--info-soft-fg)]',
          'bg-accent/25 text-[var(--accent-soft-fg)]',
          'bg-success/15 text-[var(--success)]',
        ].map((cls) => (
          <span key={cls} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
            Chip
          </span>
        ))}
      </section>

      <section data-vrt="surface-ladder" className="grid grid-cols-4 gap-2">
        <div className="rounded border border-border bg-[var(--hq-surface-0)] p-4">surface 0</div>
        <div className="rounded border border-border bg-[var(--hq-surface-1)] p-4">surface 1</div>
        <div className="rounded border border-border bg-[var(--hq-surface-2)] p-4">surface 2</div>
        <div className="rounded border border-border bg-[var(--hq-surface-3)] p-4">surface 3</div>
      </section>

      <section data-vrt="form-primitives" className="max-w-sm space-y-3">
        <input
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          placeholder="Input default"
        />
        <input
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm opacity-50"
          placeholder="Input disabled"
          disabled
        />
        <select
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          aria-label="Select"
        >
          <option>Select</option>
        </select>
      </section>

      <section data-vrt="typography" className="space-y-1">
        <p className="hq-text-display font-semibold">Display</p>
        <p className="hq-text-title font-semibold">Title</p>
        <p className="hq-text-section">Section</p>
        <p className="hq-text-body">Body</p>
        <p className="hq-text-caption text-text-muted">Caption muted</p>
        <p className="hq-tnum text-base font-semibold">R 12,345.67</p>
      </section>
    </div>
  );
}
