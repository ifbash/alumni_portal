import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthzError, toResponse } from '@/lib/auth/guard';
import { rateLimit } from '@/lib/auth/session';
import { IS_FIXTURE } from '@/lib/config';

/**
 * Route-handler plumbing.
 *
 * Not a framework — four things that would otherwise be retyped, subtly
 * differently, in twenty handlers:
 *
 *  1. **One error shape.** `{ error, code }` on every failure, so the
 *     client never has to guess whether a refusal arrived as a string, a
 *     nested object or an HTML error page. `AuthzError` keeps its own
 *     401/403 mapping via `toResponse`.
 *  2. **Zod at the boundary, always.** `readJson` and `parseQuery` parse
 *     into a type or throw a 422 carrying `fieldErrors` keyed by input
 *     name — the shape the forms already read.
 *  3. **Rate limiting that says how long.** A 429 without `Retry-After`
 *     just invites the client to hammer.
 *  4. **An honest answer for writes.** Fixture mode has no writable
 *     store. Handlers still run every guard, every validation and the
 *     audit write, then say `persisted: false` rather than pretending.
 *
 * Nothing here decides authorisation. That stays in `@/lib/auth/guard`
 * and in the repository, where the database enforces it a second time.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const NO_STORE = { 'cache-control': 'no-store' } as const;

export function json(body: unknown, init: ResponseInit = {}): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE, ...(init.headers ?? {}) },
  });
}

/**
 * Every handler's catch block. Ordering matters: `AuthzError` is mapped
 * by the guard module itself so 401 and 403 keep their codes, and the
 * plain-`Error`-with-a-status case exists because
 * `requireDirectoryAccess()` throws one of those.
 */
export function fail(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    const headers: Record<string, string> = { ...NO_STORE };
    if (typeof err.extra.retryAfter === 'number') {
      headers['retry-after'] = String(err.extra.retryAfter);
    }
    return NextResponse.json(
      { error: err.message, code: err.code, ...err.extra },
      { status: err.status, headers },
    );
  }

  if (err instanceof AuthzError) {
    const { status, body } = toResponse(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }

  const carried = (err as { status?: unknown } | null)?.status;
  if (typeof carried === 'number' && carried >= 400 && carried < 500) {
    return NextResponse.json(
      {
        error: err instanceof Error && err.message ? err.message : 'Request refused',
        code: carried === 401 ? 'not_authenticated' : 'forbidden',
      },
      { status: carried, headers: NO_STORE },
    );
  }

  // A 500 that is not logged is a 500 nobody can fix.
  console.error('[api] unhandled', err);
  const { status, body } = toResponse(err);
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function readJson<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, 'malformed_body', 'That request body was not valid JSON.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, 'invalid_input', 'Some fields need fixing before this can be saved.', {
      fieldErrors: fieldErrors(parsed.error),
    });
  }
  return parsed.data;
}

/**
 * For endpoints whose body is entirely optional. `fetch` with no body at
 * all is a legitimate call to "register me, no guests", and it must not
 * come back as a malformed-JSON error.
 */
export async function readJsonOptional<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  const raw = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(raw === undefined || raw === null ? {} : raw);
  if (!parsed.success) {
    throw new HttpError(422, 'invalid_input', 'Some fields need fixing before this can be saved.', {
      fieldErrors: fieldErrors(parsed.error),
    });
  }
  return parsed.data;
}

export function parseQuery<S extends z.ZodTypeAny>(request: Request, schema: S): z.infer<S> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  // Blank values are absent values. `?city=` from an unset <select> must
  // not become a filter for members whose city is the empty string.
  for (const [key, value] of url.searchParams.entries()) {
    if (value !== '') raw[key] = value;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, 'invalid_query', 'Those filters are not valid.', {
      fieldErrors: fieldErrors(parsed.error),
    });
  }
  return parsed.data;
}

/** Checkbox-ish query parameters, from every direction a browser sends them. */
export const flagParam = z
  .string()
  .optional()
  .transform((v) => v === '1' || v === 'true' || v === 'yes' || v === 'on');

/**
 * X-Forwarded-For is a list; the client address is the first entry and
 * everything after it is a proxy we control. Local development has no
 * header at all, which shares one bucket — deliberate, and the reason
 * per-IP limits here are generous while per-identity limits are tight.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'local';
}

export function limit(key: string, max: number, windowSeconds: number, message: string): void {
  const result = rateLimit(key, max, windowSeconds);
  if (!result.ok) {
    throw new HttpError(429, 'rate_limited', message, { retryAfter: result.retryAfter });
  }
}

/**
 * The write seam.
 *
 * Fixture mode has no writable store, and the Postgres write path for
 * these routes is not built yet (see CLAUDE.md, "Not built"). Handlers
 * call this *after* every guard, validation and audit write, so what is
 * being demonstrated — the authorisation, not the INSERT — has already
 * happened by the time the response is shaped.
 *
 * Outside fixture mode it refuses loudly rather than returning a success
 * for something that did not happen.
 */
export function fixtureWrite(): { persisted: false } {
  if (!IS_FIXTURE) {
    throw new HttpError(
      501,
      'store_not_implemented',
      'This action is not wired to Postgres yet. Validation, authorisation and the audit entry all ran; nothing was stored.',
    );
  }
  return { persisted: false };
}

/** Cheap, readable ids for objects a fixture run hands back to the client. */
export function draftId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
