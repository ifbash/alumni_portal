'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, MoreHorizontal, UserPlus } from 'lucide-react';
import {
  Alert,
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Menu,
  MenuItem,
  Select,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Granting and revoking roles.
 *
 * The department question is the point of the grant form. Four roles hold
 * capabilities that are only meaningful inside a department, and a grant
 * that leaves `department_id` null quietly turns a head of CSE into a head
 * of everything. So the scope field has no default: the admin picks a
 * branch or explicitly picks the whole college, and the button stays dead
 * until they do. For an HOD the college-wide option is not offered at all.
 *
 * Both halves post to `/api/admin/roles`, which holds the same rules again
 * — a departmental role with no branch is refused there, and so is
 * revoking the last `college_admin`, and so is any grant or revoke of the
 * vendor's role. This screen hides those options; the endpoint is what
 * makes them true.
 */

const MIN_REASON = 15;

/** "Head of department" → "head of department", mid-sentence. */
const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);
const ALL_DEPARTMENTS = '*';

export interface RoleOption {
  value: string;
  label: string;
  /** Holds at least one capability that is scoped to a branch. */
  scoped: boolean;
  /** Every capability it holds is departmental — a null scope is meaningless. */
  mustHaveDepartment: boolean;
  /** What the role is for, in verbs. */
  bullets: string[];
}

export interface GrantRow {
  id: string;
  memberId: string;
  memberName: string;
  role: string;
  roleLabel: string;
  department: string | null;
  scoped: boolean;
}

export interface GrantGroup {
  role: string;
  label: string;
  grants: GrantRow[];
}

interface RoleResponse {
  auditedAs: string;
  note: string;
  warnings: string[];
}

// ---------------------------------------------------------------
// Grant
// ---------------------------------------------------------------

