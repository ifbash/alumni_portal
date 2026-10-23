import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function AdminGroupsLoading() {
  return <PageSkeleton label="groups" cards={4} />;
}
