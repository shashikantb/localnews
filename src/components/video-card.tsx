
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Post } from '@/lib/db-types';

interface VideoCardProps {
  post: Post;
}

export default function VideoCard({ post }: VideoCardProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                setShouldLoad(true); // Load video src only when visible
            } else {
                setIsVisible(false);
            }
        });
      },
      { threshold: 0.5 } // 50% visible = considered in viewport
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (isVisible) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isVisible]);

  const handleClick = () => {
    router.push(`/reels?id=${post.id}`);
  };

  return (
    <div ref={containerRef} className="relative w-full h-auto cursor-pointer" onClick={handleClick}>
      {shouldLoad ? (
        <video
          ref={videoRef}
          src={post.mediaurls?.[0]}
          muted
          loop
          playsInline
          className="w-full h-auto rounded-lg"
        />
      ) : (
        <img
          src={post.mediaurls?.[0]?.replace('.mp4', '.jpg') || '/images/placeholder.png'}
          alt="Video thumbnail"
          className="w-full h-auto rounded-lg aspect-video object-cover"
        />
      )}
    </div>
  );
}