export function GrantRoleButton({
  roles,
  departments,
  members,
}: {
  roles: RoleOption[];
  departments: Array<{ value: string; label: string }>;
  /** Every member, as "roll · name · branch" — matched exactly on submit. */
  members: Array<{ id: string; label: string }>;
}) {
  const toast = useToast();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [person, setPerson] = React.useState('');
  const [role, setRole] = React.useState('');
  const [scope, setScope] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [granting, setGranting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const selected = roles.find((r) => r.value === role) ?? null;
  const matchedMember = members.find((m) => m.label.toLowerCase() === person.trim().toLowerCase()) ?? null;

  const personBad = !matchedMember;
  const roleBad = !selected;
  const scopeBad = Boolean(selected?.scoped) && !scope;
  const reasonBad = reason.trim().length < MIN_REASON;
  const blocked = personBad || roleBad || scopeBad || reasonBad;

  const reset = () => {
    setPerson('');
    setRole('');
    setScope('');
    setReason('');
    setTouched(false);
    setFieldErrors({});
  };

  const close = () => {
    if (granting) return;
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (blocked || granting) return;

    setGranting(true);
    setFieldErrors({});

    const outcome = await api.post<RoleResponse>('/api/admin/roles', {
      action: 'grant',
      memberId: matchedMember?.id,
      role,
      // The scope is always stated. `null` means the whole institution and
      // is a choice the admin made on screen, never an omission — the
      // endpoint refuses a body with the key missing.
      department: !selected?.scoped || scope === ALL_DEPARTMENTS ? null : scope,
      reason: reason.trim(),
    });

    setGranting(false);

    if (outcome.status === 'invalid') {
      // A 422 lands on the field that caused it. `memberId` is the person
      // box, `department` is the scope select.
      setFieldErrors(outcome.fieldErrors);
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    if (outcome.status !== 'ok') {
      const t = outcomeToast(outcome, '');
      if (t) toast.show(t);
      return;
    }

    const t = outcomeToast(
      outcome,
      `${selected?.label} given to ${matchedMember?.label.split(' · ').slice(-2)[0] ?? 'them'}`,
    );
    if (t) toast.show(t);
    for (const w of outcome.data.warnings) toast.info('Worth knowing', w);

    reset();
    setOpen(false);
    if (outcome.persisted) router.refresh();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden="true" />
        Give someone a role
      </Button>

      {open ? (
        <Dialog
          open
          onClose={close}
          title="Give someone a role"
          description="Roles add up: a person with two roles can do what both allow."
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={close} disabled={granting}>
                Cancel
              </Button>
              <Button type="submit" form="grant-form" disabled={blocked} loading={granting}>
                Give the role
              </Button>
            </>
          }
        >
          <form id="grant-form" onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
            <Field
              htmlFor="grant-person"
              label="Person"
              required
              hint="Start typing, then pick them from the list. They need a member record already."
              error={
                fieldErrors.memberId ??
                (touched && personBad ? 'Pick a member from the list. Free text will not find a record.' : null)
              }
            >
              <Input
                id="grant-person"
                list="grant-person-options"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                invalid={Boolean(fieldErrors.memberId) || (touched && personBad)}
                aria-describedby={describedBy('grant-person', {
                  hint: true,
                  error: Boolean(fieldErrors.memberId) || (touched && personBad),
                })}
                placeholder="Roll number or name"
                autoComplete="off"
              />
              <datalist id="grant-person-options">
                {members.map((m) => (
                  <option key={m.id} value={m.label} />
                ))}
              </datalist>
            </Field>

            <Field
              htmlFor="grant-role"
              label="Role"
              required
              error={fieldErrors.role ?? (touched && roleBad ? 'Choose the role to give.' : null)}
            >
              <Select
                id="grant-role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setScope('');
                  setFieldErrors({});
                }}
                invalid={Boolean(fieldErrors.role) || (touched && roleBad)}
                aria-describedby={describedBy('grant-role', {
                  error: Boolean(fieldErrors.role) || (touched && roleBad),
                })}
              >
                <option value="">Choose a role…</option>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>

            {selected ? (
              <ul className="space-y-1 rounded-lg border border-line bg-surface-sunken p-3 text-sm text-secondary">
                {selected.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}

            {selected?.scoped ? (
              <Field
                htmlFor="grant-scope"
                label="Branch"
                required
                hint={
                  selected.mustHaveDepartment
                    ? 'This role covers one branch.'
                    : 'Choose one branch, or the whole college.'
                }
                error={
                  fieldErrors.department ??
                  (touched && scopeBad ? 'Choose a branch, or choose the whole college.' : null)
                }
              >
                <Select
                  id="grant-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  invalid={Boolean(fieldErrors.department) || (touched && scopeBad)}
                  aria-describedby={describedBy('grant-scope', {
                    hint: true,
                    error: Boolean(fieldErrors.department) || (touched && scopeBad),
                  })}
                >
                  <option value="">Choose…</option>
                  {!selected.mustHaveDepartment ? (
                    <option value={ALL_DEPARTMENTS}>Whole college — every branch</option>
                  ) : null}
                  {departments.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : selected ? (
              <p className="text-sm text-secondary">Applies across the whole college.</p>
            ) : null}

            <Field
              htmlFor="grant-reason"
              label="Reason"
              required
              hint="Who asked for this, and on what authority."
              error={fieldErrors.reason ?? (touched && reasonBad ? `Write at least ${MIN_REASON} characters.` : null)}
            >
              <Textarea
                id="grant-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                invalid={Boolean(fieldErrors.reason) || (touched && reasonBad)}
                aria-describedby={describedBy('grant-reason', {
                  hint: true,
                  error: Boolean(fieldErrors.reason) || (touched && reasonBad),
                })}
                placeholder="Appointed head of department from 1 July, by office order."
                rows={2}
              />
            </Field>

            <p className="text-xs text-secondary">
              Recorded in the audit log with your name and this reason. It takes effect on their next page load.
            </p>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------
// Grants in force
// ---------------------------------------------------------------

export function GrantList({
  groups,
  vendor,
}: {
  groups: GrantGroup[];
  /** The platform provider's grant: shown, read-only, never revocable here. */
  vendor: { label: string; line: string } | null;
}) {
  const toast = useToast();
  const router = useRouter();

  const [revoking, setRevoking] = React.useState<GrantRow | null>(null);
  const [revokeReason, setRevokeReason] = React.useState('');
  /** On the reason field: the reason itself is what is wrong. */
  const [revokeError, setRevokeError] = React.useState<string | null>(null);
  /** In the dialog body: the server refused the revoke itself. */
  const [revokeRefusal, setRevokeRefusal] = React.useState<string | null>(null);
  const [revokePending, setRevokePending] = React.useState(false);

  const closeRevoke = () => {
    if (revokePending) return;
    setRevoking(null);
    setRevokeReason('');
    setRevokeError(null);
    setRevokeRefusal(null);
  };

  const revoke = async () => {
    if (!revoking || revokePending) return;

    if (revokeReason.trim().length < MIN_REASON) {
      setRevokeError(`Write at least ${MIN_REASON} characters. It is kept word for word in the audit log.`);
      return;
    }

    setRevokePending(true);
    setRevokeError(null);
    setRevokeRefusal(null);

    const outcome = await api.post<RoleResponse>('/api/admin/roles', {
      action: 'revoke',
      memberId: revoking.memberId,
      role: revoking.role,
      department: revoking.department,
      reason: revokeReason.trim(),
    });

    setRevokePending(false);

    if (outcome.status !== 'ok') {
      // A refusal here is usually the last-college-admin guard, and it is
      // the whole reason the endpoint exists. Keep the dialog open with
      // the server's sentence in it rather than flashing a toast past
      // somebody who is mid-way through a mistake.
      const onReason = outcome.status === 'invalid' ? (outcome.fieldErrors.reason ?? null) : null;
      if (onReason) setRevokeError(onReason);
      else setRevokeRefusal(outcome.message);
      return;
    }

    const t = outcomeToast(outcome, `${revoking.roleLabel} removed from ${revoking.memberName}`);
    if (t) toast.show(t);
    for (const w of outcome.data.warnings) toast.info('Worth knowing', w);

    setRevoking(null);
    setRevokeReason('');
    setRevokeRefusal(null);
    if (outcome.persisted) router.refresh();
  };

  return (
    <div className="grid grid-cols-1 items-start gap-gutter md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <section
          key={g.role}
          aria-labelledby={`grants-${g.role}`}
          className="min-w-0 rounded-lg border border-line bg-surface-raised shadow-sm"
        >
          <h3
            id={`grants-${g.role}`}
            className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold"
          >
            {g.label}
            <span className="text-xs font-normal text-secondary tabular">{g.grants.length}</span>
          </h3>
          <ul className="divide-y divide-line">
            {g.grants.map((grant) => (
              <li key={grant.id} className="flex items-center gap-3 px-4 py-2">
                <Avatar name={grant.memberName} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/members/${grant.memberId}`} className="block truncate text-sm font-medium link-quiet">
                    {grant.memberName}
                  </Link>
                  <span className="block text-xs text-secondary">
                    {grant.department ? `${grant.department} only` : 'Whole college'}
                  </span>
                </div>
                <Menu
                  label={`Actions for ${grant.memberName}`}
                  trigger={() => (
                    <span className="grid size-11 place-items-center rounded text-secondary transition-colors duration-fast ease-brand hover:bg-surface-sunken hover:text-primary lg:size-8">
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </span>
                  )}
                >
                  <MenuItem
                    tone="danger"
                    onSelect={() => {
                      setRevoking(grant);
                      setRevokeReason('');
                      setRevokeError(null);
                    }}
                  >
                    Remove the {lower(grant.roleLabel)} role
                  </MenuItem>
                </Menu>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {vendor ? (
        <section
          aria-labelledby="grants-vendor"
          className="min-w-0 rounded-lg border border-line bg-surface shadow-sm md:col-span-2 xl:col-span-3"
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary" aria-hidden="true">
              <Lock className="size-4" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <h3 id="grants-vendor" className="text-sm font-semibold">
                {vendor.label}
              </h3>
              <p className="text-sm text-secondary">{vendor.line}</p>
              <p className="text-xs text-secondary">Set up by the provider. It cannot be given or removed here.</p>
            </div>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={closeRevoke}
        onConfirm={() => void revoke()}
        pending={revokePending}
        title="Remove this role"
        confirmLabel="Remove role"
        requireTyped="REVOKE"
        body={
          <div className="space-y-3">
            <p>
              {revoking?.memberName} loses the {revoking ? lower(revoking.roleLabel) : ''} role
              {revoking?.department ? ` for ${revoking.department}` : ''} from their next page load. Their member account,
              connections and place in the directory stay as they are.
            </p>

            {revokeRefusal ? (
              <Alert tone="danger" title="The server refused this">
                <p>{revokeRefusal}</p>
              </Alert>
            ) : null}

            <Field
              htmlFor="revoke-reason"
              label="Reason"
              required
              hint="Who asked for this, and on what authority."
              error={revokeError}
            >
              <Textarea
                id="revoke-reason"
                value={revokeReason}
                onChange={(e) => {
                  setRevokeReason(e.target.value);
                  setRevokeError(null);
                }}
                invalid={Boolean(revokeError)}
                aria-describedby={describedBy('revoke-reason', { hint: true, error: Boolean(revokeError) })}
                placeholder="Left the college at the end of July; handover completed."
                rows={2}
              />
            </Field>

            <p className="text-xs">Recorded in the audit log with every role they hold, before and after.</p>
          </div>
        }
      />
    </div>
  );
}
