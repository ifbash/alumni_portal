import { getAuditLog } from '@/lib/data/repo';
import type { AuditEntry } from '@/lib/data/types';

/**
 * Sent messages, read back out of the audit log.
 *
 * There is no messages table: a broadcast leaves exactly one durable
 * trace, its audit entry, and that entry is the record. Two shapes of
 * entry exist, and this adapter reads both so no screen has to know:
 *
 *  - The seed's `comms.send` rows carry everything in `reason`, as
 *    "Subject · 214 recipients" (older rows use an em dash).
 *  - `POST /api/admin/comms` writes `comms.send.<tier>` with `reason`
 *    null and the details in `after`: channel, subject, recipientCount,
 *    segment, segmentLabel, senderTier, bodyPreview.
 *
 * Every read goes through the existing `getAuditLog`; callers gate it on
 * `audit.read` before calling anything here.
 */

export const SEND_ACTIONS = ['comms.send', 'comms.send.all', 'comms.send.segment', 'comms.send.department'] as const;

export type SendChannel = 'email' | 'whatsapp';
export type SendTier = 'all' | 'segment' | 'department';

export interface SentSegment {
  cohort?: 'all' | 'alumni' | 'students';
  department?: string;
  batchFrom?: number;
  batchTo?: number;
  city?: string;
  availability?: 'mentoring' | 'referrals' | 'speaking';
}

export interface SentMessage {
  /** The audit entry id. It is the message's address: /admin/comms/{id}. */
  id: string;
  subject: string;
  channel: SendChannel;
  /** "Alumni in CSE, batches 2015–2018". Null when the entry did not record it. */
  audience: string | null;
  recipients: number | null;
  sender: string | null;
  sentAt: string;
  /** The first characters of the body, as the API stored them. Null when not stored. */
  bodyPreview: string | null;
  /** Whether the stored preview is shorter than what was sent. */
  bodyTruncated: boolean;
  segment: SentSegment | null;
}

/** "Subject · 214 recipients" or "Subject — 8,142 recipients". */
const REASON = /^(.*?)\s*[·—–-]\s*([\d,]+)\s*recipients?\s*$/i;

function parseReason(reason: string | null): { subject: string | null; recipients: number | null } {
  if (!reason) return { subject: null, recipients: null };
  const m = REASON.exec(reason.trim());
  if (!m) return { subject: reason.trim() || null, recipients: null };
  return { subject: m[1]!.trim() || null, recipients: Number(m[2]!.replace(/,/g, '')) };
}

function record(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function readSegment(v: unknown): SentSegment | null {
  const s = record(v);
  if (!s) return null;
  const out: SentSegment = {};
  if (s.cohort === 'all' || s.cohort === 'alumni' || s.cohort === 'students') out.cohort = s.cohort;
  if (str(s.department)) out.department = str(s.department)!;
  if (num(s.batchFrom)) out.batchFrom = num(s.batchFrom)!;
  if (num(s.batchTo)) out.batchTo = num(s.batchTo)!;
  if (str(s.city)) out.city = str(s.city)!;
  if (s.availability === 'mentoring' || s.availability === 'referrals' || s.availability === 'speaking') {
    out.availability = s.availability;
  }
  return out;
}

/** One audit entry, whichever shape it has, as a sent message. */
export function readSend(entry: AuditEntry): SentMessage {
  const after = record(entry.after);
  const fromReason = parseReason(entry.reason);
  const bodyPreview = str(after?.bodyPreview);
  const bodyLength = num(after?.bodyLength);

  return {
    id: entry.id,
    subject: str(after?.subject) ?? fromReason.subject ?? 'Untitled message',
    channel: after?.channel === 'whatsapp' ? 'whatsapp' : 'email',
    audience: str(after?.segmentLabel),
    recipients: num(after?.recipientCount) ?? fromReason.recipients,
    sender: entry.actorName,
    sentAt: entry.createdAt,
    bodyPreview,
    bodyTruncated: Boolean(bodyPreview && bodyLength && bodyLength > bodyPreview.length),
    segment: readSegment(after?.segment),
  };
}

/** The most recent sends across all four actions, newest first. */
export function listSends(limit = 12): SentMessage[] {
  return SEND_ACTIONS.flatMap((action) => getAuditLog({ action, limit }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(readSend);
}

/** A send written by the API (`comms.send.<tier>`), by entry id or resource id. */
export function findTierSend(id: string): AuditEntry | undefined {
  for (const action of SEND_ACTIONS.slice(1)) {
    const hit = getAuditLog({ action, limit: 10000 }).find((e) => e.id === id || e.resourceId === id);
    if (hit) return hit;
  }
  return undefined;
}

/** The composer query that recreates a send's segment, for "Send a follow-up". */
export function segmentQuery(segment: SentSegment | null): string {
  if (!segment) return '';
  const qs = new URLSearchParams();
  if (segment.cohort && segment.cohort !== 'all') qs.set('cohort', segment.cohort);
  if (segment.department) qs.set('department', segment.department);
  if (segment.batchFrom) qs.set('batchFrom', String(segment.batchFrom));
  if (segment.batchTo) qs.set('batchTo', String(segment.batchTo));
  if (segment.city) qs.set('city', segment.city);
  if (segment.availability) qs.set('availability', segment.availability);
  const q = qs.toString();
  return q ? `?${q}` : '';
}
