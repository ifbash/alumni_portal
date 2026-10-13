import { describe, expect, it } from 'vitest';
import type { Session } from '@/lib/auth/guard';
import { SEED_NOW } from '@/lib/clock';
import { findMemberById } from '@/lib/data/repo';
import { isOnlineVenue as publicIsOnlineVenue } from '@/lib/data/public-events';
import { SEED } from '@/lib/data/seed';
import { isFresherFriendly, isOnlineVenue, seatStatus } from '@/lib/event-status';
import {
  dayBucket,
  daysUntil,
  displayNow,
  formatCompactINR,
  formatTimeZoneLabel,
} from '@/lib/format';
import { firstNameOf, identityLine, initialsOf, viewerBatchYear, viewerBranch } from '@/lib/identity';
import { directionsUrl } from '@/lib/maps';
import { notificationAction } from '@/lib/notifications-view';

/**
 * Formatting and identity helpers: the small functions every signed-in
 * screen leans on, where a wrong answer is a wrong sentence on every page.
 */

function sessionFor(email: string): Session {
  const account = SEED.demoAccounts.find((a) => a.email === email)!;
  const m = findMemberById(account.memberId)!;
  return {
    memberId: m.id,
    tenantId: 'ten-diet',
    status: m.status,
    roles: m.roles.map((r) => ({ role: r.role, departmentId: r.departmentCode })),
    departmentId: m.departmentCode,
    batchYear: m.batchYear,
  };
}

const at = (daysFromSeed: number) => new Date(SEED_NOW.getTime() + daysFromSeed * 86400000).toISOString();

describe('money', () => {
  it('writes figures below a lakh in full and larger ones in lakhs and crores', () => {
    expect(formatCompactINR(2000)).toBe('₹2,000');
    expect(formatCompactINR(99999)).toBe('₹99,999');
    expect(formatCompactINR(250000)).toBe('₹2.50 L');
    expect(formatCompactINR(14185000)).toBe('₹1.42 Cr');
  });
});

describe('names', () => {
  it('skip honorifics, dotted or not', () => {
    expect(firstNameOf('Dr. Ramesh Chalasani')).toBe('Ramesh');
    expect(firstNameOf('Prof K. Narasimha Rao')).toBe('Narasimha');
    expect(firstNameOf('Smt. Lakshmi Devi')).toBe('Lakshmi');
    expect(firstNameOf('Harika Nallamothu')).toBe('Harika');
    expect(firstNameOf('Dr. Ramesh Chalasani', 'Ramesh garu')).toBe('Ramesh garu');

    expect(initialsOf('Dr. Ramesh Chalasani')).toBe('RC');
    expect(initialsOf('DR Padmaja Vemulapalli')).toBe('PV');
    expect(initialsOf('Sri Venkata Rao')).toBe('VR');
    expect(initialsOf('Harika Nallamothu')).toBe('HN');
    expect(initialsOf('Infosys')).toBe('I');
  });

  it('give a batch only to holders of the alumni role', () => {
    expect(viewerBatchYear(sessionFor('alumni@example.com'))).toBe(2017);
    for (const staff of ['hod.cse@diet.ac.in', 'faculty.ece@diet.ac.in', 'tpo@diet.ac.in']) {
      expect(viewerBatchYear(sessionFor(staff)), staff).toBeNull();
    }
  });

  it('give a branch from the record, or from the staff grant', () => {
    expect(viewerBranch(sessionFor('student@diet.ac.in'))).toBe('CSE');
    expect(viewerBranch(sessionFor('hod.cse@diet.ac.in'))).toBe('CSE');
    expect(viewerBranch(sessionFor('faculty.ece@diet.ac.in'))).toBe('ECE');
    expect(viewerBranch(sessionFor('tpo@diet.ac.in'))).toBeNull();
    expect(viewerBranch(sessionFor('finance@diet.ac.in'))).toBeNull();
  });

  it('describe a person by what they are, never by a batch they did not graduate with', () => {
    expect(
      identityLine({ roles: ['student'], departmentCode: 'CSE', batchYear: 2026, isStudent: true }),
    ).toBe('CSE · Final year');
    expect(
      identityLine({ roles: ['alumni'], departmentCode: 'CSE', batchYear: 2017, isStudent: false }),
    ).toBe('CSE · Batch of 2017 · 9 years out');
    expect(
      identityLine({
        roles: ['faculty', 'hod'],
        departmentCode: 'CSE',
        departmentName: 'Computer Science & Engineering',
        batchYear: 2023,
        designation: 'Head of Department, CSE',
        isStudent: false,
      }),
    ).toBe('Head of Department, CSE');
    expect(
      identityLine({
        roles: ['faculty'],
        departmentCode: 'ECE',
        departmentName: 'Electronics & Communication Engineering',
        batchYear: 2019,
        designation: 'Lecturer',
        isStudent: false,
      }),
    ).toBe('Lecturer · Electronics & Communication Engineering');
    expect(identityLine({ roles: ['finance'], departmentCode: null, batchYear: 2026, isStudent: false })).toBe(
      'Finance',
    );
  });
});

