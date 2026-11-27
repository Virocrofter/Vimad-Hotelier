/* apps/web/src/app/marketing/blog/page.jsx
 * [CLAIM-PURGE] Phase 0+ — the blog was a shell carrying a fabricated customer
 * case study with invented percentage gains. Replaced with an honest shelf: the
 * three switcher guides, published as real cutovers land. Foundation rebuilds this
 * as the full content engine with real posts + routes.
 */
export default function BlogPage() {
  const guides = [
    {
      title: 'NightsBridge to Vimad: the full migration playbook',
      blurb:
        'CSV export, the 1-afternoon cutover, running parallel for 30 days — the exact sequence, with the buyout offer explained.',
    },
    {
      title: 'The paper diary to PMS switchover checklist',
      blurb:
        'For the 8-to-30-room properties still running on the book: what to capture, what to leave behind, and what breaks if you rush.',
    },
    {
      title: "A guesthouse owner's guide to killing OTA commission",
      blurb:
        'The direct-booking math for small SA properties: what two saved bookings a month actually buy you.',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Resources</p>
      <h1 className="mt-2 text-4xl font-bold">The Switcher&rsquo;s Library</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Written from real South African cutovers, not a content mill. The first guides land with our
        founding hotels — every claim traceable to a property we can name.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {guides.map((g) => (
          <div key={g.title} className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold leading-snug">{g.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{g.blurb}</p>
            <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
              Publishing with pilot data
            </p>
          </div>
        ))}
      </div>
      <div className="mt-12 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Want these in your inbox the day they drop?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Leave your details on the{' '}
          <a className="underline" href="/contact">
            contact page
          </a>{' '}
          with the note &ldquo;send the guides&rdquo; — you&rsquo;ll get them before they&rsquo;re
          public.
        </p>
      </div>
    </div>
  );
}
