import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, outcomeToast } from '../src/lib/client/api';

/**
 * The client's error taxonomy.
 *
 * Every interactive control in the portal posts through `apiRequest`, so
 * a mistake in this mapping is a mistake on eighteen screens at once.
 * Two of the branches matter more than the rest and are the reason the
 * file exists:
 *
 *  - **403 is not an error.** The capability guard refusing is the
 *    product working. It has to surface as a sentence about permission,
 *    because "something went wrong" invites the user to keep trying
 *    something they will never be allowed to do.
 *  - **`persisted: false` is not a success.** Fixture mode validates,
 *    authorises, rate-limits and audits, then stores nothing. A green
 *    tick over that is a lie the user discovers on the next page load.
 */

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const isJson = body !== undefined;
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => (k === 'content-type' ? (isJson ? 'application/json' : null) : (headers[k] ?? null)),
    },
    json: async () => body,
  } as unknown as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('success', () => {
  it('treats an absent persisted flag as a real write', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { id: 'x' }));
    const out = await apiRequest<{ id: string }>('/api/thing', { method: 'POST', body: {} });
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.persisted).toBe(true);
    expect(out.data.id).toBe('x');
  });

  it('carries persisted:false through instead of folding it into ok', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { ok: true, persisted: false }));
    const out = await apiRequest('/api/thing', { method: 'POST', body: {} });
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.persisted).toBe(false);
  });

  it('does not congratulate a persisted write, but does explain an unpersisted one', () => {
    expect(outcomeToast({ status: 'ok', data: {}, persisted: true }, 'Saved')).toEqual({
      tone: 'success',
      title: 'Saved',
    });

    const unpersisted = outcomeToast({ status: 'ok', data: {}, persisted: false }, 'Saved');
    expect(unpersisted?.tone).toBe('info');
    // The body has to say the write did not land, or the user finds out
    // by reloading and losing trust in everything else on the screen.
    expect(unpersisted?.body).toMatch(/no database|did not/i);
  });
});

describe('refusals are reported as refusals', () => {
  it('maps 403 to denied and keeps the server sentence', async () => {
    vi.stubGlobal('fetch', mockFetch(403, { error: 'Bulk export is restricted to the college administrator.', code: 'forbidden' }));
    const out = await apiRequest('/api/admin/members/export', { method: 'POST', body: {} });
    expect(out.status).toBe('denied');
    if (out.status !== 'denied') return;
    expect(out.message).toContain('college administrator');
    expect(outcomeToast(out, 'Exported')?.title).toBe('Not permitted');
  });

  it('maps 401 to denied with session wording, not a generic failure', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}));
    const out = await apiRequest('/api/profile', { method: 'PATCH', body: {} });
    expect(out.status).toBe('denied');
    if (out.status !== 'denied') return;
    expect(out.message).toMatch(/sign in/i);
  });
});

describe('the other branches', () => {
  it('maps 422 to invalid and keeps fieldErrors for the form', async () => {
    vi.stubGlobal('fetch', mockFetch(422, { error: 'Check the fields.', fieldErrors: { email: 'Not an email address.' } }));
    const out = await apiRequest('/api/profile', { method: 'PATCH', body: {} });
    expect(out.status).toBe('invalid');
    if (out.status !== 'invalid') return;
    // Without this the 422 only reaches a toast, and the user has to
    // guess which of eleven fields was wrong.
    expect(out.fieldErrors.email).toBe('Not an email address.');
  });

  it('maps 409 to conflict with its code', async () => {
    vi.stubGlobal('fetch', mockFetch(409, { error: 'That slug is taken.', code: 'slug_taken' }));
    const out = await apiRequest('/api/admin/news', { method: 'POST', body: {} });
    expect(out.status).toBe('conflict');
    if (out.status !== 'conflict') return;
    expect(out.code).toBe('slug_taken');
  });

  it('maps 429 and reads retry-after from the header', async () => {
    vi.stubGlobal('fetch', mockFetch(429, { error: 'Slow down.' }, { 'retry-after': '120' }));
    const out = await apiRequest('/api/auth/otp', { method: 'POST', body: {} });
    expect(out.status).toBe('rate_limited');
    if (out.status !== 'rate_limited') return;
    expect(out.retryAfter).toBe(120);
  });

  it('distinguishes an unbuilt route (404) from a validation failure', async () => {
    vi.stubGlobal('fetch', mockFetch(404, undefined));
    const out = await apiRequest('/api/not-built-yet', { method: 'POST', body: {} });
    expect(out.status).toBe('missing');
  });

  it('maps 501 to missing, and says the guards still ran', async () => {
    vi.stubGlobal('fetch', mockFetch(501, {}));
    const out = await apiRequest('/api/thing', { method: 'POST', body: {} });
    expect(out.status).toBe('missing');
    if (out.status !== 'missing') return;
    expect(out.message).toMatch(/permission checks all ran|nothing was stored/i);
  });

  it('survives an HTML error page rather than throwing on JSON.parse', async () => {
    // A route that does not exist answers with HTML. Parsing it must not
    // turn a legible 404 into an unhandled exception in the component.
    vi.stubGlobal('fetch', mockFetch(500, undefined));
    const out = await apiRequest('/api/thing', { method: 'POST', body: {} });
    expect(out.status).toBe('error');
  });

  it('reports a network failure as offline, not as a server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const out = await apiRequest('/api/thing', { method: 'POST', body: {} });
    expect(out.status).toBe('offline');
    if (out.status !== 'offline') return;
    expect(out.message).toMatch(/offline|nothing was sent/i);
  });

  it('treats an aborted request as a cancellation, not a failure to report', async () => {
    // The branding studio aborts in-flight previews on every keystroke.
    // A toast for each one would be unusable.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    const out = await apiRequest('/api/admin/branding?preview=1', { method: 'POST', body: {} });
    expect(out.status).toBe('offline');
    if (out.status !== 'offline') return;
    expect(out.message).toBe('Cancelled.');
  });
});

describe('request shape', () => {
  it('sends no content-type or body on a GET', async () => {
    const f = mockFetch(200, {});
    vi.stubGlobal('fetch', f);
    await apiRequest('/api/directory');
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('never serves a mutation from cache', async () => {
    const f = mockFetch(200, {});
    vi.stubGlobal('fetch', f);
    await apiRequest('/api/thing', { method: 'POST', body: { a: 1 } });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.cache).toBe('no-store');
    expect(init.body).toBe('{"a":1}');
  });
});
