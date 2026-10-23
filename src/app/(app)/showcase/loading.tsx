import { PageSkeleton } from '@/components/community/PageSkeleton';

export default function ShowcaseLoading() {
  return <PageSkeleton label="the showcase" cards={6} />;
}
