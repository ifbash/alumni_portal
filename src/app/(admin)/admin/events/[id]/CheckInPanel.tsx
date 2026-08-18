'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Search, UserCheck, Undo2, Users, AlertTriangle } from 'lucide-react';

import {
  Alert,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Dialog,
  Field,
  describedBy,
  Input,
  Textarea,
  Button,
  Badge,
  EmptyState,
  Progress,
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  DefinitionCard,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * The check-in desk.
 *
 * One component covers both capability states rather than two near-identical
 * tables: without `event.checkin` the same roster renders without the
 * actions, and says so. A second read-only implementation is a second place
 * for the columns to drift.
 *
 * Marking is optimistic, because a queue at a door does not wait for a
 * round trip — the row flips first and the request follows. Every failure
 * puts it back, and the three the server raises are put back to the *right*
 * value rather than the previous one: "already checked in" means the person
 * is in, whatever this roster was showing.
 *
 * Reversing a check-in asks for a reason before it sends, because the
 * endpoint requires one. Attendance is the record a department quotes back
 * at an accreditation visit, and a row that flipped twice with nothing
 * beside it is the one nobody can explain.
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
}: {
  eventTitle: string;
  rows: CheckInRow[];
  canCheckIn: boolean;
  showRoll: boolean;
  isPast: boolean;
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

  // Local overrides on top of what the roster arrived with. Kept separate so
  // "recorded at this desk just now" stays distinguishable from "was already
  // marked attended", which is the difference that matters when two people
  // are working the same queue.
  const [marked, setMarked] = React.useState<Record<string, boolean>>({});
  /** Only rows this desk actually recorded, so a corrected roster does not inflate the count. */
  const [deskRecorded, setDeskRecorded] = React.useState<Record<string, true>>({});
  const [busy, setBusy] = React.useState<Record<string, true>>({});
  /**
   * Applies to the whole event rather than one row — the desk not being
   * open yet, or the account not being allowed to work this one — so it
   * belongs above the table and not in a toast that vanishes.
   */
  const [notice, setNotice] = React.useState<string | null>(null);
  /** Set once a response comes back that changed nothing, so the footer can say so honestly. */
  const [unstored, setUnstored] = React.useState(false);

  const [undoing, setUndoing] = React.useState<CheckInRow | null>(null);
  const [undoReason, setUndoReason] = React.useState('');

  const isIn = React.useCallback(
    (r: CheckInRow) => marked[r.id] ?? r.checkedIn,
    [marked],
  );

  const duplicateNames = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.memberName, (seen.get(r.memberName) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name));
  }, [rows]);

  const arrived = rows.filter(isIn).length;
  const recordedHere = Object.keys(deskRecorded).length;

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'waiting' && isIn(r)) return false;
      if (filter === 'arrived' && !isIn(r)) return false;
      if (!q) return true;
      const hay = [r.memberName, r.rollNumber ?? '', String(r.batchYear ?? '')].join(' ').toLowerCase();
      return q.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [rows, query, filter, isIn]);

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

  const title = canCheckIn ? 'Check-in desk' : 'Registration roster';

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0 space-y-1">
          <CardTitle as="h2">{title}</CardTitle>
          <CardDescription>
            {rows.length
              ? `${rows.length.toLocaleString('en-IN')} registration${rows.length === 1 ? '' : 's'} on file for ${eventTitle}.`
              : `Nobody has registered for ${eventTitle} yet.`}
          </CardDescription>
        </div>
        <Badge tone={arrived === rows.length && rows.length > 0 ? 'success' : 'neutral'} dot>
          {arrived} in
        </Badge>
      </CardHeader>

      <CardBody className="space-y-5">
        {!canCheckIn ? (
          <p className="rounded border border-line bg-surface-sunken p-3 text-sm text-secondary">
            You can read this roster but not mark attendance — that needs{' '}
            <code className="font-mono text-xs">event.checkin</code>, which the alumni cell and the college admin
            hold.
          </p>
        ) : null}

        {notice ? (
          <Alert tone="warning" title="Nothing was recorded">
            <p>{notice}</p>
          </Alert>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No registrations yet"
            description="Registrations appear here the moment a member signs up. Until the event is published, nobody can."
          />
        ) : (
          <>
            <div className="space-y-3">
              <Progress
                value={arrived}
                max={rows.length}
                tone={arrived === rows.length ? 'success' : 'brand'}
                label={`${arrived} of ${rows.length} registrations checked in`}
              />
              <p className="text-sm text-secondary">
                <span className="font-semibold tabular text-primary">{arrived}</span> of{' '}
                <span className="tabular">{rows.length}</span> arrived ·{' '}
                <span className="tabular">{rows.length - arrived}</span> still to come
                {recordedHere ? (
                  <> · <span className="tabular">{recordedHere}</span> recorded at this desk</>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Field
                htmlFor="checkin-search"
                label="Find a registration"
                hint={showRoll ? 'Name, roll number or batch year' : 'Name or batch year'}
                className="min-w-0 flex-1"
              >
                <Input
                  id="checkin-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={showRoll ? 'e.g. Sravani, 13KN1A0512 or 2017' : 'e.g. Sravani or 2017'}
                  leading={<Search className="size-4" />}
                  autoComplete="off"
                  aria-describedby={describedBy('checkin-search', { hint: true })}
                />
              </Field>

              <div
                className="inline-flex rounded-lg border border-line bg-surface-sunken p-0.5"
                role="group"
                aria-label="Filter the roster"
              >
                {(
                  [
                    ['all', `All ${rows.length}`],
                    ['waiting', `Waiting ${rows.length - arrived}`],
                    ['arrived', `In ${arrived}`],
                  ] as Array<[Filter, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={
                      filter === value
                        ? 'rounded bg-surface-raised px-3 py-1.5 text-sm font-medium text-primary shadow-sm'
                        : 'rounded px-3 py-1.5 text-sm font-medium text-secondary transition-colors duration-fast ease-brand hover:text-primary'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={<Search className="size-5" />}
                title="Nobody on this roster matches"
                description={
                  query
                    ? `No registration matches “${query}”. They may have registered under a different spelling, or not at all — walk-ins are not on this list.`
                    : filter === 'waiting'
                      ? 'Everybody on the roster has arrived.'
                      : 'Nobody has been checked in yet.'
                }
                action={
                  query ? (
                    <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                      Clear the search
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <TableWrap caption={`Registrations for ${eventTitle}`} className="hidden sm:block">
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
                      {visible.map((r) => (
                        <TR key={r.id} interactive>
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
                            <CheckInCell
                              row={r}
                              checkedIn={isIn(r)}
                              canCheckIn={canCheckIn}
                              pending={Boolean(busy[r.id])}
                              onToggle={toggle}
                            />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>

                <div className="space-y-3 sm:hidden">
                  {visible.map((r) => (
                    <DefinitionCard
                      key={r.id}
                      title={r.memberName}
                      subtitle={[showRoll ? r.rollNumber : null, r.batchYear ? `Batch of ${r.batchYear}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                      rows={[
                        { label: 'Guests', value: r.guests || '—' },
                        { label: 'Paid', value: r.amountLabel },
                        { label: 'Registered', value: r.registeredOn },
                        {
                          label: 'Check-in',
                          value: isIn(r) ? (
                            <Badge tone="success" dot>
                              In
                            </Badge>
                          ) : (
                            <Badge tone="neutral">Waiting</Badge>
                          ),
                        },
                      ]}
                      actions={
                        canCheckIn ? (
                          <Button
                            size="sm"
                            variant={isIn(r) ? 'ghost' : 'primary'}
                            loading={Boolean(busy[r.id])}
                            onClick={() => toggle(r)}
                          >
                            {isIn(r) ? (
                              <>
                                <Undo2 className="size-4" aria-hidden="true" />
                                Undo check-in
                              </>
                            ) : (
                              <>
                                <UserCheck className="size-4" aria-hidden="true" />
                                Check in
                              </>
                            )}
                          </Button>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </>
            )}

            <p className="border-t border-line pt-3 text-xs text-muted">
              {isPast
                ? 'This event has finished. Attendance recorded here still counts towards the turnout figures above.'
                : 'Check-in is one-way at the door and reversible here — a mistaken tap is undone from the same row, with a reason.'}{' '}
              {canCheckIn
                ? 'Each mark is sent to the server as it is made, and both the entry and any reversal stay in the audit log against your name.'
                : 'Attendance here is recorded by the alumni cell at the desk; what you are reading is the roster as it stands.'}
              {unstored
                ? ' Nothing on this desk has been stored: this build runs on seeded data with no database behind it, so the permission checks and the audit entries ran and the roster itself is unchanged.'
                : ''}
            </p>
          </>
        )}
      </CardBody>

      <Dialog
        open={undoing !== null}
        onClose={() => setUndoing(null)}
        title="Reverse this check-in"
        description={
          undoing ? `${undoing.memberName} is currently marked as arrived.` : undefined
        }
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
                // The dialog closes on acceptance only. A refusal leaves
                // the reason typed where it was, because at a desk the
                // next thing that happens is trying again.
                void send(row, 'undo', undoReason.trim()).then((ok) => {
                  if (ok) setUndoing(null);
                });
              }}
            >
              Reverse the check-in
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Alert tone="info" title="Both entries stay on the record">
            <p>
              The original check-in is not erased and this reversal is not hidden. Attendance is what a department
              quotes back at an accreditation visit, and a row that flipped twice with nothing beside it is the one
              nobody can explain three years later.
            </p>
          </Alert>

          <Field
            htmlFor="undo-reason"
            label="Why is it being reversed"
            required
            hint="Marked the wrong row, they left before the session, a duplicate at the desk. A few words is enough."
            error={
              undoReason.trim().length > 0 && undoReason.trim().length < REASON_MIN
                ? 'A few more words — this is what the entry will say.'
                : undefined
            }
          >
            <Textarea
              id="undo-reason"
              value={undoReason}
              onChange={(e) => setUndoReason(e.target.value)}
              rows={3}
              placeholder="Marked the wrong row — two registrations under the same name in the 2017 batch."
              invalid={undoReason.trim().length > 0 && undoReason.trim().length < REASON_MIN}
              aria-describedby={describedBy('undo-reason', {
                hint: true,
                error: undoReason.trim().length > 0 && undoReason.trim().length < REASON_MIN,
              })}
            />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}

function CheckInCell({
  row,
  checkedIn,
  canCheckIn,
  pending,
  onToggle,
}: {
  row: CheckInRow;
  checkedIn: boolean;
  canCheckIn: boolean;
  pending: boolean;
  onToggle: (r: CheckInRow) => void;
}) {
  if (!canCheckIn) {
    return checkedIn ? (
      <Badge tone="success" dot>
        {row.checkedInLabel ?? 'In'}
      </Badge>
    ) : (
      <Badge tone="neutral">Waiting</Badge>
    );
  }

  if (checkedIn) {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="success" dot>
          In
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          loading={pending}
          onClick={() => onToggle(row)}
          aria-label={`Undo check-in for ${row.memberName}`}
        >
          <Undo2 className="size-4" aria-hidden="true" />
          Undo
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" loading={pending} onClick={() => onToggle(row)} aria-label={`Check in ${row.memberName}`}>
      <UserCheck className="size-4" aria-hidden="true" />
      Check in
    </Button>
  );
}
