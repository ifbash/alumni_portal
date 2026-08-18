'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, TriangleAlert, UserPlus } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Field,
  FormActions,
  Input,
  Select,
  Table,
  TableWrap,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';

/**
 * Granting and revoking roles.
 *
 * The department question is the point of this component. Four roles hold
 * capabilities that are only meaningful inside a department, and a grant
 * that leaves `department_id` null quietly turns a head of CSE into a head
 * of everything. So the scope field has no default: the admin picks a
 * branch or explicitly picks the whole institution, and the button stays
 * dead until they do. For an HOD the institution-wide option is not
 * offered at all, because an HOD of nothing in particular is not a thing.
 *
 * Both halves post to `/api/admin/roles`, which holds the same two rules
 * again — a departmental role with no branch is refused there, and so is
 * revoking the last `college_admin`. Neither of those can be enforced from
 * a screen: this one hides the option, and the endpoint is what makes it
 * true.
 */

const MIN_REASON = 15;
const ALL_DEPARTMENTS = '*';

export interface RoleOption {
  value: string;
  label: string;
  /** Holds at least one capability listed in DEPARTMENT_SCOPED. */
  scoped: boolean;
  /** Every capability it holds is departmental — a null scope is meaningless. */
  mustHaveDepartment: boolean;
  capabilityCount: number;
  scopedCapabilities: string[];
  summary: string;
}

export interface GrantRow {
  id: string;
  memberId: string;
  memberName: string;
  memberRoll: string | null;
  role: string;
  roleLabel: string;
  department: string | null;
  scoped: boolean;
}

interface RoleResponse {
  auditedAs: string;
  note: string;
  warnings: string[];
}

