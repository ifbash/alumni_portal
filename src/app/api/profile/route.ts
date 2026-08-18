import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenant } from '@/lib/tenant';
import { getOwnProfile } from '@/lib/data/repo';
import { logAudit } from '@/lib/audit/log';
import { fail, fieldErrors, fixtureWrite, HttpError, json } from '../_lib/http';

/**
 * Edit your own profile.
 *
 * Two rules do most of the work here:
 *
 *  1. **Identity is not editable.** Roll number, branch, batch year and
 *     sign-in email came from the degree register or from verification.
 *     A portal that lets a member retype their own roll number has thrown
 *     away the only evidence its verification decision was based on. They
 *     are refused explicitly rather than silently dropped, so a client
 *     that sends them learns it is wrong.
 *  2. **CGPA and placement status are not writable by anybody here.**
 *     They are placement-side data with their own owner, and this is the
 *     endpoint every member can reach.
 *
 * `PATCH` is the honest verb; `POST` is accepted as well because the
 * forms in this app send it and a 405 on a save button is a worse
 * outcome than a second entry point on the same handler.
 */

const IMMUTABLE = [
  'rollNumber',
  'batchYear',
  'admissionYear',
  'departmentCode',
  'departmentName',
  'programme',
  'email',
  'status',
  'roles',
  'cgpa',
  'placementStatus',
  'verifiedAt',
  'verificationMethod',
  'slug',
  'id',
] as const;

const REFUSALS: Record<string, string> = {
  rollNumber: 'Your roll number comes from the degree register and cannot be edited here.',
  batchYear: 'Your year of passing comes from the degree register. The alumni cell can correct it.',
  admissionYear: 'Your admission year comes from the degree register.',
  departmentCode: 'Your branch comes from the degree register. The alumni cell can correct it.',
  departmentName: 'Your branch comes from the degree register.',
  programme: 'Your programme comes from the degree register.',
  email: 'Your email is your sign-in credential. Changing it is an account-recovery flow, not a form field.',
  status: 'Membership status is set by verification, not by the member.',
  roles: 'Roles are granted by the college admin.',
  cgpa: 'Academic records are held by the examinations branch and are not editable in the portal.',
  placementStatus: 'Placement status is maintained by the placement cell.',
  verifiedAt: 'Verification is recorded by whoever reviewed your claim.',
  verificationMethod: 'Verification is recorded by whoever reviewed your claim.',
  slug: 'Your profile address is derived from your verified name.',
  id: 'Member ids are not editable.',
};

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalDate = z
  .string()
  .trim()
  .max(24)
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Use a date like 2021-07 or 2021-07-01.')
  .nullable()
  .optional()
  .or(z.literal(''));

const link = (label: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === '' || v.startsWith('https://') || v.startsWith('http://'), `Your ${label} link needs the https:// prefix.`)
    .nullable()
    .optional();

const Body = z.object({
  fullName: z.string().trim().min(3, 'Enter your full name, not initials alone.').max(120).optional(),
  preferredName: optionalText(60),
  photoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === '' || v.startsWith('/') || v.startsWith('https://') || v.startsWith('data:'),
      'A photo must be an uploaded file or an https link.',
    )
    .nullable()
    .optional(),
  bio: z
    .string()
    .trim()
    .max(800, 'Keep it under 800 characters — this is the line a student reads before writing to you.')
    .nullable()
    .optional(),
  designation: optionalText(120),
  currentCompany: optionalText(120),
  industry: optionalText(80),
  city: optionalText(80),
  state: optionalText(80),
  country: optionalText(80),
  skills: z
    .array(z.string().trim().min(1).max(40))
    .max(24, 'Twenty-four skills is more than anyone reads. Keep the ones you would answer questions about.')
    .optional(),
  openToMentoring: z.boolean().optional(),
  openToReferrals: z.boolean().optional(),
  openToSpeaking: z.boolean().optional(),
  mobile: z
    .string()
    .trim()
    .max(24)
    .refine((v) => {
      if (v === '') return true;
      const digits = v.replace(/\D/g, '');
      // Ten digits, or twelve with the country code in front of them.
      return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
    }, 'An Indian mobile number is ten digits, with or without +91 in front.')
    .nullable()
    .optional(),
  linkedin: link('LinkedIn'),
  github: link('GitHub'),
  portfolio: link('portfolio'),
  employment: z
    .array(
      z.object({
        id: z.string().trim().max(64).optional(),
        company: z.string().trim().min(1, 'Which company?').max(120),
        designation: optionalText(120),
        location: optionalText(120),
        startedOn: optionalDate,
        endedOn: optionalDate,
        isCurrent: z.boolean().default(false),
      }),
    )
    .max(15)
    .optional(),
  education: z
    .array(
      z.object({
        id: z.string().trim().max(64).optional(),
        institution: z.string().trim().min(1, 'Which institution?').max(160),
        qualification: optionalText(80),
        field: optionalText(120),
        startedOn: optionalDate,
        endedOn: optionalDate,
      }),
    )
    .max(10)
    .optional(),
});

