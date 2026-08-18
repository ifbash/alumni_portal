'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GitMerge, Pencil, RefreshCw, ShieldCheck, UserCog } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast, type ApiOutcome } from '@/lib/client/api';

/**
 * Staff actions on one member record.
 *
 * Four things staff genuinely need to do, and nothing else. Each one is a
 * `PATCH /api/admin/members/[id]` carrying the reason typed here, and each
 * writes an `audit_log` row with the actor and a whole before/after
 * snapshot — so each panel says so before the button goes live, rather
 * than burying it in a policy document nobody reads.
 *
 * The reason field is not optional on any of them. A status change with no
 * reason is indistinguishable from a mistake six months later, and the two
 * statuses a person cannot argue their way back from inside the product —
 * `deceased` and `rejected` — ask for more of one. The server holds the
 * same floors; a refusal from it lands on the field that caused it.
 *
 * One `<Dialog>` serves all four panels rather than four mounted at once:
 * the kit's dialog labels itself with a fixed id, and four of them on a
 * page is four elements sharing it.
 */

const MIN_REASON = 15;
/** Statuses that remove a person from the network. The server agrees. */
const GRAVE_REASON = 25;
const GRAVE_STATUSES = new Set(['deceased', 'rejected']);

type Panel = 'edit' | 'verify' | 'merge' | 'status';

interface Option {
  value: string;
  label: string;
}

const PANEL_META: Record<Panel, { title: string; action: string; confirm: string }> = {
  edit: { title: 'Edit member record', action: 'profile.update', confirm: 'Save correction' },
  verify: { title: 'Re-run verification', action: 'member.verify', confirm: 'Re-run matcher' },
  merge: { title: 'Merge a duplicate record', action: 'member.merge', confirm: 'Merge records' },
  status: { title: 'Change status', action: 'member.status', confirm: 'Change status' },
};

/** The endpoint's action name for each panel. */
const PANEL_ACTION: Record<Panel, 'update' | 'verify' | 'merge' | 'status'> = {
  edit: 'update',
  verify: 'verify',
  merge: 'merge',
  status: 'status',
};

interface PatchResponse {
  auditedAs: string;
  note: string;
  match?: { decision: string; candidates: Array<{ rollNumber: string }> };
}

