import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function GroupsLoading() {
  return <PageSkeleton label="groups" cards={6} />;
}
