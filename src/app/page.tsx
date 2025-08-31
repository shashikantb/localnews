
import type { FC } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { getSession } from './auth/actions';
import PostComposerLoader, { PostComposerSkeleton } from '@/components/post-composer-loader';
import PostFeedLoader from '@/components/post-feed-loader';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';
import StatusFeed from '@/components/status-feed';
import { StatusFeedSkeleton } from '@/components/status-feed-skeleton';
import { getPosts } from './actions';
import { Button } from '@/components/ui/button';
import { Map, Sparkles, Trophy, HandPlatter, Zap } from 'lucide-react';
import TopPerformerMarquee from '@/components/top-performer-marquee';


async function PostComposerWithSession() {
  const { user } = await getSession();
  return <PostComposerLoader sessionUser={user} />;
}

async function StatusFeedWithSession() {
  const { user } = await getSession();
  return <StatusFeed sessionUser={user} />;
}

async function PostFeedWithInitialData() {
  const { user } = await getSession();
  // Fetching initial posts to pass to the client component for a faster initial load.
  const initialPosts = await getPosts({ page: 1, limit: 5 });
  return <PostFeedLoader sessionUser={user} initialPosts={initialPosts} />;
}


const HomePage: FC = () => {
  return (
    <div className="flex flex-col items-center">
      <div className="container mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6 md:p-8">
        
        <Suspense fallback={<StatusFeedSkeleton />}>
          <StatusFeedWithSession />
        </Suspense>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Suspense fallback={<PostComposerSkeleton />}>
              <PostComposerWithSession />
            </Suspense>
            <Button variant="outline" asChild className="h-full text-base shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300 flex-col gap-2 p-2">
                <Link href="/map">
                    <Map className="h-5 w-5 sm:h-6 sm:w-6 text-primary"/>
                    <span className="text-xs sm:text-sm text-center">Live Map</span>
                </Link>
            </Button>
            <Button variant="outline" asChild className="h-full text-base shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300 flex-col gap-2 p-2">
                <Link href="/?tab=services">
                    <HandPlatter className="h-5 w-5 sm:h-6 sm:w-6 text-accent"/>
                    <span className="text-xs sm:text-sm text-center">Book Services</span>
                </Link>
            </Button>
        </div>
        
        <div className="space-y-2">
          <Suspense fallback={<div className="h-10" />}>
              <TopPerformerMarquee />
          </Suspense>
        </div>

        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeedWithInitialData />
        </Suspense>
      </div>
    </div>
  );
};

export default HomePage;
