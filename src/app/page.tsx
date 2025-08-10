

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
import { Map, Sparkles, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import TopPerformersList from '@/components/top-performers-list';
import TopPerformerMarquee from '@/components/top-performer-marquee';
import TopMandalMarquee from '@/components/top-mandal-marquee';

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
          <div className="col-span-1">
            <Suspense fallback={<PostComposerSkeleton />}>
              <PostComposerWithSession />
            </Suspense>
          </div>
           <div className="col-span-2 grid grid-cols-3 gap-2 sm:gap-4">
              <Button variant="outline" asChild className="h-full text-base shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300 flex-col sm:flex-row gap-2">
                  <Link href="/map">
                      <Map className="h-5 w-5 sm:h-6 sm:w-6 text-primary"/>
                      <span className="text-xs sm:text-sm">Live Map</span>
                  </Link>
              </Button>
              <Button variant="outline" asChild className="h-full text-base shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300 flex-col sm:flex-row gap-2">
                  <Link href="/helper">
                      <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-accent"/>
                      <span className="text-xs sm:text-sm">AI Helper</span>
                  </Link>
              </Button>
               <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-full text-base shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300 flex-col sm:flex-row gap-2">
                      <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500"/>
                      <span className="text-xs sm:text-sm">LP Ranks</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader>
                          <DialogTitle className="flex items-center">
                            <Trophy className="mr-2 h-6 w-6 text-yellow-500"/>
                            Top Performers
                          </DialogTitle>
                          <DialogDescription>
                              The top 10 users with the most LP Points.
                          </DialogDescription>
                      </DialogHeader>
                      <Suspense fallback={<TopPerformersList.Skeleton />}>
                        <TopPerformersList />
                      </Suspense>
                  </DialogContent>
               </Dialog>
           </div>
        </div>
        
        <div className="space-y-2">
          <Suspense fallback={<div className="h-10" />}>
              <TopPerformerMarquee />
          </Suspense>
          <Suspense fallback={<div className="h-10" />}>
            <TopMandalMarquee />
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
