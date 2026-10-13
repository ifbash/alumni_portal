'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ClipboardList,
  Copy,
  Eye,
  ImagePlus,
  MoreHorizontal,
  Search,
  Send,
  Undo2,
  UserCheck,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  Field,
  Input,
  MenuItem,
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { checkInCode } from '@/app/(app)/events/[slug]/ticket/TicketCode';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';

/**
 * The check-in desk.
 *
 * One component for every state: the door list (phones, and `?mode=door`
 * at any width), the desktop table, the read-only roster for a viewer who
 * cannot check people in, and the archived roster after the event.
 *
 * Marking is optimistic, because a queue at a door does not wait for a
 * round trip — the row flips first and the request follows. Every failure
 * puts it back, and the three the server raises are put back to the right
 * value rather than the previous one: "already checked in" means the person
 * is in, whatever this roster was showing.
 *
 * Reversing a check-in asks for a reason before it sends, because the
 * endpoint requires one.
 */

/** The minimum the endpoint accepts on a reversal. */
const REASON_MIN = 8;

export interface CheckInRow {
  id: string;
  memberName: string;
  batchYear: number | null;
  /** Only present for viewers at the `privileged` projection tier. */
  rollNumber: string | null;
  guests: number;
  amountLabel: string;
  checkedIn: boolean;
  checkedInLabel: string | null;
  registeredOn: string;
}

type Filter = 'all' | 'waiting' | 'arrived';