export function RoleEditor({
  roles,
  departments,
  members,
  grants,
}: {
  roles: RoleOption[];
  departments: Array<{ value: string; label: string }>;
  /** Every member, as "roll · name · branch" — matched exactly on submit. */
  members: Array<{ id: string; label: string }>;
  grants: GrantRow[];
}) {
  const toast = useToast();
  const router = useRouter();

  const [person, setPerson] = React.useState('');
  const [role, setRole] = React.useState('');
  const [scope, setScope] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [granting, setGranting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [revoking, setRevoking] = React.useState<GrantRow | null>(null);
  const [revokeReason, setRevokeReason] = React.useState('');
  /** On the reason field: the reason itself is what is wrong. */
  const [revokeError, setRevokeError] = React.useState<string | null>(null);
  /** In the dialog body: the server refused the revoke itself. */
  const [revokeRefusal, setRevokeRefusal] = React.useState<string | null>(null);
  const [revokePending, setRevokePending] = React.useState(false);

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
      `${selected?.label} granted to ${matchedMember?.label.split(' · ').slice(-1)[0]}`,
    );
    if (t) toast.show(t);
    for (const w of outcome.data.warnings) toast.info('Worth knowing', w);

    reset();
    if (outcome.persisted) router.refresh();
  };

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
      setRevokeError(`Write at least ${MIN_REASON} characters. It is stored verbatim against the audit entry.`);
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle as="h2">Grant a role</CardTitle>
          <CardDescription>
            Grants are additive — a person holding several roles gets the union of their capabilities.
          </CardDescription>
        </CardHeader>
        <CardBody className="pt-4">
          <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
            <Field
              htmlFor="grant-person"
              label="Person"
              required
              hint="Start typing a roll number or a name. The record has to already exist — roles are granted to members, not to email addresses."
              error={
                fieldErrors.memberId ??
                (touched && personBad ? 'Pick a member from the list. Free text will not resolve to a record.' : null)
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
                placeholder="19JN1A0512 · Vamsi Krishna Pothineni · CSE"
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
              error={fieldErrors.role ?? (touched && roleBad ? 'Choose the role being granted.' : null)}
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
                    {r.label} — {r.capabilityCount} capabilit{r.capabilityCount === 1 ? 'y' : 'ies'}
                  </option>
                ))}
              </Select>
            </Field>

            {selected ? (
              <div className="rounded-lg border border-line bg-surface-sunken p-4 text-sm">
                <p className="font-medium">{selected.label}</p>
                <p className="mt-1 text-secondary">{selected.summary}</p>
              </div>
            ) : null}

            {selected?.scoped ? (
              <Field
                htmlFor="grant-scope"
                label="Department scope"
                required
                hint={
                  selected.mustHaveDepartment
                    ? 'This role is departmental in every capability it holds. It cannot be granted across the institution.'
                    : `Scoped capabilities: ${selected.scopedCapabilities.join(', ')}. A grant with no department applies to every branch.`
                }
                error={
                  fieldErrors.department ??
                  (touched && scopeBad
                    ? 'Choose a branch, or state explicitly that this applies to the whole institution.'
                    : null)
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
                  <option value="">Choose a scope…</option>
                  {!selected.mustHaveDepartment ? (
                    <option value={ALL_DEPARTMENTS}>Whole institution — every branch</option>
                  ) : null}
                  {departments.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : selected ? (
              <Alert tone="neutral" icon={<ShieldCheck className="size-4" />}>
                <p>
                  {selected.label} holds no department-scoped capability, so there is no branch to
                  attach. The grant applies across the institution.
                </p>
              </Alert>
            ) : null}

            <Field
              htmlFor="grant-reason"
              label="Reason"
              required
              hint="Who asked for this and on what authority. Stored verbatim against the audit entry."
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
                placeholder="Appointed HOD of CSE with effect from 1 July — office order 2026/AC/114."
                rows={2}
              />
            </Field>

            <Alert tone="neutral" icon={<ShieldCheck className="size-4" />}>
              <p>
                Writes <span className="font-mono">role.grant</span> to the audit log with the actor,
                the target member, the role, the department scope and this reason. Roles are resolved
                from storage on every request, so the grant takes effect on the member&rsquo;s next
                page load — not whenever their session happens to expire.
              </p>
            </Alert>

            <FormActions>
              <Button type="button" variant="ghost" onClick={reset} disabled={granting}>
                Reset
              </Button>
              <Button type="submit" disabled={blocked} loading={granting}>
                <UserPlus className="size-4" />
                Grant role
              </Button>
            </FormActions>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle as="h2">Current grants</CardTitle>
          <CardDescription>
            Everyone holding something above alumni or student. {grants.length} grant
            {grants.length === 1 ? '' : 's'} in force.
          </CardDescription>
        </CardHeader>
        <CardBody className="pt-4">
          <TableWrap caption="Role grants currently in force">
            <Table>
              <THead>
                <TR>
                  <TH>Person</TH>
                  <TH>Role</TH>
                  <TH>Scope</TH>
                  <TH align="right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {grants.map((g) => (
                  <TR key={g.id} interactive>
                    <TD>
                      <Link href={`/admin/members/${g.memberId}`} className="font-medium link-quiet">
                        {g.memberName}
                      </Link>
                      {g.memberRoll ? (
                        <span className="block font-mono text-xs text-secondary">{g.memberRoll}</span>
                      ) : null}
                    </TD>
                    <TD>{g.roleLabel}</TD>
                    <TD>
                      {g.department ? (
                        <Badge tone="brand">{g.department} only</Badge>
                      ) : g.scoped ? (
                        <Badge tone="warning">Whole institution</Badge>
                      ) : (
                        <span className="text-secondary">Not departmental</span>
                      )}
                    </TD>
                    <TD align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRevoking(g);
                          setRevokeReason('');
                          setRevokeError(null);
                        }}
                      >
                        Revoke
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={closeRevoke}
        onConfirm={() => void revoke()}
        pending={revokePending}
        title="Revoke this role"
        confirmLabel="Revoke role"
        requireTyped="REVOKE"
        body={
          <div className="space-y-3">
            <p>
              {revoking?.roleLabel} will be removed from {revoking?.memberName}
              {revoking?.department ? ` (${revoking.department})` : ''}. Anything only that role
              granted stops working on their next page load.
            </p>
            <Alert tone="warning" icon={<TriangleAlert className="size-4" />}>
              <p>
                Their member account is untouched — they keep their profile, their connections and
                their place in the directory. Revoking a role is not the same as removing a person.
              </p>
            </Alert>

            {revokeRefusal ? (
              <Alert tone="danger" title="The server refused this" icon={<TriangleAlert className="size-4" />}>
                <p>{revokeRefusal}</p>
              </Alert>
            ) : null}

            <Field
              htmlFor="revoke-reason"
              label="Reason"
              required
              hint="Who asked for this and on what authority. Stored verbatim against the audit entry."
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
                placeholder="Left the college on 31 July — handover to the incoming HOD completed, office order 2026/AC/151."
                rows={2}
              />
            </Field>

            <p className="text-xs">
              Writes <span className="font-mono">role.revoke</span> to the audit log with a
              before/after snapshot of every role the person holds.
            </p>
          </div>
        }
      />
    </div>
  );
}
