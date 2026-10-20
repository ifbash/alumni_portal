import * as React from 'react';
import { Briefcase, CalendarDays, Clock, GraduationCap, Mail, Settings, Users } from 'lucide-react';
import { ButtonLink, Card, CardBody, CardHeader, CardTitle } from '@/components/ui';
import { BandChip } from '@/components/brand/PageBand';
import { getOwnProfile } from '@/lib/data/repo';
import { firstNameOf } from '@/lib/identity';
import { greetingFor } from '@/lib/branding/copy';
import { mailto } from '@/lib/mailto';
import type { Session } from '@/lib/auth/guard';
import type { BrandPack } from '@/lib/branding/pack';
import { HomeBand } from './HomeBand';

/**
 * The home of somebody whose registration is still being checked.
 *
 * They hold no roles yet, so they may see nothing about anybody else:
 * this page reads only their own record (for the greeting) and the
 * college's pack (for what the portal offers). It calls no function that
 * returns other members, and it promises only what the pack has switched
 * on.
 *
 * No photo on the band: this is a waiting room, not a welcome, and the
 * welcome comes after verification.
 */
export function PendingHome({ session, pack }: { session: Session; pack: BrandPack }) {
  const own = getOwnProfile(session);
  const { copy, features } = pack;
  const first = own ? firstNameOf(own.fullName, own.preferredName) : null;
  const student = own?.isStudent ?? false;

  const lead =
    `The ${copy.officeName} is checking your registration against the degree register.` +
    (copy.reviewTurnaround ? ` Most checks finish within ${copy.reviewTurnaround}.` : '');

  const opens: Array<{ key: string; icon: React.ReactNode; text: string }> = [];
  if (features.directory) opens.push({ key: 'directory', icon: <Users />, text: 'Find your batch and branch' });
  if (features.events) opens.push({ key: 'events', icon: <CalendarDays />, text: 'Register for events' });
  if (features.jobs) opens.push({ key: 'jobs', icon: <Briefcase />, text: 'See roles graduates are hiring for' });
  if (features.mentorship) {
    opens.push({
      key: 'mentorship',
      icon: <GraduationCap />,
      text: student ? 'Ask graduates for advice' : 'Help final-year students',
    });
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <HomeBand
        pack={pack}
        photo={null}
        title={first ? `${greetingFor(copy)}, ${first}` : greetingFor(copy)}
        lead={lead}
        meta={<BandChip icon={<Clock />}>Being checked</BandChip>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        {opens.length ? (
          <Card as="section" aria-labelledby="opens-title" className="min-w-0">
            <CardHeader variant="stack">
              <CardTitle as="h2" id="opens-title" className="text-md">
                What opens after you are verified
              </CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
                {opens.map((o, i) => (
                  <li
                    key={o.key}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"
                    style={{ '--i': i } as React.CSSProperties}
                  >
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-fg [&>svg]:size-4"
                      aria-hidden="true"
                    >
                      {o.icon}
                    </span>
                    <span className="min-w-0 text-sm font-medium text-primary">{o.text}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        <div className="min-w-0 space-y-2">
          {copy.supportEmail ? (
            <ButtonLink
              href={mailto(copy.supportEmail, `Registration: ${own?.fullName ?? 'my account'}`, [])}
              variant="secondary"
              className="min-h-11 w-full justify-start"
            >
              <Mail className="size-4" aria-hidden="true" />
              Questions? Write to the {copy.officeName}
            </ButtonLink>
          ) : null}
          <ButtonLink href="/settings" variant="ghost" className="min-h-11 w-full justify-start">
            <Settings className="size-4" aria-hidden="true" />
            Settings
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