describe('the clock', () => {
  it('reads the fixture instant', () => {
    expect(displayNow().getTime()).toBe(SEED_NOW.getTime());
  });

  it('names the tenant time zone the way readers do', () => {
    expect(formatTimeZoneLabel('Asia/Kolkata')).toBe('IST');
    expect(formatTimeZoneLabel('Not/AZone')).toBe('Not/AZone');
  });

  it('counts calendar days in the tenant time zone', () => {
    expect(daysUntil(at(0))).toBe(0);
    expect(daysUntil(at(11))).toBe(11);
    expect(daysUntil(at(-1))).toBe(-1);
    // 11:45 pm IST tonight is still today, though it is 14 hours away.
    expect(daysUntil('2026-08-17T23:45:00+05:30')).toBe(0);
    expect(daysUntil('2026-08-18T00:15:00+05:30')).toBe(1);
  });

  it('files a dated item under today, yesterday or earlier', () => {
    expect(dayBucket(at(-0.1))).toBe('today');
    expect(dayBucket(at(-1))).toBe('yesterday');
    expect(dayBucket(at(-6))).toBe('earlier');
  });
});

describe('directions', () => {
  const address = ['Dhanekula Institute of Engineering & Technology', 'Ganguru, Vijayawada — 521139'];

  it('add the college address to a bare room name', () => {
    const url = directionsUrl('Main Auditorium', address)!;
    expect(url.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true);
    expect(decodeURIComponent(url.split('query=')[1]!)).toBe(
      'Main Auditorium, Dhanekula Institute of Engineering & Technology, Ganguru, Vijayawada — 521139',
    );
  });

  it('leave a venue that names its own place alone', () => {
    const url = directionsUrl('Hotel Gateway, Vijayawada', address)!;
    expect(decodeURIComponent(url.split('query=')[1]!)).toBe('Hotel Gateway, Vijayawada');
  });

  it('give no link for an online or empty venue', () => {
    expect(directionsUrl('Online — link sent on registration', address)).toBeNull();
    expect(directionsUrl(null, address)).toBeNull();
    expect(directionsUrl('  ', address)).toBeNull();
  });
});

describe('event and job status', () => {
  it('agrees with the public pages on what an online venue is', () => {
    for (const v of ['Alumni Meet Hall', 'Online — link sent on registration', 'Zoom', 'Google Meet', 'Main Auditorium', null]) {
      expect(isOnlineVenue(v), String(v)).toBe(publicIsOnlineVenue(v));
    }
  });

  it('counts seats only for a capped event', () => {
    expect(seatStatus({ capacity: 40, registeredCount: 40 })).toMatchObject({ capped: true, full: true, left: 0 });
    expect(seatStatus({ capacity: 120, registeredCount: 118 })).toMatchObject({ left: 2, full: false });
    expect(seatStatus({ capacity: null, registeredCount: 87 })).toMatchObject({ capped: false, left: null });
  });

  it('calls a posting fresher-friendly for internships, a range from 0, or "Fresher"', () => {
    expect(isFresherFriendly({ isInternship: true, experienceYears: null })).toBe(true);
    expect(isFresherFriendly({ isInternship: false, experienceYears: '0–2 years' })).toBe(true);
    expect(isFresherFriendly({ isInternship: false, experienceYears: 'Fresher' })).toBe(true);
    expect(isFresherFriendly({ isInternship: false, experienceYears: '1–3 years' })).toBe(false);
    expect(isFresherFriendly({ isInternship: false, experienceYears: '10+ years' })).toBe(false);
  });

  it('gives a notification a verb only when it has somewhere to go', () => {
    expect(notificationAction({ kind: 'connection', href: '/connections' })).toBe('Reply');
    expect(notificationAction({ kind: 'event', href: '/events/x' })).toBe('See event');
    expect(notificationAction({ kind: 'system', href: null })).toBeNull();
  });
});
