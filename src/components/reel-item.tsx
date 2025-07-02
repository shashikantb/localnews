
'use client';
import React, { type FC } from 'react'; // Import React
import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Post, Comment as CommentType, User } from '@/lib/db-types';
import { formatDistanceToNowStrict } from 'date-fns';
import { UserCircle, MessageCircle, Share2, ThumbsUp, PlayCircle, VolumeX, Volume2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleLikePost, likePostAnonymously } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReelCommentsSkeleton } from './reel-comments-skeleton';

const ReelComments = dynamic(() => import('./reel-comments'), {
    loading: () => <ReelCommentsSkeleton />,
    ssr: false,
});


const getAnonymousLikedPosts = (): number[] => {
    if (typeof window === "undefined") return [];
    try {
        const item = window.localStorage.getItem('localpulse-anonymous-likes');
        return item ? JSON.parse(item) : [];
    } catch (error) {
        console.warn("Error reading anonymous likes from localStorage", error);
        return [];
    }
};

interface ReelItemProps {
  post: Post;
  isActive: boolean;
  sessionUser: User | null;
}

export const ReelItem: FC<ReelItemProps> = ({ post, isActive, sessionUser }) => {
  const { toast } = useToast();
  const timeAgo = formatDistanceToNowStrict(new Date(post.createdat), { addSuffix: true });

  const [isLikedByClient, setIsLikedByClient] = useState(false);
  const [displayLikeCount, setDisplayLikeCount] = useState<number>(post.likecount);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [displayCommentCount, setDisplayCommentCount] = useState<number>(post.commentcount);
  const [showComments, setShowComments] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInternallyMuted, setIsInternallyMuted] = useState(true); // Default to muted for better autoplay
  const [mediaError, setMediaError] = useState(false);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);
  
  // This effect resets the state of the component when the post prop changes.
  useEffect(() => {
    setDisplayLikeCount(post.likecount);
    setDisplayCommentCount(post.commentcount);
    if (sessionUser) {
        setIsLikedByClient(post.isLikedByCurrentUser || false);
    } else {
        setIsLikedByClient(getAnonymousLikedPosts().includes(post.id));
    }
    // Reset interaction states for the new reel
    setShowComments(false);
    setIsInternallyMuted(true);
    setMediaError(false);
  }, [post.id, post.likecount, post.commentcount, post.isLikedByCurrentUser, sessionUser]);


  useEffect(() => {
    const videoElement = videoRef.current;
    // Do not control video if it's an iframe or not the active reel
    if (!videoElement || post.mediatype !== 'video' || post.mediaurl?.includes('youtube.com/embed')) {
      return;
    }

    if (isActive) {
      // This reel is active, so we try to play it.
      videoElement.muted = isInternallyMuted;
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Unmuted autoplay failed. Muting and retrying.", error);
          if (videoElement) { 
            setIsInternallyMuted(true);
            videoElement.muted = true;
            videoElement.play().catch(finalError => {
               console.error("Muted autoplay also failed.", finalError);
            })
          }
        });
      }
    } else {
      // This reel is not active, just pause it.
      videoElement.pause();
    }
  }, [isActive, post.mediatype, post.mediaurl, isInternallyMuted]);
  
  const handleRetryVideo = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the main video tap handler from firing
    if (videoRef.current) {
        setMediaError(false);
        videoRef.current.load();
        videoRef.current.play().catch(err => console.error("Retry play failed", err));
    }
  };

  const handleLikeClick = async () => {
    if (isLiking) return;
    setIsLiking(true);

    try {
        if (sessionUser) {
            // --- LOGGED-IN USER ---
            const result = await toggleLikePost(post.id);
            if (result.error || !result.post) {
                toast({ variant: 'destructive', title: 'Error', description: result.error || 'Could not update like.' });
            } else {
                // Update UI from server's response
                setDisplayLikeCount(result.post.likecount);
                setIsLikedByClient(result.post.isLikedByCurrentUser || false);
            }
        } else {
            // --- ANONYMOUS USER ---
            if (getAnonymousLikedPosts().includes(post.id)) {
                toast({ title: "You've already liked this post." });
                return;
            }
            const result = await likePostAnonymously(post.id);
            if (result.error || !result.post) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not like post.' });
            } else {
                // Success, save to localStorage and update UI from server's response
                const currentLikes = getAnonymousLikedPosts();
                window.localStorage.setItem('localpulse-anonymous-likes', JSON.stringify([...currentLikes, post.id]));
                setDisplayLikeCount(result.post.likecount);
                setIsLikedByClient(true);
            }
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected server error occurred.' });
    } finally {
        setIsLiking(false);
    }
  };

  const handleShare = async () => {
    const postUrl = `${currentOrigin}/posts/${post.id}`;
    const shareData = {
      title: 'Check out this LocalPulse Reel!',
      text: post.content,
      url: postUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(postUrl);
        toast({ title: "Link Copied!", description: "The link to this reel has been copied." });
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "Could not copy link." });
      }
    }
  };

  const handleVideoTap = () => {
    if (videoRef.current) {
      const currentVideo = videoRef.current;
      if (currentVideo.paused) {
        currentVideo.play().catch(error => {
          console.warn("Play on tap failed. Autoplay might be strictly blocked.", error);
        });
      } else {
        const newMutedState = !currentVideo.muted;
        currentVideo.muted = newMutedState;
        setIsInternallyMuted(newMutedState);
      }
    }
  };
  
  const handleCommentPosted = (newComment: CommentType) => {
    setDisplayCommentCount(prev => prev + 1);
  };
  
  const isYouTubeVideo = post.mediaurl?.includes('youtube.com/embed');

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black relative text-white">
      <div className="w-full flex-grow flex items-center justify-center overflow-hidden relative" onClick={handleVideoTap}>
        {post.mediatype === 'image' && post.mediaurl && (
          <Image
            src={post.mediaurl}
            alt="Reel image"
            fill
            style={{ objectFit: "contain" }}
            sizes="100vw"
            priority={isActive}
            data-ai-hint="user generated content"
          />
        )}
        {post.mediatype === 'video' && post.mediaurl && (
          <>
            {isYouTubeVideo ? (
              <iframe
                src={`${post.mediaurl}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${post.mediaurl.split('/').pop()}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={post.mediaurl}
                  loop
                  playsInline // Important for iOS
                  preload="auto"
                  onError={() => setMediaError(true)}
                  className={cn("w-full h-full object-contain", mediaError && "invisible")}
                />
                 {mediaError && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white p-4 z-20">
                        <AlertTriangle className="w-12 h-12 mb-3 text-yellow-400" />
                        <p className="text-base font-semibold mb-4 text-center">This Reel could not be loaded.</p>
                        <Button onClick={handleRetryVideo} variant="secondary">
                            <RefreshCw className="w-4 h-4 mr-2"/>
                            Try Again
                        </Button>
                    </div>
                )}
                {!mediaError && (
                  <>
                    <div 
                      className="absolute top-4 right-4 p-2 bg-black/50 rounded-full cursor-pointer z-10"
                      onClick={(e) => { e.stopPropagation(); handleVideoTap(); }}
                    >
                      {isInternallyMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                    </div>
                    {videoRef.current?.paused && isActive && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                            <PlayCircle className="w-16 h-16 text-white/50 backdrop-blur-sm rounded-full" />
                        </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-16 left-0 right-0 p-4 pb-2 bg-gradient-to-t from-black/60 via-black/30 to-transparent flex justify-between items-end">
        <div className="flex-1 space-y-1.5 max-w-[calc(100%-5rem)]">
          <div className="flex items-center space-x-2">
            <Avatar className="h-9 w-9 border-2 border-white/60">
              <AvatarFallback className="bg-gray-700 text-sm">
                <UserCircle className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{post.authorname || 'Anonymous Pulsar'}</p>
              <p className="text-xs text-gray-300">{timeAgo} {post.city && post.city !== "Unknown City" ? `· ${post.city}`: ''}</p>
            </div>
          </div>
          <p className="text-sm leading-tight line-clamp-2 whitespace-pre-wrap break-words">{post.content}</p>
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 max-h-10 overflow-y-hidden">
              {post.hashtags.slice(0,3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/80 hover:bg-white/20 border-none backdrop-blur-sm">
                   {tag.replace('#','')}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-3 items-center z-10">
            <Button variant="ghost" size="sm" onClick={handleLikeClick} disabled={isLiking || (!sessionUser && isLikedByClient)} className="flex flex-col items-center text-white hover:text-pink-400 p-1 h-auto disabled:opacity-50">
              <ThumbsUp className={cn("w-6 h-6", isLikedByClient ? "text-pink-500 fill-pink-500" : "")} />
              <span className="font-medium text-xs mt-0.5">{displayLikeCount}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowComments(true); }} className="flex flex-col items-center text-white hover:text-cyan-400 p-1 h-auto">
              <MessageCircle className="w-6 h-6" />
              <span className="font-medium text-xs mt-0.5">{displayCommentCount}</span>
            </Button>
             <Button variant="ghost" size="sm" onClick={handleShare} className="flex flex-col items-center text-white hover:text-blue-400 p-1 h-auto">
              <Share2 className="w-6 h-6" />
               <span className="font-medium text-xs mt-0.5">Share</span>
            </Button>
        </div>
      </div>

      {showComments && (
        <ReelComments
            postId={post.id}
            sessionUser={sessionUser}
            onClose={() => setShowComments(false)}
            onCommentPosted={handleCommentPosted}
            initialCommentCount={post.commentcount}
        />
      )}
    </div>
  );
};
