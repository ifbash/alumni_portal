import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function InviteLoading() {
  return <PageSkeleton label="invitations" cards={3} />;
}
