import { getSession } from '@/lib/auth/session';
import { require as requireCap } from '@/lib/auth/guard';
import { getGroupBySlug, getGroupMembers } from '@/lib/data/groups';
import { GroupLead } from '@/lib/schemas/groups';
import { logAudit } from '@/lib/audit/log';
import { clientIp, fail, fixtureWrite, HttpError, json, limit, readJson } from '../../../../_lib/http';
import { requireFeature } from '../../../../_lib/feature';

/**
 * Appoint or relieve a lead.
 *
 * Leads approve join requests and write on their group's behalf, so who
 * holds the role is a decision for the people who run groups, not for the
 * leads themselves. The person has to be an active member already: a lead
 * is somebody the group knows, not an outsider given a key.
 *
 * Only alumni and faculty can lead. A student leading an alumni-facing
 * group would hold the power to approve who sees its roster.
 */

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    requireCap(session, 'group.manage');
    const { tenant } = await requireFeature('groups', 'Groups are');

    const { slug } = await params;
    const { memberId, role } = await readJson(request, GroupLead);
    limit(`group-lead:${session.memberId}`, 120, 60 * 60, 'A hundred and twenty changes in an hour is the limit.');

    const group = getGroupBySlug(session, slug);
    if (!group) throw new HttpError(404, 'not_found', 'There is no group at that address.');

    const member = getGroupMembers(session, slug).find((m) => m.member.id === memberId);
    if (!member) {
      throw new HttpError(404, 'not_found', 'That person is not an active member of this group. They have to join before they can lead it.');
    }
    if (member.member.isStudent && role === 'lead') {
      throw new HttpError(422, 'invalid_input', 'A student cannot lead a group. Pick an alumnus or a member of faculty.', {
        fieldErrors: { memberId: 'Choose an alumnus or faculty member.' },
      });
    }
    if (member.role === role) {
      throw new HttpError(409, 'no_change', role === 'lead' ? 'They already lead this group.' : 'They are not a lead.');
    }

    await logAudit({
      tenantId: tenant.id,
      session,
      action: role === 'lead' ? 'group.lead.appoint' : 'group.lead.relieve',
      resource: 'group_members',
      resourceId: `${group.id}:${memberId}`,
      before: { role: member.role },
      after: { role },
      ip: request.headers.get('x-forwarded-for') ?? clientIp(request),
    });

    const write = fixtureWrite();
    return json({
      ok: true,
      ...write,
      lead: { groupSlug: slug, memberId, role },
      note: role === 'lead' ? 'Appointed. They can now approve requests and write for the group.' : 'Relieved. They stay in the group as a member.',
    });
  } catch (err) {
    return fail(err);
  }
}
