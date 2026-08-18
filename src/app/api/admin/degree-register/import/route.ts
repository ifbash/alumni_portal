import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getDepartments, searchDegreeRegister } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { nameTokens, normaliseRoll, rollLooksValid } from '@/lib/verification/matcher';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../_lib/http';

/**
 * The degree-register loader.
 *
 * `degree_register` is the source of truth every alumni verification is
 * decided against, so loading it wrong is expensive in a way that is
 * invisible for months — a mistyped year of passing does not fail, it
 * quietly makes a whole batch unverifiable. Three properties follow:
 *
 *  1. **`dryRun` is stated, never defaulted.** There is no shape of body
 *     that writes by omission.
 *  2. **The rules live here, not in the browser.** The wizard parses the
 *     file locally so a file can be inspected before it is sent, but the
 *     verdict on every row — and the counts the confirmation is typed
 *     against — are computed on the server. A preview produced by
 *     different code from the write is a preview of something else.
 *  3. **The commit is idempotent.** Rows are keyed on `tenant_id` plus
 *     `roll_number`. A roll already present is skipped: never inserted a
 *     second time, never silently overwritten. Re-running the same file
 *     changes nothing, which is what makes a load that failed halfway
 *     safe to run again from the start — and the response says so, because
 *     an operator who does not believe it will not re-run it.
 *
 * Bad rows are reported, never dropped silently: each carries the line it
 * came from and the specific reason it was refused, so the file is fixed
 * once and re-sent rather than debugged a row at a time.
 */

const MAX_ROWS = 5000;

const Row = z.object({
  /** Line in the source file, so a rejection can be found and fixed. */
  line: z.number().int().min(1).max(1_000_000),
  rollNumber: z.string().trim().max(64),
  name: z.string().trim().max(200),
  department: z.string().trim().max(24),
  programme: z.string().trim().max(64).optional(),
  admissionYear: z.string().trim().max(16).optional(),
  yearOfPassing: z.string().trim().max(16),
});

const Body = z
  .object({
    dryRun: z.boolean({
      required_error:
        'Say whether this is a dry run. There is no default — a missing flag on an endpoint that writes to the degree register must never mean "go ahead".',
      invalid_type_error: 'dryRun is true or false.',
    }),
    fileName: z
      .string()
      .trim()
      .min(1, 'Name the file. The audit entry records which export from the examinations branch this was.')
      .max(200),
    rows: z
      .array(Row)
      .min(1, 'That file has a header row and nothing under it.')
      .max(MAX_ROWS, `Send at most ${MAX_ROWS} rows at a time. Split the file by branch — that is how the examinations branch exports it anyway.`),
    /** Typed back on commit, exactly as the wizard asks for it on screen. */
    confirm: z.string().trim().max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.dryRun && !value.confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm'],
        message: 'Type the confirmation phrase from the dry run to commit.',
      });
    }
  });

type SourceRow = z.infer<typeof Row>;

type Verdict =
  | { kind: 'new' }
  | { kind: 'duplicate'; where: 'register' | 'file' }
  | { kind: 'rejected'; reason: string };

/** Rejections returned in full up to here; the count is always exact. */
const REJECTION_LIST_CAP = 200;

function verdictFor(
  row: SourceRow,
  seen: Set<string>,
  existing: Set<string>,
  departmentCodes: string[],
): Verdict {
  if (!row.rollNumber) return { kind: 'rejected', reason: 'No roll number in this row.' };

  if (!rollLooksValid(row.rollNumber)) {
    return {
      kind: 'rejected',
      reason: `"${row.rollNumber}" is not a JNTU roll number — it needs at least eight characters, starting with the two admission-year digits.`,
    };
  }

  if (!row.name) {
    return {
      kind: 'rejected',
      reason: 'The name is blank. A register row with no name can never be matched to a claim.',
    };
  }

  if (!/^\d{4}$/.test(row.yearOfPassing)) {
    return {
      kind: 'rejected',
      reason: `Year of passing "${row.yearOfPassing || 'blank'}" is not a four-digit year.`,
    };
  }

  if (row.admissionYear) {
    if (!/^\d{4}$/.test(row.admissionYear)) {
      return { kind: 'rejected', reason: `Admission year "${row.admissionYear}" is not a four-digit year.` };
    }
    if (Number(row.admissionYear) >= Number(row.yearOfPassing)) {
      return {
        kind: 'rejected',
        reason: `Admitted ${row.admissionYear} but shown as passing in ${row.yearOfPassing}. The year of passing must come after the year of admission.`,
      };
    }
  }

  if (row.department && !departmentCodes.includes(row.department.toUpperCase())) {
    return {
      kind: 'rejected',
      reason: `Branch code "${row.department}" is not configured for this college. Known codes: ${departmentCodes.join(', ')}.`,
    };
  }

  // The key. Same tenant, same roll number is the same row — in this file
  // and against what is already loaded.
  const key = normaliseRoll(row.rollNumber);
  if (seen.has(key)) return { kind: 'duplicate', where: 'file' };
  seen.add(key);
  if (existing.has(key)) return { kind: 'duplicate', where: 'register' };
  return { kind: 'new' };
}