export function MemberActions({
  memberName,
  rollNumber,
  status,
  statusOptions,
  departments,
  duplicates,
  profile,
  canWrite,
  canMerge,
  canVerify,
}: {
  memberName: string;
  rollNumber: string | null;
  status: string;
  statusOptions: Option[];
  departments: Option[];
  /** Same-name or same-roll records already in the tenant. */
  duplicates: Option[];
  profile: {
    preferredName: string;
    departmentCode: string;
    batchYear: string;
    currentCompany: string;
    city: string;
  };
  canWrite: boolean;
  canMerge: boolean;
  canVerify: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  // The record this screen is already scoped to. The endpoint resolves
  // either the id or the slug, which is exactly what sits in the URL.
  const params = useParams<{ id: string }>();
  const memberRef = params?.id ?? '';

  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [reason, setReason] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [target, setTarget] = React.useState('');
  const [typed, setTyped] = React.useState('');
  const [nextStatus, setNextStatus] = React.useState(status);
  const [form, setForm] = React.useState(profile);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<{
    action: string;
    note: string;
    persisted: boolean;
  } | null>(null);

  const open = (p: Panel) => {
    setPanel(p);
    setReason('');
    setTouched(false);
    setTarget('');
    setTyped('');
    setNextStatus(status);
    setForm(profile);
    setFieldErrors({});
  };
  const close = () => {
    if (submitting) return;
    setPanel(null);
  };

  const reasonFloor = panel === 'status' && GRAVE_STATUSES.has(nextStatus) ? GRAVE_REASON : MIN_REASON;

  const reasonBad = reason.trim().length < reasonFloor;
  const targetBad = !target;
  const typedBad = typed.trim() !== 'MERGE';
  const statusBad = nextStatus === status;
  const batchBad = form.batchYear.trim() !== '' && !/^\d{4}$/.test(form.batchYear.trim());

  const blocked =
    panel === 'merge'
      ? reasonBad || targetBad || typedBad
      : panel === 'status'
        ? reasonBad || statusBad
        : panel === 'edit'
          ? reasonBad || batchBad
          : reasonBad;

  const currentLabel = statusOptions.find((s) => s.value === status)?.label ?? status;
  const nextLabel = statusOptions.find((s) => s.value === nextStatus)?.label ?? nextStatus;

  /** Server field errors arrive keyed either bare or under `profile.`. */
  const errFor = (key: string) => fieldErrors[key] ?? fieldErrors[`profile.${key}`] ?? null;

  const confirm = async () => {
    setTouched(true);
    if (!panel || blocked || submitting) return;

    const action = PANEL_ACTION[panel];

    const body =
      action === 'update'
        ? {
            action,
            reason: reason.trim(),
            profile: {
              preferredName: form.preferredName.trim() || null,
              departmentCode: form.departmentCode || null,
              batchYear: form.batchYear.trim() ? Number(form.batchYear.trim()) : null,
              currentCompany: form.currentCompany.trim() || null,
              city: form.city.trim() || null,
            },
          }
        : action === 'status'
          ? { action, reason: reason.trim(), status: nextStatus }
          : action === 'merge'
            ? { action, reason: reason.trim(), mergeMemberId: target, confirm: typed.trim() }
            : { action, reason: reason.trim() };

    setSubmitting(true);
    setFieldErrors({});

    const outcome: ApiOutcome<PatchResponse> = await api.patch<PatchResponse>(
      `/api/admin/members/${encodeURIComponent(memberRef)}`,
      body,
    );

    setSubmitting(false);

    if (outcome.status === 'invalid') {
      // A 422 belongs on the field that caused it, not only in a toast.
      setFieldErrors(outcome.fieldErrors);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      // Nothing on this form matched the refusal, so the dialog would sit
      // there with no explanation. Say it once and close.
      if (Object.keys(outcome.fieldErrors).length === 0) setPanel(null);
      return;
    }

    if (outcome.status !== 'ok') {
      setPanel(null);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    setResult({
      action: outcome.data.auditedAs,
      note: outcome.data.note,
      persisted: outcome.persisted,
    });
    setPanel(null);

    const done: Record<Panel, string> = {
      edit: `${memberName}'s record corrected`,
      verify: `Matcher re-run for ${memberName}`,
      merge: `Duplicate folded into ${memberName}`,
      status: `${memberName}: ${currentLabel} → ${nextLabel}`,
    };

    const t = outcomeToast(outcome, done[panel]);
    if (t) toast.show(t);

    // Only when the server actually stored something. Refreshing after a
    // fixture write would re-render the same record and read as a failure.
    if (outcome.persisted) router.refresh();
  };

  const meta = panel ? PANEL_META[panel] : null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button variant="secondary" size="sm" onClick={() => open('edit')}>
              <Pencil className="size-4" />
              Edit record
            </Button>
          ) : null}
          {canVerify ? (
            <Button variant="secondary" size="sm" onClick={() => open('verify')}>
              <RefreshCw className="size-4" />
              Re-run verification
            </Button>
          ) : null}
          {canMerge ? (
            <Button variant="secondary" size="sm" onClick={() => open('merge')}>
              <GitMerge className="size-4" />
              Merge duplicate
            </Button>
          ) : null}
          {canWrite ? (
            <Button variant="secondary" size="sm" onClick={() => open('status')}>
              <UserCog className="size-4" />
              Change status
            </Button>
          ) : null}
        </div>

        {result ? (
          <Alert
            tone={result.persisted ? 'success' : 'info'}
            title={result.action}
            icon={<ShieldCheck className="size-4" />}
          >
            <p>{result.note}</p>
            {!result.persisted ? (
              <p className="mt-2 text-xs">
                This build runs on seeded data with no database behind it. The capability check, the validation and the
                audit entry all ran against your account; the write did not, so the record above is unchanged.
              </p>
            ) : null}
          </Alert>
        ) : null}
      </div>

      {/*
        The kit's `Dialog` keeps its `<dialog>` element mounted and closed
        rather than unmounting it, so this footer is in the document even
        with no panel open — and with `meta` null, the confirm button
        rendered with no text at all and the title with none either. A
        closed dialog is still in the accessibility tree: that was a
        nameless button and an empty `aria-labelledby` target on every
        member record. The fallbacks are never seen with a panel open,
        because `meta` is non-null exactly then.
      */}
      <Dialog
        open={panel !== null}
        onClose={close}
        title={meta?.title ?? 'Member actions'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={panel === 'merge' ? 'danger' : 'primary'}
              onClick={() => void confirm()}
              disabled={blocked}
              loading={submitting}
            >
              {panel === 'status' ? `Change to ${nextLabel}` : (meta?.confirm ?? 'Confirm')}
            </Button>
          </>
        }
      >
        {panel ? (
        <div className="space-y-5">
          {panel === 'edit' ? (
            <>
              <Alert tone="warning">
                <p>
                  Name and roll number are not editable here. Both come from the degree register, and
                  changing them in the portal breaks the match that verified this person. Corrections
                  to either go through the examinations branch first.
                </p>
              </Alert>

              <Field
                htmlFor="edit-preferred"
                label="Preferred name"
                hint="What the person is actually called. Shown in the directory in place of the register spelling."
                error={errFor('preferredName')}
              >
                <Input
                  id="edit-preferred"
                  value={form.preferredName}
                  onChange={(e) => setForm((f) => ({ ...f, preferredName: e.target.value }))}
                  invalid={Boolean(errFor('preferredName'))}
                  placeholder="Not set"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="edit-branch" label="Branch" error={errFor('departmentCode')}>
                  <Select
                    id="edit-branch"
                    value={form.departmentCode}
                    onChange={(e) => setForm((f) => ({ ...f, departmentCode: e.target.value }))}
                    invalid={Boolean(errFor('departmentCode'))}
                  >
                    <option value="">Not recorded</option>
                    {departments.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  htmlFor="edit-batch"
                  label="Year of passing"
                  error={
                    errFor('batchYear') ??
                    (touched && batchBad ? 'Four digits, or leave it blank.' : null)
                  }
                >
                  <Input
                    id="edit-batch"
                    type="number"
                    inputMode="numeric"
                    value={form.batchYear}
                    onChange={(e) => setForm((f) => ({ ...f, batchYear: e.target.value }))}
                    invalid={Boolean(errFor('batchYear')) || (touched && batchBad)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="edit-company" label="Current employer" error={errFor('currentCompany')}>
                  <Input
                    id="edit-company"
                    value={form.currentCompany}
                    onChange={(e) => setForm((f) => ({ ...f, currentCompany: e.target.value }))}
                    invalid={Boolean(errFor('currentCompany'))}
                    placeholder="Not on record"
                  />
                </Field>
                <Field htmlFor="edit-city" label="City" error={errFor('city')}>
                  <Input
                    id="edit-city"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    invalid={Boolean(errFor('city'))}
                    placeholder="Not on record"
                  />
                </Field>
              </div>
            </>
          ) : null}

          {panel === 'verify' ? (
            <>
              <p className="text-sm text-secondary">
                Puts the record back through the degree-register matcher. It compares{' '}
                {rollNumber ? <span className="font-mono">{rollNumber}</span> : 'this record'} and the
                name on the account against every row in the register, and reports what it found
                rather than deciding silently. Nothing about this member&rsquo;s access changes until
                the result is approved in the verification queue.
              </p>

              <Alert tone="info">
                <p>
                  Worth re-running after a register import. Anyone who registered before their batch
                  file arrived was approved manually, with no register row attached as evidence.
                </p>
              </Alert>
            </>
          ) : null}

          {panel === 'merge' ? (
            <>
              <Alert tone="danger" title="This cannot be undone from the portal">
                <p>
                  The duplicate&rsquo;s login stops working immediately and reversing the merge needs
                  a database restore. Check the roll numbers on both records first — two people in the
                  same branch and year genuinely can share a name, and the server refuses a merge
                  where the two roll numbers disagree.
                </p>
              </Alert>

              {duplicates.length === 0 ? (
                <p className="text-sm text-secondary">
                  No other record in this tenant carries the same name or roll number. If you know the
                  duplicate, open the record you intend to <em>keep</em> and start the merge from
                  there.
                </p>
              ) : (
                <Field
                  htmlFor="merge-target"
                  label="Record to fold in"
                  required
                  hint={`Matches ${memberName} on name or roll number. The record you pick here is the one that disappears.`}
                  error={errFor('mergeMemberId') ?? (touched && targetBad ? 'Choose the record to be merged away.' : null)}
                >
                  <Select
                    id="merge-target"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    invalid={Boolean(errFor('mergeMemberId')) || (touched && targetBad)}
                    aria-describedby={describedBy('merge-target', {
                      hint: true,
                      error: Boolean(errFor('mergeMemberId')) || (touched && targetBad),
                    })}
                  >
                    <option value="">Select a record…</option>
                    {duplicates.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field
                htmlFor="merge-confirm"
                label="Type MERGE to continue"
                required
                error={errFor('confirm') ?? (touched && typedBad ? 'Type MERGE exactly.' : null)}
              >
                <Input
                  id="merge-confirm"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  className="font-mono"
                  invalid={Boolean(errFor('confirm')) || (touched && typedBad)}
                />
              </Field>
            </>
          ) : null}

          {panel === 'status' ? (
            <>
              <Alert tone="warning">
                <p>
                  Status controls what the person can reach. Moving someone to{' '}
                  <strong>Final year</strong> takes away contact visibility and the giving module;
                  moving them to <strong>Alumni</strong> opens both. For a whole graduating batch use
                  the annual rollover, which previews every row before it commits.
                </p>
              </Alert>

              <Field
                htmlFor="status-next"
                label="New status"
                required
                hint={`Currently ${currentLabel.toLowerCase()}.`}
                error={errFor('status') ?? (touched && statusBad ? 'Pick a status different from the current one.' : null)}
              >
                <Select
                  id="status-next"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  invalid={Boolean(errFor('status')) || (touched && statusBad)}
                  aria-describedby={describedBy('status-next', {
                    hint: true,
                    error: Boolean(errFor('status')) || (touched && statusBad),
                  })}
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                      {s.value === status ? ' (current)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : null}

          <Field
            htmlFor="action-reason"
            label="Reason"
            required
            hint={
              reasonFloor === GRAVE_REASON
                ? 'Say who confirmed this and how. Neither of these two statuses can be argued back from inside the product, and the family or the applicant will ask.'
                : 'Stored verbatim in the audit log beside the before and after snapshots.'
            }
            error={
              errFor('reason') ?? (touched && reasonBad ? `Write at least ${reasonFloor} characters.` : null)
            }
          >
            <Textarea
              id="action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              invalid={Boolean(errFor('reason')) || (touched && reasonBad)}
              aria-describedby={describedBy('action-reason', {
                hint: true,
                error: Boolean(errFor('reason')) || (touched && reasonBad),
              })}
              placeholder={
                panel === 'merge'
                  ? 'Duplicate from the Hoopstr import — same roll number, personal email on one record and college email on the other.'
                  : panel === 'verify'
                    ? '2015 batch file loaded on 14 Aug; this account was approved manually before it arrived.'
                    : panel === 'status'
                      ? 'Confirmed with the department — did not graduate with this batch, moved to 2027.'
                      : 'Member emailed the alumni cell — employer changed in June and the profile was not updated.'
              }
              rows={2}
            />
          </Field>

          <Alert tone="neutral" icon={<ShieldCheck className="size-4" />}>
            <p>
              Writes <span className="font-mono">{meta?.action}</span> to the audit log with your
              name, this reason and a whole before/after snapshot of the record — not a diff, because
              reconstructing state from a diff chain during an incident is exactly when you cannot
              afford the extra step. Audit rows are append-only.
            </p>
          </Alert>
        </div>
        ) : null}
      </Dialog>
    </>
  );
}