export function CheckInPanel({
  eventTitle,
  rows,
  canCheckIn,
  showRoll,
  isPast,
  door = false,
  rosterNote = null,
  officeName,
  collapsed = false,
}: {
  eventTitle: string;
  rows: CheckInRow[];
  canCheckIn: boolean;
  showRoll: boolean;
  isPast: boolean;
  /** The door list at every width, not only on phones. */
  door?: boolean;
  /** One line for the header: the roster against the registration count. */
  rosterNote?: string | null;
  /** The office that runs the desk, mid-sentence ("alumni cell"). */
  officeName: string;
  /** After the event: the roster sits behind a disclosure. */
  collapsed?: boolean;
}) {
  const toast = useToast();

  /**
   * The event this desk belongs to, taken from the route rather than a
   * prop. `/admin/events/[id]` carries either an id or a slug, and
   * `POST /api/events/[slug]/checkin` resolves both — the API's dynamic
   * segment is named `slug` only because `/api/events/[slug]/register`
   * claimed the position first.
   */
  const routeParams = useParams();
  const rawKey = routeParams?.id;
  const eventKey = encodeURIComponent(Array.isArray(rawKey) ? (rawKey[0] ?? '') : (rawKey ?? ''));

  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');

  // Local overrides on top of what the roster arrived with.
  const [marked, setMarked] = React.useState<Record<string, boolean>>({});
  /** Only rows this desk actually recorded, so a corrected roster does not inflate the count. */
  const [, setDeskRecorded] = React.useState<Record<string, true>>({});
  const [busy, setBusy] = React.useState<Record<string, true>>({});
  /**
   * Applies to the whole event rather than one row — the desk not being
   * open yet, or the account not being allowed to work this one — so it
   * belongs above the list and not in a toast that vanishes.
   */
  const [notice, setNotice] = React.useState<string | null>(null);
  const [, setUnstored] = React.useState(false);

  const [undoing, setUndoing] = React.useState<CheckInRow | null>(null);
  const [undoReason, setUndoReason] = React.useState('');

  const isIn = React.useCallback((r: CheckInRow) => marked[r.id] ?? r.checkedIn, [marked]);

  const duplicateNames = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.memberName, (seen.get(r.memberName) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name));
  }, [rows]);

  const arrived = rows.filter(isIn).length;

  // The code on each member's pass, derived from the registration id the
  // same way the pass derives it, so a volunteer can type what they read.
  const codes = React.useMemo(
    () => new Map(rows.map((r) => [r.id, checkInCode(r.id).replace(/-/g, '')])),
    [rows],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const asCode = query.replace(/[\s-]/g, '').toUpperCase();
    const looksLikeCode = asCode.length >= 3 && (/-/.test(query) || /[2-9]/.test(asCode));
    // With nobody in, the filters are hidden, so none may still apply.
    const f: Filter = arrived > 0 ? filter : 'all';
    return rows.filter((r) => {
      if (f === 'waiting' && isIn(r)) return false;
      if (f === 'arrived' && !isIn(r)) return false;
      if (!q) return true;
      // Only a query shaped like a code (a dash or a digit in it) is read as
      // one, so "Ram" finds people called Ram and not a code with RAM in it.
      if (looksLikeCode && codes.get(r.id)?.includes(asCode)) return true;
      const hay = [r.memberName, r.rollNumber ?? '', String(r.batchYear ?? '')].join(' ').toLowerCase();
      return q.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [rows, query, filter, isIn, codes, arrived]);

  /** Puts one row back exactly as it was, override and all. */
  const restore = (id: string, previous: boolean | undefined) => {
    setMarked((cur) => {
      const next = { ...cur };
      if (previous === undefined) delete next[id];
      else next[id] = previous;
      return next;
    });
  };

  /** Resolves true when the desk actually recorded the change. */
  const send = async (r: CheckInRow, action: 'check_in' | 'undo', reason?: string): Promise<boolean> => {
    const previous = marked[r.id];
    const optimistic = action === 'check_in';

    // The row flips first. A desk with a queue behind it cannot wait for a
    // round trip, and every failure below puts this back.
    setMarked((cur) => ({ ...cur, [r.id]: optimistic }));
    setBusy((cur) => ({ ...cur, [r.id]: true }));
    setNotice(null);

    const result = await api.post<{ note: string }>(`/api/events/${eventKey}/checkin`, {
      registrationId: r.id,
      action,
      ...(reason ? { reason } : {}),
    });

    setBusy((cur) => {
      const next = { ...cur };
      delete next[r.id];
      return next;
    });

    const title =
      action === 'check_in' ? `${r.memberName} checked in` : `Check-in reversed for ${r.memberName}`;

    if (result.status === 'ok') {
      if (!result.persisted) setUnstored(true);

      setDeskRecorded((cur) => {
        const next = { ...cur };
        if (action === 'check_in') next[r.id] = true;
        else delete next[r.id];
        return next;
      });

      // A desk confirms out loud even though the row has already flipped:
      // whoever is scanning is looking at the person, not at the table.
      const t = outcomeToast(result, title);
      if (t) toast.show(t);
      else {
        toast.success(
          title,
          action === 'check_in' && r.guests
            ? `Plus ${r.guests} guest${r.guests === 1 ? '' : 's'} — ${1 + r.guests} seats accounted for.`
            : undefined,
        );
      }
      return true;
    }

    // Every refusal below is a rollback. Two of them are rollbacks to the
    // truth rather than to the previous value: the server knows something
    // this roster did not.
    if (result.status === 'conflict') {
      if (result.code === 'already_checked_in') {
        setMarked((cur) => ({ ...cur, [r.id]: true }));
        toast.error('Already checked in', result.message);
        return false;
      }
      if (result.code === 'not_checked_in') {
        setMarked((cur) => ({ ...cur, [r.id]: false }));
        toast.error('Not checked in', result.message);
        return false;
      }
      if (result.code === 'desk_not_open') {
        restore(r.id, previous);
        setNotice(result.message);
        return false;
      }
    }

    restore(r.id, previous);

    if (result.status === 'denied') setNotice(result.message);

    const t = outcomeToast(result, title);
    if (t) toast.show(t);
    return false;
  };

  const toggle = (r: CheckInRow) => {
    // Reversing is a different act from recording, and the endpoint will
    // not accept it without a written reason.
    if (isIn(r)) {
      setUndoReason('');
      setUndoing(r);
      return;
    }
    void send(r, 'check_in');
  };

  const reasonShort = undoReason.trim().length > 0 && undoReason.trim().length < REASON_MIN;
  const title = canCheckIn && !isPast ? 'Check-in desk' : 'Roster';
  const tally =
    arrived > 0
      ? `${arrived.toLocaleString('en-IN')} of ${rows.length.toLocaleString('en-IN')} arrived`
      : 'Nobody checked in';

  const meta = (r: CheckInRow) =>
    [
      r.batchYear ? `Batch ${r.batchYear}` : null,
      r.guests ? `+${r.guests} guest${r.guests === 1 ? '' : 's'}` : null,
      showRoll ? r.rollNumber : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const doorList = (
    <ul className="divide-y divide-line">
      {visible.map((r) => {
        const inNow = isIn(r);
        return (
          <li key={r.id} className="flex min-h-14 items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-primary">{r.memberName}</p>
              {meta(r) ? <p className="truncate text-sm text-secondary">{meta(r)}</p> : null}
              {duplicateNames.has(r.memberName) ? (
                <p className="flex items-center gap-1 text-xs text-warning-fg">
                  <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                  Same name as another registration
                </p>
              ) : null}
            </div>
            {canCheckIn ? (
              inNow ? (
                <span className="flex shrink-0 items-center gap-1 text-sm">
                  <span className="font-semibold text-success-fg">In</span>
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11 px-2"
                    loading={Boolean(busy[r.id])}
                    onClick={() => toggle(r)}
                    aria-label={`Undo check-in for ${r.memberName}`}
                  >
                    Undo
                  </Button>
                </span>
              ) : (
                <Button
                  className="h-12 shrink-0 px-5"
                  loading={Boolean(busy[r.id])}
                  onClick={() => toggle(r)}
                  aria-label={`Check in ${r.memberName}`}
                >
                  Check in
                </Button>
              )
            ) : (
              <StateBadge checkedIn={inNow} label={r.checkedInLabel} />
            )}
          </li>
        );
      })}
    </ul>
  );

  const table = (
    <TableWrap caption={`Registrations for ${eventTitle}`}>
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            {showRoll ? <TH>Roll number</TH> : null}
            <TH align="right">Batch</TH>
            <TH align="right">Guests</TH>
            <TH align="right">Paid</TH>
            <TH>Registered</TH>
            <TH>Check-in</TH>
          </TR>
        </THead>
        <TBody>
          {visible.map((r) => {
            const inNow = isIn(r);
            return (
              <TR key={r.id}>
                <TD>
                  <p className="font-medium">{r.memberName}</p>
                  {duplicateNames.has(r.memberName) ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-warning-fg">
                      <AlertTriangle className="size-3" aria-hidden="true" />
                      Same name as another registration
                    </p>
                  ) : null}
                </TD>
                {showRoll ? (
                  <TD>
                    <span className="font-mono text-xs">{r.rollNumber ?? '—'}</span>
                  </TD>
                ) : null}
                <TD numeric>{r.batchYear ?? '—'}</TD>
                <TD numeric>{r.guests || '—'}</TD>
                <TD numeric>{r.amountLabel}</TD>
                <TD>
                  <span className="text-xs text-secondary">{r.registeredOn}</span>
                </TD>
                <TD>
                  {canCheckIn ? (
                    inNow ? (
                      <span className="flex items-center gap-1 text-sm">
                        <span className="font-semibold text-success-fg">In</span>
                        <span aria-hidden="true" className="text-muted">
                          ·
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          loading={Boolean(busy[r.id])}
                          onClick={() => toggle(r)}
                          aria-label={`Undo check-in for ${r.memberName}`}
                        >
                          <Undo2 className="size-3.5" aria-hidden="true" />
                          Undo
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={Boolean(busy[r.id])}
                        onClick={() => toggle(r)}
                        aria-label={`Check in ${r.memberName}`}
                      >
                        <UserCheck className="size-4" aria-hidden="true" />
                        Check in
                      </Button>
                    )
                  ) : (
                    <StateBadge checkedIn={inNow} label={r.checkedInLabel} />
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );

  // Until somebody is in, "Waiting" is everybody and "In" is nobody: the
  // filters only earn their place once the desk has recorded an arrival.
  const filters: Array<[Filter, string, number]> =
    arrived > 0
      ? [
          ['all', 'All', rows.length],
          ['waiting', 'Waiting', rows.length - arrived],
          ['arrived', 'In', arrived],
        ]
      : [];

  const body = (
    <div className="space-y-4">
      {!canCheckIn ? (
        <p className="text-sm text-secondary">
          You can see this roster. The {officeName} checks people in.
        </p>
      ) : null}

      {notice ? (
        <Alert tone="warning" title="Nothing was recorded">
          <p>{notice}</p>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-secondary">Nobody has registered yet.</p>
      ) : (
        <>
          <div className="sticky top-14 z-10 -mx-card space-y-2 border-b border-line bg-surface-raised px-card pb-3 pt-2">
            <label htmlFor="checkin-search" className="sr-only">
              Find a registration
            </label>
            <Input
              id="checkin-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={showRoll ? 'Name, roll number, batch or pass code' : 'Name, batch or pass code'}
              leading={<Search className="size-4" />}
              autoComplete="off"
              className="h-12 text-base sm:h-control sm:text-sm"
            />
            {filters.length ? (
            <div role="group" aria-label="Show" className="flex gap-2">
              {filters.map(([value, label, n]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm sm:min-h-9',
                    'transition-colors duration-fast ease-brand',
                    filter === value
                      ? 'border-line-strong bg-brand-soft font-medium text-brand-soft-fg'
                      : 'border-line bg-surface-raised text-secondary hover:border-line-strong hover:text-primary',
                  )}
                >
                  {label}
                  <span className="text-xs font-semibold tabular">{n.toLocaleString('en-IN')}</span>
                </button>
              ))}
            </div>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 py-2 text-sm text-secondary">
              <p>
                {query
                  ? `Nobody on this roster matches “${query}”. Walk-ins are not on it.`
                  : filter === 'waiting'
                    ? 'Everybody on the roster has arrived.'
                    : 'Nobody has been checked in yet.'}
              </p>
              {query ? (
                <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Clear the search
                </Button>
              ) : null}
            </div>
          ) : door ? (
            doorList
          ) : (
            <>
              <div className="lg:hidden">{doorList}</div>
              <div className="hidden lg:block">{table}</div>
            </>
          )}
        </>
      )}
    </div>
  );

  const undoDialog = (
    <Dialog
      open={undoing !== null}
      onClose={() => setUndoing(null)}
      title="Undo this check-in"
      description={undoing ? `${undoing.memberName} is marked as arrived.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={() => setUndoing(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={undoReason.trim().length < REASON_MIN}
            loading={undoing ? Boolean(busy[undoing.id]) : false}
            onClick={() => {
              const row = undoing;
              if (!row) return;
              // The dialog closes on acceptance only. A refusal leaves the
              // reason where it was, because at a desk the next thing that
              // happens is trying again.
              void send(row, 'undo', undoReason.trim()).then((ok) => {
                if (ok) setUndoing(null);
              });
            }}
          >
            Undo the check-in
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-secondary">Both the check-in and this undo stay on the record.</p>
        <Field
          htmlFor="undo-reason"
          label="Why"
          required
          error={reasonShort ? 'A few more words. This is what the record will say.' : undefined}
        >
          <Textarea
            id="undo-reason"
            value={undoReason}
            onChange={(e) => setUndoReason(e.target.value)}
            rows={3}
            placeholder="e.g. Marked the wrong row"
            invalid={reasonShort}
            aria-describedby={describedBy('undo-reason', { error: reasonShort })}
          />
        </Field>
      </div>
    </Dialog>
  );

  if (collapsed) {
    return (
      <>
        <details className="group rounded-lg border border-line bg-surface-raised shadow-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-card marker:hidden">
            <h2 className="font-display text-lg font-semibold">Roster</h2>
            <span className="ml-auto text-sm text-secondary">{tally}</span>
            <svg
              viewBox="0 0 20 20"
              className="size-4 shrink-0 text-muted transition-transform duration-fast group-open:rotate-180"
              fill="none"
              aria-hidden="true"
            >
              <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="border-t border-line p-card">{body}</div>
        </details>
        {undoDialog}
      </>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-wrap items-center">
        <div className="min-w-0 space-y-0.5">
          <CardTitle as="h2">{title}</CardTitle>
          <CardDescription>
            {rosterNote ??
              `${rows.length.toLocaleString('en-IN')} registration${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </div>
        {rows.length > 0 ? (
          <p className="text-sm text-secondary" aria-live="polite">
            {arrived > 0 ? (
              <>
                <span className="font-display text-lg font-bold tabular text-primary">
                  {arrived.toLocaleString('en-IN')}
                </span>{' '}
                of <span className="tabular">{rows.length.toLocaleString('en-IN')}</span> arrived
              </>
            ) : (
              'Nobody checked in yet'
            )}
          </p>
        ) : null}
      </CardHeader>
      <CardBody>{body}</CardBody>
      {undoDialog}
    </Card>
  );
}

function StateBadge({ checkedIn, label }: { checkedIn: boolean; label: string | null }) {
  return checkedIn ? (
    <Badge tone="success" dot>
      {label ? `In · ${label}` : 'In'}
    </Badge>
  ) : (
    <Badge tone="neutral">Waiting</Badge>
  );
}

// ---------------------------------------------------------------
// Event actions menu
// ---------------------------------------------------------------

export type EventMenuItem =
  | { kind: 'link'; label: string; href: string; icon: 'roster' | 'member' | 'invite' | 'album' }
  | { kind: 'copy'; label: string; text: string };

const MENU_ICON = {
  roster: <ClipboardList className="size-4" />,
  member: <Eye className="size-4" />,
  invite: <Send className="size-4" />,
  album: <ImagePlus className="size-4" />,
} as const;

/**
 * A row's overflow menu. Built here rather than on the kit's Menu, whose
 * trigger is a `display: contents` button that browsers leave out of the
 * tab order. Arrow keys walk the items; Escape and Tab close it.
 */
export function EventActionsMenu({ label, items }: { label: string; items: EventMenuItem[] }) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [manual, setManual] = React.useState<string | null>(null);
  const wrap = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const focusItem = (at: 'first' | 'last') =>
    requestAnimationFrame(() => {
      const found = document.getElementById(menuId)?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (!found?.length) return;
      (at === 'first' ? found[0] : found[found.length - 1])?.focus();
    });

  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const found = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const at = found.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (at + 1) % found.length;
    else if (e.key === 'ArrowUp') next = (at - 1 + found.length) % found.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = found.length - 1;
    else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (next === null) return;
    e.preventDefault();
    found[next]?.focus();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied for WhatsApp');
    } catch {
      setManual(text);
    }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          const opening = !open;
          setOpen(opening);
          if (opening && e.detail === 0) focusItem('first');
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            focusItem(e.key === 'ArrowDown' ? 'first' : 'last');
          }
        }}
        className={cn(
          'grid size-11 place-items-center rounded text-secondary lg:size-9',
          'transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
          open && 'bg-surface-sunken text-primary',
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 z-30 mt-1 w-56 animate-slide-down rounded-lg border border-line bg-surface-raised p-1 shadow-lg"
        >
          {items.map((item) =>
            item.kind === 'copy' ? (
              <MenuItem
                key={item.label}
                icon={<Copy className="size-4" />}
                onSelect={() => {
                  setOpen(false);
                  void copy(item.text);
                }}
              >
                {item.label}
              </MenuItem>
            ) : (
              <MenuItem key={item.label} href={item.href} icon={MENU_ICON[item.icon]}>
                {item.label}
              </MenuItem>
            ),
          )}
        </div>
      ) : null}

      <Dialog
        open={manual !== null}
        onClose={() => setManual(null)}
        title="Copy the text"
        description="The clipboard was not available. Select the text and copy it."
      >
        <Textarea
          readOnly
          value={manual ?? ''}
          rows={4}
          aria-label="Text for WhatsApp"
          onFocus={(e) => e.currentTarget.select()}
        />
      </Dialog>
    </div>
  );
}
