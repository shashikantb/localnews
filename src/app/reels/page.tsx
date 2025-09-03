
import type { FC } from 'react';
import { Suspense } from 'react';
import { ReelsPageSkeleton } from '@/components/reels-page-skeleton';
import ReelsViewer from '@/components/reels-viewer';
import { getSession } from '../auth/actions';
import { getMediaPosts, getFamilyPosts, getPosts } from '@/app/actions';
import type { Post } from '@/lib/db-types';

export const dynamic = 'force-dynamic';

interface ReelsPageProps {
  searchParams: {
    id?: string;
    feedType?: 'nearby' | 'family';
  };
}

async function ReelsLoader({ searchParams }: ReelsPageProps) {
  const { user: sessionUser } = await getSession();
  
  let posts: Post[] = [];
  const feedType = searchParams.feedType;

  if (feedType === 'family') {
      if (sessionUser) {
        posts = await getFamilyPosts({ page: 1, limit: 100 }); // Fetch all family posts
      }
  } else if (feedType === 'nearby') {
      posts = await getPosts({ page: 1, limit: 100 }); // Fetch all nearby posts
  } else {
      // Default case for when user clicks the "Reels" tab directly
      posts = await getMediaPosts({ page: 1, limit: 100 }); 
  }

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

    