function nameKey(name: string): string {
  return nameTokens(name).slice().sort().join(' ');
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    // The register decides who is an alumnus. Loading it is the same
    // authority as approving a claim against it, and no narrower.
    requireCap(session, 'verification.review.any');

    const tenant = await getTenant();
    if (!tenant) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');

    const body = await readJson(request, Body);

    limit(
      body.dryRun ? `register-preview:${session.memberId}` : `register-import:${session.memberId}`,
      body.dryRun ? 40 : 10,
      60 * 60,
      body.dryRun
        ? 'Forty dry runs in an hour is the limit. The verdicts do not move between one and the next unless the file does.'
        : 'Ten register imports in an hour is the limit. If a file needs an eleventh attempt, the file is the problem.',
    );

    const departmentCodes = getDepartments().map((d) => d.code.toUpperCase());
    const registerRows = searchDegreeRegister('', { perPage: 100000 }).items;
    const existing = new Set(registerRows.map((r) => normaliseRoll(r.rollNumber)));
    const loadedFiles = new Set(
      registerRows.map((r) => r.sourceFile).filter((f): f is string => Boolean(f)),
    );

    const seen = new Set<string>();
    const verdicts = body.rows.map((row) => ({
      row,
      verdict: verdictFor(row, seen, existing, departmentCodes),
    }));

    const fresh = verdicts.filter((v) => v.verdict.kind === 'new').length;
    const duplicateInRegister = verdicts.filter(
      (v) => v.verdict.kind === 'duplicate' && v.verdict.where === 'register',
    ).length;
    const duplicateInFile = verdicts.filter(
      (v) => v.verdict.kind === 'duplicate' && v.verdict.where === 'file',
    ).length;

    const rejected = verdicts.filter(
      (v): v is { row: SourceRow; verdict: { kind: 'rejected'; reason: string } } =>
        v.verdict.kind === 'rejected',
    );

    // Same name, same branch, same year, different roll numbers. Two real
    // people — a warning a human resolves at verification time, never a
    // reason to drop a row. Deleting one of them makes a graduate
    // unverifiable forever.
    const groups = new Map<string, { label: string; rollNumbers: Set<string> }>();
    for (const { row, verdict } of verdicts) {
      if (verdict.kind === 'rejected') continue;
      const key = `${nameKey(row.name)}|${row.department.toUpperCase()}|${row.yearOfPassing}`;
      const group = groups.get(key) ?? {
        label: `${row.name} · ${row.department} · ${row.yearOfPassing}`,
        rollNumbers: new Set<string>(),
      };
      group.rollNumbers.add(row.rollNumber);
      groups.set(key, group);
    }
    const homonyms = [...groups.values()]
      .filter((g) => g.rollNumbers.size > 1)
      .map((g) => ({ label: g.label, rollNumbers: [...g.rollNumbers] }));

    const counts = {
      rows: body.rows.length,
      new: fresh,
      duplicate: duplicateInRegister + duplicateInFile,
      duplicateInRegister,
      duplicateInFile,
      rejected: rejected.length,
    };

    const shared = {
      fileName: body.fileName,
      counts,
      rejected: rejected.slice(0, REJECTION_LIST_CAP).map(({ row, verdict }) => ({
        line: row.line,
        rollNumber: row.rollNumber,
        name: row.name,
        reason: verdict.reason,
      })),
      rejectedListTruncatedAt: rejected.length > REJECTION_LIST_CAP ? REJECTION_LIST_CAP : null,
      homonyms,
      fileAlreadyLoaded: loadedFiles.has(body.fileName),
      registerTotal: registerRows.length,
      registerTotalAfter: registerRows.length + fresh,
      // Stated in the response on purpose: an operator who does not
      // believe a re-run is safe will not re-run a load that failed
      // halfway, and will instead hand-edit the file.
      idempotentOn: 'tenant_id + roll_number',
      confirmPhrase: `IMPORT ${fresh}`,
    };

    if (body.dryRun) {
      return json({
        ok: true,
        dryRun: true,
        ...shared,
        note: `Nothing has been written. Committing this file inserts ${fresh} row${fresh === 1 ? '' : 's'} and skips ${counts.duplicate} already keyed on tenant and roll number. To run it, post again with dryRun false and the confirmation phrase.`,
      });
    }

    if (body.confirm !== shared.confirmPhrase) {
      throw new HttpError(
        422,
        'confirm_mismatch',
        `The register has ${fresh} new row${fresh === 1 ? '' : 's'} in this file, not the number typed. That usually means the dry run is stale — somebody else loaded rows since you read it. Run the dry run again and read the counts before committing.`,
        {
          fieldErrors: { confirm: `Type ${shared.confirmPhrase} to confirm.` },
          expected: shared.confirmPhrase,
          counts,
        },
      );
    }

    await logAudit({
      tenantId: tenant.id,
      session,
      action: 'register.import',
      resource: 'degree_register',
      resourceId: body.fileName,
      reason: null,
      // Whole counts on both sides rather than a delta: "how big was the
      // register before this file, and after it" is the question asked
      // when a batch turns out to be unverifiable.
      before: {
        fileName: body.fileName,
        registerRows: registerRows.length,
        fileAlreadyLoaded: shared.fileAlreadyLoaded,
      },
      after: {
        fileName: body.fileName,
        registerRows: registerRows.length + fresh,
        counts,
        keyedOn: shared.idempotentOn,
        // The full rejection list, not the truncated one the screen shows.
        rejected: rejected.map(({ row, verdict }) => ({
          line: row.line,
          rollNumber: row.rollNumber,
          name: row.name,
          reason: verdict.reason,
        })),
        homonyms,
      },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();

    return json({
      ok: true,
      dryRun: false,
      ...write,
      ...shared,
      auditedAs: 'register.import',
      note: `${fresh} row${fresh === 1 ? '' : 's'} inserted, ${counts.duplicate} skipped as already present, ${counts.rejected} refused. Rows are keyed on tenant and roll number, so loading ${body.fileName} again adds nothing — send the corrected file when the examinations branch fixes the refused rows.`,
    });
  } catch (err) {
    return fail(err);
  }
}
