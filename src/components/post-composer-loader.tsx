
'use client';

import type { FC } from 'react';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Zap } from 'lucide-react';
import type { User } from '@/lib/db-types';
import { cn } from '@/lib/utils';

// The skeleton now represents the trigger button, not the full composer.
export const PostComposerSkeleton = () => (
    <Skeleton className="h-full w-full rounded-xl" />
);

const PostComposer = dynamic(() => import('@/components/post-composer'), {
  // Skeleton for the content inside the dialog when it's opening
  loading: () => (
    <div className="p-5 space-y-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-12 w-full" />
    </div>
  ),
});

interface PostComposerLoaderProps {
    sessionUser: User | null;
}

const PostComposerLoader: FC<PostComposerLoaderProps> = ({ sessionUser }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handlePostSuccess = () => {
        setIsDialogOpen(false);
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button id="post-composer-button" variant="outline" className={cn(
                    "w-full h-full justify-center p-2 rounded-xl shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300",
                    "flex flex-col sm:flex-row items-center gap-2 sm:gap-3"
                )}>
                    <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                        <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <span className="text-muted-foreground text-xs sm:text-sm font-semibold">Share Pulse</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-semibold text-primary flex items-center">
                        <Zap className="w-7 h-7 mr-2 text-accent drop-shadow-sm" />
                        Share Your Pulse
                    </DialogTitle>
                    <DialogDescription>
                      Create and share a new post with your community. Add content, tags, and media.
                    </DialogDescription>
                </DialogHeader>
                <PostComposer sessionUser={sessionUser} onPostSuccess={handlePostSuccess} />
            </DialogContent>
        </Dialog>
    );
};

export default PostComposerLoader;
