

'use client';
import type { FC } from 'react';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Post, User, Poll } from '@/lib/db-types';
import { formatDistanceToNowStrict, formatDistance } from 'date-fns';
import { MapPin, UserCircle, MessageCircle, Map, Share2, ThumbsUp, Tag, Eye, BellRing, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Image as ImageIcon, MoreHorizontal, Trash2, Megaphone, Zap, Clock, Check, X, Maximize, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleLikePost, recordPostView, likePostAnonymously, deleteUserPost, castVote } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import FollowButton from './follow-button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { useModalBack } from "@/hooks/useModalBack";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

const CommentSectionSkeleton = () => (
  <div className="px-5 pb-4 border-t border-border/30 pt-4 bg-muted/20 space-y-4">
    <Skeleton className="h-6 w-1/3" />
    <div className="flex items-start space-x-3">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <Skeleton className="h-20 w-full" />
    </div>
    <div className="space-y-3 pt-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  </div>
);

const CommentSection = dynamic(() => import('./comment-section'), {
  loading: () => <CommentSectionSkeleton />,
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

const Countdown: FC<{ expiryDate: string }> = ({ expiryDate }) => {
    const [timeLeft, setTimeLeft] = useState('');
    
    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = +new Date(expiryDate) - +new Date();
            if (difference > 0) {
                setTimeLeft(formatDistance(new Date(expiryDate), new Date(), { addSuffix: true, includeSeconds: true }));
            } else {
                setTimeLeft('Expired');
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        
        return () => clearInterval(timer);
    }, [expiryDate]);

    return <span>{timeLeft}</span>;
};


interface PostCardProps {
  post: Post;
  userLocation: { latitude: number; longitude: number } | null;
  sessionUser: User | null;
  isFirst?: boolean;
}

export const PostCard: FC<PostCardProps> = ({ post, userLocation, sessionUser, isFirst = false }) => {
  const { toast } = useToast();
  
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number | null => {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };
  
  const timeAgo = formatDistanceToNowStrict(new Date(post.createdat), { addSuffix: true });
  const distance = userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, post.latitude, post.longitude) : null;
  
  const authorName = post.authorname || 'Anonymous Pulsar';
  const isOwnPost = sessionUser?.id === post.authorid;
  const isAnnouncement = post.authorname === 'LocalPulse Official';
  const isRadarPost = post.expires_at || post.max_viewers;

  const [isLikedByClient, setIsLikedByClient] = useState(false);
  const [displayLikeCount, setDisplayLikeCount] = useState<number>(post.likecount);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [displayCommentCount, setDisplayCommentCount] = useState<number>(post.commentcount);
  const [showComments, setShowComments] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [pollState, setPollState] = useState<Poll | null | undefined>(post.poll);
  const [isVoting, setIsVoting] = useState(false);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);

  useModalBack(isMediaViewerOpen, () => setIsMediaViewerOpen(false), `post:${post.id}`);
  useBodyScrollLock(isMediaViewerOpen);

  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [wasViewed, setWasViewed] = useState(false);

  // More robust check for YouTube URLs, not dependent on mediatype.
  const isYouTubeVideo = post.mediaurls?.[0]?.includes('youtube.com/embed');
  const hasVisibleMedia = post.mediaurls && post.mediaurls.length > 0 && (isYouTubeVideo || ['image', 'video', 'gallery'].includes(post.mediatype || ''));


  useEffect(() => {
    setMediaError(false);
    setCurrentImageIndex(0);
  }, [post.id]);
  
  const handleRetryVideo = () => {
    if (videoRef.current) {
        setMediaError(false);
        videoRef.current.load();
        videoRef.current.play().catch(e => console.error("Video retry failed:", e));
    }
  };

  useEffect(() => {
    if (sessionUser && sessionUser.id === post.authorid) {
        return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !wasViewed) {
          recordPostView(post.id);
          setWasViewed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6 }
    );

    const currentCardRef = cardRef.current;
    if (currentCardRef) {
      observer.observe(currentCardRef);
    }

    return () => {
      if (currentCardRef) {
        observer.unobserve(currentCardRef);
      }
      observer.disconnect();
    };
  }, [post.id, wasViewed, sessionUser, post.authorid]);
  
  useEffect(() => {
      const videoElement = videoRef.current;
      if (!videoElement || isYouTubeVideo) return;

      const observer = new IntersectionObserver(
          (entries) => {
              const entry = entries[0];
              if (entry.isIntersecting) {
                  videoElement.play().catch(e => console.warn("Video autoplay was prevented.", e));
              } else {
                  videoElement.pause();
              }
          },
          { threshold: 0.5 } // Play when 50% of the video is visible
      );

      observer.observe(videoElement);

      return () => {
          observer.unobserve(videoElement);
      };
  }, [post.id, isYouTubeVideo]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);
  
  useEffect(() => {
    setDisplayLikeCount(post.likecount);
    setDisplayCommentCount(post.commentcount);
    setPollState(post.poll);
    if (sessionUser) {
        setIsLikedByClient(post.isLikedByCurrentUser || false);
    } else {
        setIsLikedByClient(getAnonymousLikedPosts().includes(post.id));
    }
  }, [post.isLikedByCurrentUser, post.likecount, post.commentcount, post.id, sessionUser, post.poll]);


  const handleLikeClick = async () => {
    if (isLiking) return;
    setIsLiking(true);

    const originalLikeState = isLikedByClient;
    const originalLikeCount = displayLikeCount;

    setIsLikedByClient(!originalLikeState);
    setDisplayLikeCount(prev => originalLikeState ? prev - 1 : prev + 1);

    try {
        const result = sessionUser 
            ? await toggleLikePost(post.id) 
            : await likePostAnonymously(post.id);

        if (result.error || !result.post) {
            setIsLikedByClient(originalLikeState);
            setDisplayLikeCount(originalLikeCount);
        } else {
            if (!sessionUser) {
                const currentLikes = getAnonymousLikedPosts();
                window.localStorage.setItem('localpulse-anonymous-likes', JSON.stringify([...currentLikes, post.id]));
            }
            setDisplayLikeCount(result.post.likecount);
            setIsLikedByClient(result.post.isLikedByCurrentUser || !sessionUser);
        }
    } catch (error) {
        setIsLikedByClient(originalLikeState);
        setDisplayLikeCount(originalLikeCount);
    } finally {
        setIsLiking(false);
    }
  };
  
  const handleDelete = async () => {
    const result = await deleteUserPost(post.id);
    if (result.success) {
      toast({
        title: 'Post Deleted',
        description: 'Your post has been successfully removed.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Post',
        description: result.error,
      });
    }
  };

  const handleShare = async () => {
    const postUrl = `${currentOrigin}/posts/${post.id}`;
    const shareData = {
      title: 'Check out this pulse!',
      text: post.content,
      url: postUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Share canceled or failed:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(postUrl);
        toast({ title: 'Link Copied!', description: 'The link to this pulse has been copied to your clipboard.' });
      } catch (err) {
        console.error("Failed to copy link:", err);
      }
    }
  };

    const handleVote = async (optionId: number) => {
        if (!pollState || isVoting || pollState.user_voted_option_id) return;
        setIsVoting(true);
        const result = await castVote(pollState.id, optionId);
        if (result.poll) {
            setPollState(result.poll);
        } else {
            toast({ variant: 'destructive', title: 'Vote failed', description: result.error });
        }
        setIsVoting(false);
    };

  const renderContentWithMentionsAndLinks = () => {
    let contentToRender = post.content;
    
    if (isYouTubeVideo && contentToRender) {
      const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})(?:\S+)?/;
      contentToRender = contentToRender.replace(ytRegex, '').trim();
    }

    if (!contentToRender) return null;

    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

    const mentionTexts = post.mentions?.map(m => `@${m.name}`) || [];
    const mentionRegex = mentionTexts.length > 0
      ? new RegExp(`(${mentionTexts.map(m => m.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'g')
      : null;

    const contentParts = [];
    let lastIndex = 0;

    const allMatches = [];
    for (const match of contentToRender.matchAll(urlRegex)) {
        allMatches.push({ type: 'url' as const, text: match[0], index: match.index! });
    }
    if (mentionRegex) {
        for (const match of contentToRender.matchAll(mentionRegex)) {
            allMatches.push({ type: 'mention' as const, text: match[0], index: match.index! });
        }
    }

    allMatches.sort((a, b) => a.index - b.index);

    const uniqueMatches = allMatches.filter((match, i, arr) => {
        if (i === 0) return true;
        const prevMatch = arr[i - 1];
        return match.index >= prevMatch.index + prevMatch.text.length;
    });

    if (uniqueMatches.length === 0) {
      return <p className="text-foreground/90 leading-relaxed text-base whitespace-pre-wrap break-words">{contentToRender}</p>;
    }

    for (const match of uniqueMatches) {
        if (match.index > lastIndex) {
            contentParts.push(contentToRender.substring(lastIndex, match.index));
        }

        if (match.type === 'url') {
            const href = match.text.startsWith('www.') ? `https://${match.text}` : match.text;
            contentParts.push(
                <a
                    key={`${match.type}-${match.index}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                >
                    {match.text}
                </a>
            );
        } else if (match.type === 'mention') {
            const mentionData = post.mentions?.find(m => `@${m.name}` === match.text);
            if (mentionData) {
                contentParts.push(
                    <Link
                        key={`${match.type}-${match.index}`}
                        href={`/users/${mentionData.id}`}
                        className="text-accent font-semibold hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {match.text}
                    </Link>
                );
            } else {
                contentParts.push(match.text);
            }
        }
        
        lastIndex = match.index + match.text.length;
    }

    if (lastIndex < contentToRender.length) {
        contentParts.push(contentToRender.substring(lastIndex));
    }

    return (
      <p className="text-foreground/90 leading-relaxed text-base whitespace-pre-wrap break-words">
        {contentParts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>)}
      </p>
    );
  };

  const nextImage = () => {
    if (post.mediaurls && post.mediaurls.length > 1) {
        setCurrentImageIndex((prev) => (prev + 1) % post.mediaurls!.length);
    }
  };

  const prevImage = () => {
    if (post.mediaurls && post.mediaurls.length > 1) {
        setCurrentImageIndex((prev) => (prev - 1 + post.mediaurls!.length) % post.mediaurls!.length);
    }
  };


  return (
    <>
      {isMediaViewerOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setIsMediaViewerOpen(false)}
        >
          <div className="relative w-full h-full max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {isYouTubeVideo ? (
              <iframe src={post.mediaurls[0]} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="w-full h-full max-w-4xl aspect-video mx-auto"></iframe>
            ) : post.mediatype === 'image' ? (
              <Image src={post.mediaurls[0]} alt="Post image" fill style={{ objectFit: "contain" }} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 600px, 700px" />
            ) : post.mediatype === 'gallery' ? (
              <div className="relative w-full h-full">
                <Image src={post.mediaurls[currentImageIndex]} alt={`Post image ${currentImageIndex + 1}`} fill style={{ objectFit: "contain" }} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 600px, 700px" />
                {post.mediaurls.length > 1 && (
                  <>
                    <div className="absolute top-1/2 left-2 -translate-y-1/2">
                        <Button variant="secondary" size="icon" onClick={(e) => { e.stopPropagation(); prevImage(); }} className="h-10 w-10 rounded-full opacity-70 hover:opacity-100 transition-opacity">
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                    </div>
                    <div className="absolute top-1/2 right-2 -translate-y-1/2">
                        <Button variant="secondary" size="icon" onClick={(e) => { e.stopPropagation(); nextImage(); }} className="h-10 w-10 rounded-full opacity-70 hover:opacity-100 transition-opacity">
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>
                  </>
                )}
              </div>
            ) : post.mediatype === 'video' ? (
              <video controls autoPlay src={post.mediaurls[0]} className="w-full h-full object-contain" />
            ) : null}
          </div>
          <Button 
            variant="destructive" 
            size="icon" 
            className="absolute top-4 right-4 h-10 w-10 rounded-full shadow-lg"
            onClick={() => setIsMediaViewerOpen(false)}
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Close media viewer</span>
          </Button>
        </div>
      )}

      <Card ref={cardRef} className={cn(
          "overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 ease-out border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm hover:border-primary/50 transform hover:scale-[1.005]",
          isAnnouncement && "bg-primary/5 border-primary/20",
          isRadarPost && "border-accent/50 bg-gradient-to-br from-accent/5 to-card"
      )}>
          {isRadarPost && (
              <div className="p-2 text-xs font-semibold text-center bg-accent/20 text-accent-foreground border-b border-accent/30 flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1.5">
                      <Zap className="h-4 w-4" />
                      <span>Pulse Radar</span>
                  </div>
                  {post.expires_at && (
                      <TooltipProvider>
                          <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1.5 cursor-default">
                                  <Clock className="h-4 w-4" />
                                  <Countdown expiryDate={post.expires_at} />
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>This pulse expires {new Date(post.expires_at).toLocaleString()}</p>
                              </TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
                  )}
                   {post.max_viewers && (
                      <TooltipProvider>
                          <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1.5 cursor-default">
                                  <Eye className="h-4 w-4" />
                                  <span>{post.viewcount} / {post.max_viewers}</span>
                              </TooltipTrigger>
                               <TooltipContent>
                                  <p>Viewed by {post.viewcount} of {post.max_viewers} max viewers.</p>
                              </TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
                  )}
              </div>
          )}
        <CardHeader className={cn(
            "pb-3 pt-5 px-5 flex flex-row items-start space-x-4",
            isAnnouncement ? "bg-primary/10" : "bg-gradient-to-br from-card to-muted/10",
            isRadarPost && "bg-transparent"
        )}>
          <Avatar className="h-12 w-12 border-2 border-primary/60 shadow-md">
            <AvatarImage src={post.authorprofilepictureurl ?? undefined} alt={authorName} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-bold text-xl">
              {isAnnouncement ? <Megaphone className="h-7 w-7 text-primary/80" /> : (authorName ? authorName.charAt(0).toUpperCase() : <UserCircle className="h-7 w-7 text-primary/80" />)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {post.authorid && !isAnnouncement ? (
                  <Link href={`/users/${post.authorid}`} className="text-sm text-primary font-semibold flex items-center hover:underline">
                    {authorName}
                  </Link>
                ) : (
                  <p className="text-sm text-primary font-semibold flex items-center">
                    {authorName}
                  </p>
                )}
                {sessionUser && post.authorid && !isOwnPost && !isAnnouncement && (
                    <FollowButton 
                        targetUserId={post.authorid} 
                        initialIsFollowing={!!post.isAuthorFollowedByCurrentUser} 
                    />
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground font-medium flex-shrink-0 ml-2">
                {timeAgo}
              </CardDescription>
            </div>
              {isAnnouncement ? (
                  <Badge variant="default" className="mt-1">Official Announcement</Badge>
              ) : !post.hide_location && post.city && post.city !== "Unknown City" && (
                   <p className="text-sm text-muted-foreground flex items-center mt-0.5">
                      <MapPin className="w-4 h-4 mr-1.5 text-primary/70 flex-shrink-0" /> {post.city}
                  </p>
              )}
          </div>
          <div className="ml-auto">
            {isOwnPost && (
              <AlertDialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <span className="sr-only">Post options</span>
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Post
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your post and all its data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                      Yes, delete post
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>

        {hasVisibleMedia && (
          <div className="px-5 pb-0 pt-2">
             <button onClick={() => setIsMediaViewerOpen(true)} className="w-full block">
                  <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border-2 border-border/50 shadow-inner bg-muted/50 group cursor-pointer">
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                      <Maximize className="w-10 h-10 text-white drop-shadow-lg" />
                    </div>
                    {isYouTubeVideo ? (
                        <iframe
                            src={post.mediaurls[0]}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="w-full h-full pointer-events-none"
                        ></iframe>
                    ) : post.mediatype === 'image' ? (
                        <Image src={post.mediaurls[0]} alt="Post image" fill style={{ objectFit: "contain" }} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 600px, 700px" className="transition-transform duration-300 group-hover:scale-105" data-ai-hint="user generated content" priority={isFirst} />
                    ) : post.mediatype === 'gallery' ? (
                        <>
                            <Image src={post.mediaurls[currentImageIndex]} alt={`Post image ${currentImageIndex + 1}`} fill style={{ objectFit: "contain" }} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 600px, 700px" className="transition-opacity duration-300" data-ai-hint="user generated content" priority={isFirst} />
                            {post.mediaurls.length > 1 && (
                                <>
                                    <div className="absolute top-1/2 left-2 -translate-y-1/2 z-10">
                                        <Button variant="secondary" size="icon" onClick={(e) => { e.stopPropagation(); prevImage(); }} className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100 transition-opacity">
                                            <ChevronLeft className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <div className="absolute top-1/2 right-2 -translate-y-1/2 z-10">
                                        <Button variant="secondary" size="icon" onClick={(e) => { e.stopPropagation(); nextImage(); }} className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100 transition-opacity">
                                            <ChevronRight className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded-md backdrop-blur-sm">
                                        <ImageIcon className="w-3 h-3 mr-1 inline-block" />
                                        {currentImageIndex + 1} / {post.mediaurls.length}
                                    </div>
                                </>
                            )}
                        </>
                    ) : post.mediatype === 'video' ? (
                      <>
                        <video ref={videoRef} loop muted playsInline src={post.mediaurls[0]} className={cn("w-full h-full object-contain", mediaError && "hidden")} onError={() => setMediaError(true)} />
                        {mediaError && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white p-4">
                                <AlertTriangle className="w-8 h-8 mb-2 text-yellow-400" />
                                <p className="text-sm text-center font-semibold mb-3">This video could not be loaded.</p>
                                <Button onClick={handleRetryVideo} variant="secondary" size="sm">
                                    <RefreshCw className="w-4 h-4 mr-2"/>
                                    Retry
                                </Button>
                            </div>
                        )}
                      </>
                    ) : null}
                    
                    {(post.mediatype === 'video' || post.mediatype === 'image') && !isYouTubeVideo && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded-md backdrop-blur-sm">
                            {post.mediatype.charAt(0).toUpperCase() + post.mediatype.slice(1)}
                        </div>
                    )}
                  </div>
                </button>
          </div>
        )}

        <CardContent className={`px-5 ${hasVisibleMedia ? 'pt-4' : 'pt-2'} pb-3`}>
          {renderContentWithMentionsAndLinks()}
          {pollState && (
              <div className="mt-4 space-y-3 pt-4 border-t border-border/60">
                  <p className="font-semibold text-foreground">{pollState.question}</p>
                  <div className="space-y-2">
                      {pollState.options.map(option => {
                          const isVotedOption = pollState.user_voted_option_id === option.id;
                          const percentage = pollState.total_votes > 0 ? (option.vote_count / pollState.total_votes) * 100 : 0;
                          return (
                              <button
                                  key={option.id}
                                  onClick={() => handleVote(option.id)}
                                  disabled={isVoting || !!pollState.user_voted_option_id}
                                  className={cn(
                                      "w-full text-left p-2 rounded-md border transition-all duration-200",
                                      !pollState.user_voted_option_id && "hover:border-primary hover:bg-primary/5 cursor-pointer",
                                      pollState.user_voted_option_id && "cursor-default"
                                  )}
                              >
                                  <div className="flex items-center justify-between text-sm">
                                      <div className="flex items-center">
                                          {isVotedOption && <Check className="w-4 h-4 mr-2 text-primary" />}
                                          <span className={cn("font-medium", isVotedOption ? "text-primary" : "text-foreground")}>{option.option_text}</span>
                                      </div>
                                      {pollState.user_voted_option_id && (
                                          <span className="font-semibold text-muted-foreground">{Math.round(percentage)}%</span>
                                      )}
                                  </div>
                                  {pollState.user_voted_option_id && (
                                      <div className="relative h-2 rounded-full bg-muted mt-1.5 overflow-hidden">
                                          <div className="absolute h-full bg-primary/80 rounded-full" style={{ width: `${percentage}%` }}></div>
                                      </div>
                                  )}
                              </button>
                          );
                      })}
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{pollState.total_votes} votes</p>
              </div>
          )}
        </CardContent>

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="px-5 pt-1 pb-2 flex flex-wrap gap-2 items-center">
            {post.hashtags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs bg-primary/10 text-primary hover:bg-primary/20 cursor-default">
                <Tag className="w-3 h-3 mr-1 opacity-70" />
                {tag.replace('#','')}
              </Badge>
            ))}
          </div>
        )}

        {!post.hide_location && (
          <CardFooter className="text-xs text-muted-foreground flex flex-wrap items-center justify-between pt-2 pb-3 px-5 border-t border-border/40 mt-1 gap-y-2 bg-card/50">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${post.latitude},${post.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 flex-wrap cursor-pointer hover:text-primary transition-colors group" title="Click to get directions">
              <Map className="w-4 h-4 text-primary/70 flex-shrink-0 transition-colors group-hover:text-primary" />
              <span className="font-medium text-muted-foreground transition-colors group-hover:text-primary group-hover:underline">
                  Location: {post.latitude.toFixed(3)}, {post.longitude.toFixed(3)}
              </span>
              {distance !== null && (
                  <span className="ml-1 text-accent font-semibold transition-colors group-hover:underline">
                  (approx. {distance < 0.1 ? '<100m' : `${distance.toFixed(1)} km`} away)
                  </span>
              )}
              </a>
          </CardFooter>
        )}

        {sessionUser && sessionUser.id === post.authorid && !isAnnouncement && (
          <div className="px-5 py-3 border-t border-border/30 bg-primary/5">
            <p className="text-xs font-semibold text-primary/90 mb-2 uppercase tracking-wider">Your Post Stats</p>
            <div className="flex items-center justify-around text-sm text-primary/80">
              <div className="flex items-center gap-2" title={`${post.viewcount.toLocaleString()} views`}>
                <Eye className="w-4 h-4 text-accent" />
                <span>{post.viewcount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2" title={`${post.notifiedcount.toLocaleString()} users notified`}>
                <BellRing className="w-4 h-4 text-accent" />
                <span>{post.notifiedcount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 pb-4 pt-2 flex items-center space-x-2 border-t border-border/30 bg-card/20 flex-wrap gap-y-2">
          <Button variant="ghost" size="sm" onClick={handleLikeClick} disabled={isLiking || (!sessionUser && isLikedByClient)} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Like this post" title="Like">
            <ThumbsUp className={cn('w-5 h-5 transition-all duration-200 group-hover:scale-110 group-hover:text-blue-500', isLikedByClient ? 'text-blue-500 fill-blue-500' : 'text-muted-foreground')} />
            <span className="font-medium text-sm">{displayLikeCount} {displayLikeCount === 1 ? 'Like' : 'Likes'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group" aria-label="View comments" title="Comments">
            <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium text-sm">{displayCommentCount} {showComments ? 'Hide' : (displayCommentCount === 1 ? 'Comment' : 'Comments')}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="flex items-center space-x-1.5 text-muted-foreground hover:text-blue-500 transition-colors duration-150 group" aria-label="Share this post" title="Share">
            <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium text-sm">Share</span>
          </Button>
        </div>

        {showComments && (
          <CommentSection
            postId={post.id}
            sessionUser={sessionUser}
            onCommentPosted={() => setDisplayCommentCount(prev => prev + 1)}
          />
        )}
      </Card>
    </>
  );
};
