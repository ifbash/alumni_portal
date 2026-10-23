import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function AdminCommunityLoading() {
  return <PageSkeleton label="the moderation queue" cards={3} />;
}
