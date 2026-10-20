import { Circle, CircleCheck, Lock } from 'lucide-react';

import type { BrandPack } from '@/lib/branding/pack';
import type { TenantSummary } from '@/lib/data/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

import { brandVerdict } from './brand-check';
import { COLLEGE_ASKS, type SetupStep } from './MediaReadiness';
import { LABEL } from './parts';

/**
 * The road to go-live, in the order it is usually walked.
 *
 * Eight stages. Five are read from the pack file and the tenant row, so the
 * console can say whether they are done. Three happen inside the college's
 * own console, in front of its own staff: the first admin signing in, the
 * degree register arriving, and members joining and being verified. The
 * vendor holds no capability that would say how any of them is going, so
 * they are drawn as the college's, with a lock, and never as a guess.
 */

type State = 'done' | 'next' | 'waiting' | 'outside';

interface Stage {
  key: string;
  label: string;
  owner: 'ifBash' | 'College';
  state: State;
  detail: string;
}

function stages(tenant: TenantSummary, pack: BrandPack | null, steps: SetupStep[]): Stage[] {
  const step = (key: SetupStep['key']) => steps.find((s) => s.key === key)!;
  const verdict = pack ? brandVerdict(pack) : null;

  const tracked: Array<Omit<Stage, 'state'> & { done: boolean }> = [
    { key: 'created', label: 'College created', owner: 'ifBash', done: true, detail: formatDate(tenant.createdAt) },
    {
      key: 'pack',
      label: 'Brand pack assigned',
      owner: 'ifBash',
      done: step('pack').done,
      detail: pack ? `${pack.copy.portalName} pack` : step('pack').ask,
    },
    {
      key: 'check',
      label: 'Brand check passed',
      owner: 'ifBash',
      done: step('check').done,
      detail: step('check').done && verdict ? verdict.summary : step('check').ask,
    },
    {
      key: 'mark',
      label: 'Crest or logo',
      owner: 'College',
      done: step('mark').done,
      detail: step('mark').done ? (pack?.assets.crest ? 'Crest in the pack' : 'Logo in the pack') : step('mark').ask,
    },
    {
      key: 'photos',
      label: 'Campus photos',
      owner: 'College',
      done: step('photos').done,
      detail: step('photos').done ? 'Photos in the pack' : step('photos').ask,
    },
  ];

  // The first open step that ifBash can see is the one to chase.
  const nextKey = tracked.find((s) => !s.done)?.key;

  const out: Stage[] = tracked.map((s) => ({
    key: s.key,
    label: s.label,
    owner: s.owner,
    detail: s.detail,
    state: s.done ? 'done' : s.key === nextKey ? 'next' : 'waiting',
  }));

  out.push(
    {
      key: 'admin',
      label: 'First admin signs in',
      owner: 'College',
      state: 'outside',
      detail: COLLEGE_ASKS.adminAccepted.ask,
    },
    {
      key: 'register',
      label: 'Degree register arrives',
      owner: 'College',
      state: 'outside',
      detail: COLLEGE_ASKS.register.ask,
    },
    {
      key: 'members',
      label: 'Members join and are verified',
      owner: 'College',
      state: 'outside',
      detail: `Inside ${tenant.shortName}’s own console. Nobody at ifBash can see this, by design.`,
    },
    {
      key: 'live',
      label: 'Live on its address',
      owner: 'ifBash',
      state: tenant.status === 'active' ? 'done' : 'waiting',
      detail: tenant.status === 'active' ? 'The portal answers on its own address.' : 'Switched on once the steps above are in hand.',
    },
  );

  return out;
}

const MARK = {
  done: <CircleCheck className="size-4 text-success-fg" />,
  next: <Circle className="size-4 fill-[var(--accent-soft)] text-accent-fg" strokeWidth={2.5} />,
  waiting: <Circle className="size-4 text-muted" />,
  outside: <Lock className="size-4 text-secondary" />,
} as const;

const STATE_TEXT: Record<State, string> = {
  done: 'done',
  next: 'next to chase',
  waiting: 'waiting',
  outside: 'tracked by the college, not visible here',
};

export function GoLiveTimeline({
  tenant,
  pack,
  steps,
}: {
  tenant: TenantSummary;
  pack: BrandPack | null;
  steps: SetupStep[];
}) {
  const all = stages(tenant, pack, steps);
  const visible = all.filter((s) => s.state !== 'outside');
  const done = visible.filter((s) => s.state === 'done').length;

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-display-xs font-bold leading-none tabular text-primary">
          {done}
          <span className="text-secondary"> / {visible.length}</span>
        </span>
        <span className={LABEL}>steps visible to ifBash are done</span>
      </p>

      <ol className="relative">
        {all.map((s, i) => {
          const last = i === all.length - 1;
          return (
            <li key={s.key} className="grid grid-cols-[2rem_1.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2.5rem_1.25rem_minmax(0,1fr)]">
              <span className="pt-0.5 font-mono text-xs tabular text-accent-fg" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* The marker and the rail beneath it, which runs to the next marker. */}
              <span className="relative flex justify-center pt-0.5" aria-hidden="true">
                {MARK[s.state]}
                {last ? null : (
                  <span
                    className={cn(
                      'absolute bottom-0 top-6 w-px',
                      s.state === 'outside' ? 'border-l border-dashed border-line-strong' : 'bg-line-strong',
                    )}
                  />
                )}
              </span>

              <div className={cn('min-w-0 pb-6', last && 'pb-0')}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className={cn('text-sm font-semibold', s.state === 'waiting' ? 'text-secondary' : 'text-primary')}>
                    {s.label}
                    <span className="sr-only">, {STATE_TEXT[s.state]}</span>
                  </p>
                  <span className={cn(LABEL, 'border border-line-strong px-1.5 leading-5')}>{s.owner}</span>
                </div>
                <p
                  className={cn(
                    'mt-1 max-w-prose text-sm text-secondary',
                    s.state === 'next' && 'border-l-2 border-accent-fg bg-accent-soft py-2 pl-3 pr-3 text-accent-soft-fg',
                  )}
                >
                  {s.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
