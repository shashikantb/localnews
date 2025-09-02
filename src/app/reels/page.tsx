
import type { FC } from 'react';
import { Suspense } from 'react';
import { ReelsPageSkeleton } from '@/components/reels-page-skeleton';
import ReelsViewer from '@/components/reels-viewer';
import { getSession } from '../auth/actions';
import { getMediaPosts } from '@/app/actions';

export const dynamic = 'force-dynamic';

interface ReelsPageProps {
  searchParams: {
    id?: string;
  };
}

// This component now fetches all media posts and determines the starting point.
async function ReelsLoader({ searchParams }: ReelsPageProps) {
  const { user: sessionUser } = await getSession();
  const posts = await getMediaPosts({ page: 1, limit: 100 }); // Fetch a large number of posts for the viewer

  let initialIndex = 0;
  if (searchParams.id) {
    const foundIndex = posts.findIndex(p => p.id.toString() === searchParams.id);
    if (foundIndex !== -1) {
      initialIndex = foundIndex;
    }
  }

  if (posts.length === 0) {
     return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4 text-center">
            <h2 className="text-2xl font-semibold">No Reels Yet</h2>
            <p className="text-muted-foreground">Check back later for new video and image posts!</p>
        </div>
     )
  }

  return <ReelsViewer sessionUser={sessionUser} initialPosts={posts} initialIndex={initialIndex} />;
}

const ReelsPage: FC<ReelsPageProps> = ({ searchParams }) => {
  return (
    <div className="h-[calc(100svh-7rem)]">
        <Suspense fallback={<ReelsPageSkeleton />}>
          <ReelsLoader searchParams={searchParams} />
        </Suspense>
    </div>
  );
};

export default ReelsPage;
