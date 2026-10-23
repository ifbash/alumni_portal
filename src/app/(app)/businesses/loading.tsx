import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function BusinessesLoading() {
  return <PageSkeleton label="businesses" cards={6} />;
}
