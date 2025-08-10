
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { UserWithStatuses } from '@/lib/db-types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatDistanceToNowStrict } from 'date-fns';
import { Progress } from './ui/progress';
import { useModalBack } from "@/hooks/useModalBack";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface StatusViewerProps {
  users: UserWithStatuses[];
  initialUserIndex: number;
  onClose: () => void;
}

const STATUS_DURATIONS = {
    image: 5000, // 5 seconds for images
};

const StatusViewer: React.FC<StatusViewerProps> = ({ users, initialUserIndex, onClose }) => {
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const progressTimerRef = useRef<NodeJS.Timer>();

  useModalBack(true, onClose, "status-viewer");
  useBodyScrollLock(true);

  const currentUser = users[currentUserIndex];
  const currentStatus = currentUser?.statuses[currentStatusIndex];
  
  const getNextStatus = useCallback(() => {
    if (!currentUser) return null;
    if (currentStatusIndex < currentUser.statuses.length - 1) {
      return currentUser.statuses[currentStatusIndex + 1];
    }
    if (currentUserIndex < users.length - 1) {
      return users[currentUserIndex + 1]?.statuses[0] || null;
    }
    return null;
  }, [currentUser, currentStatusIndex, currentUserIndex, users]);

  const nextStatusToPreload = getNextStatus();

  const goToNextUser = useCallback(() => {
    if (currentUserIndex < users.length - 1) {
      setCurrentUserIndex(currentUserIndex + 1);
      setCurrentStatusIndex(0);
    } else {
      onClose();
    }
  }, [currentUserIndex, users.length, onClose]);
  
  const goToNextStatus = useCallback(() => {
    if (currentUser?.statuses.length > 0 && currentStatusIndex < currentUser.statuses.length - 1) {
      setCurrentStatusIndex(currentStatusIndex + 1);
    } else {
      goToNextUser();
    }
  }, [currentStatusIndex, currentUser, goToNextUser]);

  useEffect(() => {
    setProgress(0);
    clearTimeout(timerRef.current);
    clearInterval(progressTimerRef.current);

    if (!currentStatus || isPaused) return;

    if (currentStatus.media_type === 'image') {
      const duration = STATUS_DURATIONS.image;
      timerRef.current = setTimeout(goToNextStatus, duration);
      const startTime = Date.now();
      
      const updateProgress = () => {
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime >= duration) {
              setProgress(100);
              clearInterval(progressTimerRef.current);
          } else {
              setProgress((elapsedTime / duration) * 100);
          }
      };
      
      progressTimerRef.current = setInterval(updateProgress, 50);

    } else if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.error("Video play failed", e));
    }
    
    return () => {
        clearTimeout(timerRef.current);
        clearInterval(progressTimerRef.current);
    }
  }, [currentStatusIndex, currentUserIndex, currentStatus, isPaused, goToNextStatus]);
  
  const handleVideoUpdate = () => {
      if(videoRef.current && !isPaused) {
          const videoProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
          setProgress(videoProgress);
      }
  }

  if (!currentUser || !currentStatus) return null;

  const goToPrevUser = () => {
    if (currentUserIndex > 0) {
      setCurrentUserIndex(currentUserIndex - 1);
      setCurrentStatusIndex(0);
    }
  };
  
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPaused) {
          togglePause(e);
          return;
      }
      const { clientX, currentTarget } = e;
      const { width } = currentTarget.getBoundingClientRect();
      const isRightSide = clientX > width / 2;

      if(isRightSide) {
          goToNextStatus();
      } else {
          if (currentStatusIndex > 0) {
              setCurrentStatusIndex(currentStatusIndex - 1);
          } else if (currentUserIndex > 0) {
              goToPrevUser();
          }
      }
  };
  
  const togglePause = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPaused(currentIsPaused => {
          const newIsPaused = !currentIsPaused;
          if(videoRef.current) {
              newIsPaused ? videoRef.current.pause() : videoRef.current.play();
          }
          return newIsPaused;
      });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center animate-in fade-in-0" onClick={onClose}>
      
      {nextStatusToPreload && nextStatusToPreload.media_type === 'image' && (
        <div style={{ display: 'none' }}>
            <Image
                src={nextStatusToPreload.media_url}
                alt=""
                width={1024}
                height={1024}
                priority={false}
                data-ai-hint="user status"
            />
        </div>
      )}
      {nextStatusToPreload && nextStatusToPreload.media_type === 'video' && (
         <link rel="preload" as="video" href={nextStatusToPreload.media_url} />
      )}
      
      <div className="relative w-full h-full max-w-md max-h-[95vh] sm:max-h-screen sm:rounded-lg overflow-hidden flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 w-full h-full" onClick={handleTap}>
            {currentStatus.media_type === 'image' && (
              <Image src={currentStatus.media_url} alt="Status" fill style={{ objectFit: 'contain' }} priority data-ai-hint="user status" />
            )}
            {currentStatus.media_type === 'video' && (
              <video ref={videoRef} src={currentStatus.media_url} className="w-full h-full object-contain" onEnded={goToNextStatus} onTimeUpdate={handleVideoUpdate} playsInline />
            )}
          </div>
          
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
              <div className="flex items-center gap-2 mb-2">
                  {currentUser.statuses.map((_, index) => (
                      <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                           <div className="h-full bg-white rounded-full" style={{ width: `${index < currentStatusIndex ? 100 : index === currentStatusIndex ? progress : 0}%`, transition: index === currentStatusIndex && progress > 0 ? 'width 0.05s linear' : 'none' }} />
                      </div>
                  ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9 border-2 border-white/80"><AvatarImage src={currentUser.userProfilePictureUrl ?? undefined} /><AvatarFallback>{currentUser.userName.charAt(0)}</AvatarFallback></Avatar>
                    <div>
                      <p className="text-sm font-semibold text-white">{currentUser.userName}</p>
                      <p className="text-xs text-gray-300">{formatDistanceToNowStrict(new Date(currentStatus.created_at), { addSuffix: true })}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={togglePause} className="text-white p-1 hover:bg-white/20 rounded-full"><span className="sr-only">{isPaused ? 'Play' : 'Pause'}</span>{isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</button>
                    <button onClick={onClose} className="text-white p-1 hover:bg-white/20 rounded-full"><span className="sr-only">Close</span><X className="h-5 w-5" /></button>
                </div>
              </div>
          </div>

          <button onClick={(e) => { e.stopPropagation(); goToPrevUser(); }} disabled={currentUserIndex === 0} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 text-white bg-black/30 p-2 rounded-full hover:bg-black/60 disabled:opacity-30 hidden sm:block">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); goToNextUser(); }} disabled={currentUserIndex >= users.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-white bg-black/30 p-2 rounded-full hover:bg-black/60 disabled:opacity-30 hidden sm:block">
            <ChevronRight className="h-6 w-6" />
          </button>
      </div>
    </div>
  );
};

export default StatusViewer;
