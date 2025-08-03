
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

const MandalMediaViewer: React.FC<MandalMediaViewerProps> = ({ posts }) => {
  const [index, setIndex] = useState(0);

  const allMedia = posts.flatMap(post => 
    (post.mediaurls || []).map(url => ({
      id: post.id,
      type: post.mediatype,
      url: url,
    }))
  );

  if (allMedia.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground bg-muted/50 rounded-lg">
        <ImageIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p className="font-semibold">No Media Yet</p>
        <p className="text-sm">The Mandal admin has not posted any photos or videos.</p>
      </div>
    );
  }

  const currentMedia = allMedia[index];
  
  const goToNext = () => {
    setIndex(prev => (prev + 1) % allMedia.length);
  };
  
  const goToPrev = () => {
    setIndex(prev => (prev - 1 + allMedia.length) % allMedia.length);
  };

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-lg border bg-black/80 shadow-inner">
      <AnimatePresence initial={false}>
        <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
        >
            {currentMedia.type === 'video' ? (
                <video
                    key={currentMedia.url}
                    src={currentMedia.url}
                    controls
                    className="w-full h-full object-contain"
                />
            ) : (
                <Image
                    key={currentMedia.url}
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
                <Button variant="secondary" size="icon" onClick={goToPrev} className="h-8 w-8 rounded-full opacity-70 hover:opacity-100 transition-opacity">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
            </div>
            <div className="absolute top-1/2 right-2 -translate-y-1/2 z-10">
                <Button variant="secondary" size="icon" onClick={goToNext} className="h-8 w-8 rounded-full opacity-70 hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/60 text-white text-xs rounded-md backdrop-blur-sm z-10">
                {index + 1} / {allMedia.length}
            </div>
        </>
      )}
    </div>
  );
};

export default MandalMediaViewer;

