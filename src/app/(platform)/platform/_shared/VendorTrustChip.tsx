import { ShieldCheck } from 'lucide-react';

import { TrustChip } from '@/components/ui';
import { capabilitiesFor, type Capability } from '@/lib/auth/permissions';
import { housePack } from '@/lib/branding/registry';
import { capitalise, vendorLabel } from '@/lib/branding/copy';

/**
 * The platform's one promise, stated once per page.
 *
 * The list inside is read from the capability matrix, not typed here, so
 * the chip cannot keep saying "three things" after a fourth has been
 * granted. A capability with no plain label shows its id: if the vendor
 * ever gains one, that is exactly what the person reading should see.
 */

const PLAIN: Partial<Record<Capability, string>> = {
  'tenant.provision': 'Set up colleges',
  'tenant.configure': 'Configure a college’s look and modules',
  'audit.read': 'Read the audit log for incident response',
};

export function VendorTrustChip({ className }: { className?: string }) {
  const who = vendorLabel(housePack().copy);
  // "ifBash" keeps its case; the default "the portal provider" starts a sentence.
  const lead = who.startsWith('the ') ? capitalise(who) : who;
  const allowed = [...capabilitiesFor(['platform_admin'])].map((c) => PLAIN[c] ?? c);

  return (
    <TrustChip
      icon={<ShieldCheck />}
      className={className}
      detail={
        <div className="space-y-2">
          <p className="font-medium text-primary">What {who} staff can do here</p>
          <ul className="list-disc space-y-1 pl-4">
            {allowed.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <p>Nothing here opens a member’s profile, contact details or the directory. Those stay with each college’s own staff.</p>
        </div>
      }
    >
      {lead} cannot read member data
    </TrustChip>
  );
}
