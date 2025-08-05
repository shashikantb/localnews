

'use client';

import React, { useState } from 'react';
import type { Post } from '@/lib/db-types';
import Image from 'next/image';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Video, ImageIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MandalMediaViewerProps {
  posts: Pick<Post, 'id' | 'mediaurls' | 'mediatype'>[];
}

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    };
  }
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};


const MandalMediaViewer: React.FC<MandalMediaViewerProps> = ({ posts }) => {
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(0);

  const allMedia = posts.flatMap(post => 
    (post.mediaurls || []).map(url => ({
      id: post.id,
      type: post.mediatype,
      url: url,
    }))
  );

  const paginate = (newDirection: number) => {
    setPage(page + newDirection);
    setDirection(newDirection);
  };
  
  // Robust way to wrap the index, preventing negative numbers.
  const imageIndex = (page % allMedia.length + allMedia.length) % allMedia.length;

  if (allMedia.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground bg-muted/50 rounded-lg">
        <ImageIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p className="font-semibold">No Media Yet</p>
        <p className="text-sm">The Mandal admin has not posted any photos or videos.</p>
      </div>
    );
  }

  const currentMedia = allMedia[imageIndex];
  
  // Add a defensive check in case something still goes wrong
  if (!currentMedia) {
    return (
        <div className="text-center py-10 text-destructive bg-destructive/10 rounded-lg">
            <p>Error: Could not load media.</p>
        </div>
    );
  }
  
  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-lg border bg-black/80 shadow-inner flex items-center justify-center">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
            key={page}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
                const swipe = swipePower(offset.x, velocity.x);
                if (swipe < -swipeConfidenceThreshold) {
                    paginate(1);
                } else if (swipe > swipeConfidenceThreshold) {
                    paginate(-1);
                }
            }}
            className="absolute w-full h-full"
        >
            {currentMedia.type === 'video' ? (
                <video
                    src={currentMedia.url}
                    controls
                    className="w-full h-full object-contain"
                />
            ) : (
                <Image
                    src={currentMedia.url}
                    alt="Mandal Media"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                    priority
                />
            )}
        </motion.div>
      </AnimatePresence>
      
      {allMedia.length > 1 && (
        <>
            <div className="absolute top-1/2 left-2 -translate-y-1/2 z-10">
                <Button variant="secondary" size="icon" onClick={() => paginate(-1)} className="h-8 w-8 rounded-full opacity-70 hover:opacity-100 transition-opacity">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
            </div>
            <div className="absolute top-1/2 right-2 -translate-y-1/2 z-10">
                <Button variant="secondary" size="icon" onClick={() => paginate(1)} className="h-8 w-8 rounded-full opacity-70 hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/60 text-white text-xs rounded-md backdrop-blur-sm z-10">
                {imageIndex + 1} / {allMedia.length}
            </div>
        </>
      )}
    </div>
  );
};

export default MandalMediaViewer;
