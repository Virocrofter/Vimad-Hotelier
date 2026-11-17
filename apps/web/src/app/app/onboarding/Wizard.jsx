/* Stage 4.5 - onboarding wizard (addendum #9). Interview-not-form: every
 * step completable or skippable, state resumable server-side. HQ-0 tokens.
 */
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../../../api/client';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome',
    body: 'Two quick questions so we set things up right. What best describes you?',
    field: 'role',
    options: ['Independent hotel', 'Small chain'],
  },
  {
    id: 'property',
    title: 'Your property',
    body: 'Property name and type. Everything is editable later.',
    field: 'propertyName',
    placeholder: 'Demo Downtown Hotel',
  },
  {
    id: 'rooms',
    title: 'Rooms',
    body: 'Add rooms now - tell us how many and we create them. Skipping is fine - the room board is always there.',
    field: 'roomCount',
    placeholder: 'e.g. 12',
  },
  {
    id: 'rates_taxes',
    title: 'Rates & taxes',
    body: 'Base currency and VAT. Defaults match South African hotels.',
    field: 'currency',
    placeholder: 'ZAR',
  },
  {
    id: 'operating_rhythm',
    title: 'Operating rhythm',
    body: 'Check-in / check-out times and timezone. These drive guest emails and task schedules.',
    field: 'checkInTime',
    placeholder: '14:00',
  },
  {
    id: 'people',
    title: 'People',
    body: 'Invite teammates and pick roles. You are the owner until you say otherwise.',
    field: null,
  },
  {
    id: 'guest_facing',
    title: 'Guest-facing basics',
    body: 'Confirmation and pre-arrival emails use your property details.',
    field: null,
  },
  {
    id: 'data',
    title: 'Your data',
    body: 'Start fresh, or import from CSV below. No data yet? Skipping is safe.',
    field: null,
  },
  {
    id: 'go_live',
    title: 'Go-live checklist',
    body: 'Run the acceptance test: modify a reservation, cancel one, move a room, fail a mapping on purpose.',
    field: null,
  },
];

export default function OnboardingWizard() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const q = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: () => api.get('/v1/onboarding-progress'),
  });
  const p = q.data?.data ?? {};
  const idx = Math.max(
    0,
    STEPS.findIndex((x) => x.id === p.activeStep)
  );
  const step = STEPS[idx] ?? STEPS[STEPS.length - 1];

  const done = () => qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
  const putStep = useMutation({
    mutationFn: (body) => api.put('/v1/onboarding-progress/step', body),
    onSuccess: done,
  });
  const dismiss = useMutation({
    mutationFn: () => api.post('/v1/onboarding-progress/dismiss', {}),
    onSuccess: done,
  });

  if (q.isLoading) return null;
  if (p.status === 'done') {
    return (
      <div className="mb-6 rounded-md border border-border bg-surface px-4 py-3">
        <p className="hq-text-caption text-text-muted">
          Setup complete - this property is live-ready.
        </p>
      </div>
    );
  }
  if (p.status === 'dismissed') {
    return (
      <div className="mb-6 flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
        <p className="hq-text-caption text-text-secondary">Setup {p.percent}% complete</p>
        <button
          onClick={() => putStep.mutate({ step: p.activeStep ?? 'welcome', action: 'skipped' })}
          className="rounded-md border border-border px-2.5 py-1 hq-text-caption text-text-secondary hover:bg-surface-elevated"
        >
          Resume setup
        </button>
      </div>
    );
  }

  const complete = () => {
    const answers = step.field && draft.trim() ? { [step.field]: draft.trim() } : {};
    putStep.mutate({ step: step.id, action: 'completed', answers });
    setDraft('');
  };

  return (
    <div className="mb-6 rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="hq-text-caption font-medium uppercase tracking-wide text-text-muted">
          Setup {p.percent}% - step {idx + 1} of {STEPS.length}
        </p>
        <button
          onClick={() => dismiss.mutate()}
          className="hq-text-caption text-text-muted hover:text-text-secondary"
        >
          Dismiss
        </button>
      </div>
      <div className="flex gap-1 px-4 pt-3">
        {STEPS.map((x, i) => (
          <span
            key={x.id}
            className={
              'h-1 flex-1 rounded-full ' +
              (i < idx ? 'bg-primary' : i === idx ? 'bg-primary/50' : 'bg-border')
            }
          />
        ))}
      </div>
      <div className="px-4 py-4">
        <h2 className="hq-text-h3 text-text-primary">{step.title}</h2>
        <p className="mt-1 hq-text-body text-text-secondary">{step.body}</p>
        {step.options ? (
          <div className="mt-3 flex gap-2">
            {step.options.map((o) => (
              <button
                key={o}
                onClick={() => {
                  setDraft(o);
                }}
                className={
                  'rounded-md border px-3 py-1.5 hq-text-caption ' +
                  (draft === o
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-text-secondary hover:bg-surface-elevated')
                }
              >
                {o}
              </button>
            ))}
          </div>
        ) : step.field ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={step.placeholder ?? ''}
            className="mt-3 w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 hq-text-body text-text-primary"
          />
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            onClick={complete}
            disabled={putStep.isPending}
            className="rounded-md bg-primary px-3 py-1.5 hq-text-caption font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {putStep.isPending ? 'Saving...' : step.id === 'go_live' ? 'Finish setup' : 'Continue'}
          </button>
          <button
            onClick={() => {
              putStep.mutate({ step: step.id, action: 'skipped' });
              setDraft('');
            }}
            disabled={putStep.isPending}
            className="rounded-md border border-border px-3 py-1.5 hq-text-caption text-text-secondary hover:bg-surface-elevated disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
