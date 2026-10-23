import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function CommunityLoading() {
  return <PageSkeleton label="the community feed" cards={4} />;
}
