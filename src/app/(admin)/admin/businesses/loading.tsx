import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function AdminBusinessesLoading() {
  return <PageSkeleton label="business listings" cards={3} />;
}