async function handle(request: Request) {
  const session = await getSession();
  requireCap(session, 'profile.write.own');

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    throw new HttpError(400, 'malformed_body', 'That request body was not valid JSON.');
  }

  const refused = IMMUTABLE.filter((key) => key in raw);
  if (refused.length > 0) {
    throw new HttpError(422, 'immutable_field', 'Some of those fields are not yours to change.', {
      fieldErrors: Object.fromEntries(refused.map((key) => [key, REFUSALS[key]])),
    });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, 'invalid_input', 'Some fields need fixing before this can be saved.', {
      fieldErrors: fieldErrors(parsed.error),
    });
  }
  const body = parsed.data;

  const current = getOwnProfile(session);
  if (!current) {
    throw new HttpError(404, 'not_found', 'Your member record could not be loaded.');
  }

  // Exactly one current employer. Two "current" rows is how a directory
  // ends up showing somebody at a company they left three years ago.
  const currentRoles = (body.employment ?? []).filter((e) => e.isCurrent);
  if (currentRoles.length > 1) {
    throw new HttpError(422, 'invalid_input', 'Only one role can be the current one.', {
      fieldErrors: { employment: 'Mark just one role as current and give the others an end date.' },
    });
  }

  const nameChanged = Boolean(body.fullName && body.fullName !== current.fullName);

  if (nameChanged && current.verifiedAt) {
    const tenant = await getTenant();
    if (tenant) {
      // A verified member's name is the thing the register match was made
      // against. Changing it is not refused, but it is on the record.
      await logAudit({
        tenantId: tenant.id,
        session,
        action: 'profile.name.change',
        resource: 'members',
        resourceId: session.memberId,
        before: { fullName: current.fullName, verifiedAt: current.verifiedAt },
        after: { fullName: body.fullName },
        reason: 'Self-service profile edit by a verified member',
        ip: request.headers.get('x-forwarded-for'),
      });
    }
  }

  const write = fixtureWrite();

  return json({
    ok: true,
    ...write,
    updated: Object.keys(body),
    profile: {
      fullName: body.fullName ?? current.fullName,
      preferredName: body.preferredName ?? current.preferredName,
      photoUrl: body.photoUrl ?? current.photoUrl,
      bio: body.bio ?? current.bio,
      designation: body.designation ?? current.designation,
      currentCompany: body.currentCompany ?? current.currentCompany,
      industry: body.industry ?? current.industry,
      city: body.city ?? current.city,
      state: body.state ?? current.state,
      country: body.country ?? current.country,
      skills: body.skills ?? current.skills,
      openToMentoring: body.openToMentoring ?? current.openToMentoring,
      openToReferrals: body.openToReferrals ?? current.openToReferrals,
      openToSpeaking: body.openToSpeaking ?? current.openToSpeaking,
      employment: body.employment ?? current.employment,
      education: body.education ?? current.education,
    },
    ...(nameChanged
      ? {
          notice:
            'Your name no longer matches the degree register. The alumni cell reviews name changes on verified profiles.',
        }
      : {}),
  });
}

export async function PATCH(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    return fail(err);
  }
}

/** The forms in this app save with POST. Same handler, same guards. */
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    return fail(err);
  }
}
