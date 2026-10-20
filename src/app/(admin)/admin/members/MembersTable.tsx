'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, X } from 'lucide-react';

import { Avatar, Badge, Button, CopyButton } from '@/components/ui';
import { memberLine } from '@/lib/format';
import { STATUS_META } from './status';
import type { MemberStatus } from '@/lib/data/types';

/**
 * The member list at sm and up: a dense table with a sticky header, a
 * status column and row selection.
 *
 * Selection is a convenience for staff, not a data path. The only thing
 * the bar does with it is copy links to the member records, which still
 * need a session and `profile.read.any` to open. Nothing here reads or
 * sends contact details; bulk contact export stays the college admin's
 * dialog and is not reachable from a selection.
 *
 * Rows arrive already narrowed to display fields by the server page.
 */

export interface MemberTableRow {
  id: string;
  fullName: string;
  preferredName: string | null;
  photoUrl: string | null;
  departmentCode: string | null;
  batchYear: number | null;
  designation: string | null;
  currentCompany: string | null;
  city: string | null;
  rollNumber: string | null;
  status: MemberStatus;
}

const CHECKBOX =
  'size-4 shrink-0 cursor-pointer rounded-sm border border-line-strong bg-surface-raised accent-[var(--button-primary-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]';

export function MembersTable({ rows }: { rows: MemberTableRow[] }) {
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set());
  const headRef = React.useRef<HTMLInputElement>(null);

  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const somePicked = picked.size > 0 && !allPicked;

  // A native checkbox only shows the dash through the DOM property.
  React.useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = somePicked;
  }, [somePicked]);

  // A new page or filter hands over new rows; a selection from the old
  // ones would count people who are no longer on screen.
  React.useEffect(() => {
    setPicked(new Set());
  }, [rows]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)));

  const links = React.useMemo(() => {
    if (picked.size === 0 || typeof window === 'undefined') return '';
    return rows
      .filter((r) => picked.has(r.id))
      .map((r) => `${r.fullName}: ${window.location.origin}/admin/members/${r.id}`)
      .join('\n');
  }, [picked, rows]);

  return (
    <>
      {/* No overflow wrapper: an overflow container would stop the header
          sticking to the page scroll. Phones use the card list instead. */}
      <div role="region" aria-label="Member records" className="rounded-lg border border-line bg-surface-raised">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {/* Each cell carries the fill so the header stays opaque while rows slide under it. */}
              <th scope="col" className="sticky top-14 z-10 w-10 rounded-tl-lg border-b border-line bg-surface-sunken px-3 py-2.5">
                <input
                  ref={headRef}
                  type="checkbox"
                  className={CHECKBOX}
                  checked={allPicked}
                  onChange={toggleAll}
                  aria-label="Select every member on this page"
                />
              </th>
              {['Name', 'Status', 'Batch', 'Work', 'Roll number'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="sticky top-14 z-10 whitespace-nowrap border-b border-line bg-surface-sunken px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-secondary"
                >
                  {h}
                </th>
              ))}
              <th scope="col" className="sticky top-14 z-10 w-8 rounded-tr-lg border-b border-line bg-surface-sunken px-3 py-2.5">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const on = picked.has(r.id);
              const meta = STATUS_META[r.status];
              return (
                <tr
                  key={r.id}
                  data-selected={on || undefined}
                  className="relative transition-colors duration-fast ease-brand hover:bg-[color-mix(in_srgb,var(--surface-sunken)_55%,transparent)] data-[selected]:bg-brand-soft"
                >
                  <td className="relative z-[1] w-10 px-3 py-2.5 align-middle">
                    <input
                      type="checkbox"
                      className={CHECKBOX}
                      checked={on}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.fullName}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.fullName} src={r.photoUrl} size="sm" />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/members/${r.id}`}
                          className="font-medium text-primary after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded focus-visible:after:ring-2 focus-visible:after:ring-[var(--focus-ring)]"
                        >
                          {r.fullName}
                        </Link>
                        {r.preferredName ? (
                          <span className="block text-xs text-secondary">Goes by {r.preferredName}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    {/* The two ordinary states stay quiet: a column of green says nothing. */}
                    <Badge tone={r.status === 'active_alumni' || r.status === 'active_student' ? 'outline' : meta.tone}>
                      {meta.label}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    {memberLine([r.departmentCode, r.batchYear]) || '—'}
                  </td>
                  <td className="max-w-72 px-3 py-2.5 align-middle">
                    <span className="block truncate text-secondary">
                      {memberLine([r.designation, r.currentCompany, r.city]) || '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle font-mono text-xs text-secondary">
                    {r.rollNumber ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle">
                    <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {picked.size > 0 ? (
        <div
          role="region"
          aria-label="Selected members"
          data-print-hide=""
          className="fixed inset-x-0 bottom-6 z-30 hidden justify-center px-4 sm:flex lg:pl-64"
        >
          <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-surface-raised py-2 pl-4 pr-2 shadow-lg">
            <p className="text-sm" role="status">
              <span className="font-semibold tabular">{picked.size}</span> selected
            </p>
            <CopyButton text={links} label="Copy links" copiedLabel="Links copied" size="sm" />
            <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setPicked(new Set())}>
              <X className="size-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
