import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getTenantBrand } from '@/lib/tenant';
import { fail, fixtureWrite, HttpError, json, readJson } from '../../_lib/http';

/**
 * Notification opt-ins.
 *
 * Split by channel, not by topic, because the channels do not behave
 * alike. Email open rates on an alumni list of this age are poor and the
 * addresses decay; WhatsApp is read. A member who wants nothing by email
 * and everything on WhatsApp is the ordinary case here, so the two sets
 * are independent all the way down.
 *
 * Two things this endpoint refuses to do:
 *
 *  - Turn WhatsApp preferences into a silent no-op when the college has
 *    not bought the channel. It answers 409 and names the reason, because
 *    a switch that saves and then never delivers is worse than one that
 *    is not offered.
 *  - Accept a giving opt-in when the donations module is off. Students
 *    never see that module at all, and a preference for a feature that
 *    does not exist is a preference nobody can honour.
 */

const CHANNELS = ['connections', 'events', 'jobs', 'newsletter', 'giving'] as const;

/**
 * Every topic defaults to off when the client omits it. The giving row is
 * absent from the form for a college without the donations module, and a
 * missing key must mean "not subscribed", never "unchanged".
 */
const topicMap = z.object({
  connections: z.boolean().default(false),
  events: z.boolean().default(false),
  jobs: z.boolean().default(false),
  newsletter: z.boolean().default(false),
  giving: z.boolean().default(false),
});

const Body = z.object({
  email: topicMap,
  whatsapp: topicMap,
  digest: z.enum(['daily', 'weekly', 'never'], {
    errorMap: () => ({ message: 'Choose a daily digest, a weekly one, or none.' }),
  }),
});

async function handle(request: Request) {
  const session = await getSession();
  requireCap(session, 'profile.write.own');

  const resolved = await getTenantBrand();
  if (!resolved) throw new HttpError(404, 'unknown_tenant', 'No college is configured for this address.');
  const { features } = resolved.brand.pack;

  const body = await readJson(request, Body);

  const wantsWhatsapp = CHANNELS.some((c) => body.whatsapp[c]);
  if (wantsWhatsapp && !features.whatsapp) {
    throw new HttpError(
      409,
      'channel_unavailable',
      'WhatsApp messaging is not switched on for this college yet, so those preferences cannot be saved.',
      { channel: 'whatsapp' },
    );
  }

  const isStudent = session.roles.some((r) => r.role === 'student');
  if ((body.email.giving || body.whatsapp.giving) && (!features.donations || isStudent)) {
    throw new HttpError(
      409,
      'topic_unavailable',
      isStudent
        ? 'Fundraising appeals are never sent to students, so there is nothing to opt in to.'
        : 'The giving module is not enabled for this college.',
      { topic: 'giving' },
    );
  }

  const write = fixtureWrite();

  return json({
    ok: true,
    ...write,
    prefs: body,
    channels: {
      email: { available: true },
      whatsapp: { available: features.whatsapp },
    },
    note: 'Anything already queued for tonight still goes out. Bounce handling is separate: if your address starts bouncing, the college stops sending to it and asks you for another one.',
  });
}

export async function PATCH(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    return fail(err);
  }
}

/** The settings form saves with POST. Same handler, same guards. */
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    return fail(err);
  }
}
