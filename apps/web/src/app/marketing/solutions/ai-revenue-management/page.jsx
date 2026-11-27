/* apps/web/src/app/marketing/solutions/ai-revenue-management/page.jsx
 * [CLAIM-PURGE] Phase 0+ — this page claimed an automated revenue manager with
 * invented percentage lifts. The register bans unsourced automation and revenue
 * claims. Rewritten honestly: guardrails, seasonal rules, audited 3-click
 * overrides. Foundation moves this content under Platform/Rates and re-routes it.
 */
export default function RevenueToolsPage() {
  const tools = [
    {
      title: 'Rate guardrails',
      blurb:
        'Floor and ceiling prices per room type. Nobody — tired night porter included — can accidentally sell a room below cost.',
    },
    {
      title: 'Seasonal and day-of-week rules',
      blurb:
        'December pricing applies itself. Weekday business vs weekend leisure rates without a spreadsheet.',
    },
    {
      title: '3-click overrides, fully audited',
      blurb:
        'When you disagree with the rules, override in three clicks. Every override is logged — who, when, what, why.',
    },
    {
      title: 'Derived rates',
      blurb:
        'Set the rack rate once; BB, dinner-inclusive, and long-stay prices derive from it. One change propagates everywhere.',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      <p className="text-sm uppercase tracking-widest text-text-secondary">Revenue tools</p>
      <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight">
        Pricing discipline, not pricing magic
      </h1>
      <p className="mt-4 max-w-2xl text-text-secondary">
        No black box, no promised percentage lifts. Vimad ships the guardrails and rules that keep
        your pricing sane — and shows its work on every change.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {tools.map((t) => (
          <div key={t.title} className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">{t.title}</h2>
            <p className="mt-3 text-sm text-text-secondary">{t.blurb}</p>
          </div>
        ))}
      </div>
      <div className="mt-12">
        <a
          href="/pricing"
          className="inline-flex h-11 items-center rounded-lg bg-secondary px-6 text-sm font-medium text-white"
        >
          See which tier includes what
        </a>
      </div>
    </div>
  );
}
