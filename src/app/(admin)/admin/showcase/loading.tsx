import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function AdminShowcaseLoading() {
  return <PageSkeleton label="the showcase" cards={3} />;
}
