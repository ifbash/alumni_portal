'use client';

/**
 * The client's single door to the API.
 *
 * Every interactive component posts through this. Not for tidiness — for
 * three specific failure modes that otherwise get handled eighteen
 * different ways, badly:
 *
 *  1. **A refusal is not a crash.** A 403 from the capability guard is
 *     the server working correctly. It has to reach the user as a
 *     sentence about permission, not as "something went wrong".
 *  2. **A fixture write is not a success.** Fixture mode validates,
 *     authorises, rate-limits and audits, then persists nothing and says
 *     so via `persisted: false`. A green tick over that is a lie the user
 *     discovers on the next page load, so the flag is surfaced as its own
 *     outcome rather than folded into `ok`.
 *  3. **A missing endpoint is not a validation error.** During a build
 *     this wide, a 404 from a route nobody wrote yet must be legible as
 *     exactly that, or an afternoon goes into debugging a form that was
 *     never wired.
 *
 * Nothing here decides what a user may do. The server has already
 * decided; this only reports the answer.
 */

export type ApiOutcome<T> =
  | { status: 'ok'; data: T; persisted: boolean }
  | { status: 'invalid'; message: string; fieldErrors: Record<string, string> }
  | { status: 'denied'; message: string; code: string }
  | { status: 'conflict'; message: string; code: string }
  | { status: 'rate_limited'; message: string; retryAfter: number }
  | { status: 'missing'; message: string }
  | { status: 'offline'; message: string }
  | { status: 'error'; message: string; httpStatus: number };

interface ErrorBody {
  error?: string;
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  retryAfter?: number;
}

const GENERIC =
  'Something went wrong at our end. Nothing you were doing has been lost — try again in a moment.';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiOutcome<T>> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      // Never serve a mutation's answer from a cache.
      cache: 'no-store',
    });
  } catch (err) {
    // An aborted request is the caller changing its mind, not a failure.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'offline', message: 'Cancelled.' };
    }
    return {
      status: 'offline',
      message:
        'Nothing reached the server. Your device looks to be offline — reconnect and try again; nothing was sent.',
    };
  }

  // A 204, or an HTML error page from a route that does not exist, both
  // fail to parse. Neither should throw here.
  let body: unknown = null;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (isJson) {
    body = await res.json().catch(() => null);
  }

  if (res.ok) {
    const data = (body ?? {}) as T & { persisted?: boolean };
    return {
      status: 'ok',
      data: data as T,
      // Absent means a real write. Only fixture mode sets it false.
      persisted: data.persisted !== false,
    };
  }

  const err = (body ?? {}) as ErrorBody;
  const message = err.error ?? err.message ?? null;

  switch (res.status) {
    case 400:
    case 422:
      return {
        status: 'invalid',
        message: message ?? 'Check the highlighted fields and try again.',
        fieldErrors: err.fieldErrors ?? {},
      };

    case 401:
      return {
        status: 'denied',
        code: err.code ?? 'not_authenticated',
        message: message ?? 'Your session has ended. Sign in again to continue.',
      };

    case 403:
      // The guard did its job. Say so plainly rather than apologising for
      // it — the user is not entitled to this, and a vague error invites
      // them to keep trying.
      return {
        status: 'denied',
        code: err.code ?? 'forbidden',
        message: message ?? 'You do not have permission to do that.',
      };

    case 404:
      return {
        status: 'missing',
        message: message ?? 'That is not connected in this build yet, so nothing was saved.',
      };

    case 409:
      return {
        status: 'conflict',
        code: err.code ?? 'conflict',
        message: message ?? 'That conflicts with something already recorded.',
      };

    case 429:
      return {
        status: 'rate_limited',
        retryAfter: Number(res.headers.get('retry-after') ?? err.retryAfter ?? 60),
        message: message ?? 'Too many attempts. Wait a moment and try again.',
      };

    case 501:
      // `fixtureWrite()` outside fixture mode: everything ran except the
      // store. Worth its own wording, because the guards did pass.
      return {
        status: 'missing',
        message:
          message ??
          'This action is not wired to the database yet. Validation and permission checks all ran; nothing was stored.',
      };

    default:
      return { status: 'error', message: message ?? GENERIC, httpStatus: res.status };
  }
}

/** Convenience wrappers, so call sites read as the verb they mean. */
export const api = {
  get: <T = unknown>(path: string, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'GET', signal }),
  post: <T = unknown>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'POST', body: body ?? {}, signal }),
  patch: <T = unknown>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'PATCH', body: body ?? {}, signal }),
  del: <T = unknown>(path: string, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'DELETE', signal }),
};

/**
 * The toast an outcome deserves.
 *
 * Returns null for success-with-persistence, because a form that already
 * updates in place does not need to be congratulated. Everything else
 * gets a title and a body the user can act on.
 */
export function outcomeToast(
  outcome: ApiOutcome<unknown>,
  successTitle: string,
): { tone: 'success' | 'danger' | 'info'; title: string; body?: string } | null {
  switch (outcome.status) {
    case 'ok':
      return outcome.persisted
        ? { tone: 'success', title: successTitle }
        : {
            tone: 'info',
            title: successTitle,
            body:
              'Recorded on this screen only — this build runs on seeded data with no database behind it. Every permission check and the audit entry ran; the write did not.',
          };
    case 'invalid':
      return { tone: 'danger', title: 'That could not be saved', body: outcome.message };
    case 'denied':
      return { tone: 'danger', title: 'Not permitted', body: outcome.message };
    case 'conflict':
      return { tone: 'danger', title: 'That conflicts', body: outcome.message };
    case 'rate_limited':
      return { tone: 'danger', title: 'Too many attempts', body: outcome.message };
    case 'missing':
      return { tone: 'info', title: 'Not saved', body: outcome.message };
    case 'offline':
      return { tone: 'danger', title: 'Nothing reached the server', body: outcome.message };
    case 'error':
      return { tone: 'danger', title: 'Something went wrong', body: outcome.message };
  }
}
