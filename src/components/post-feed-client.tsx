

'use client';

import React, { type FC } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Post, User, SortOption, BusinessUser, ExternalBusiness } from '@/lib/db-types';
import { getPosts, getFamilyPosts, getNearbyBusinesses, registerDeviceToken, updateUserLocation, getUnreadFamilyPostCount, markFamilyFeedAsRead, triggerLiveSeeding, findExternalBusinesses } from '@/app/actions';
import { PostCard } from '@/components/post-card';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Zap, Loader2, Bell, BellOff, BellRing, AlertTriangle, Users, Rss, Filter, Briefcase, PartyPopper, LocateFixed, HandPlatter, ArrowLeft, Wind, Scissors } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useSwipeable } from 'react-swipeable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EqualWidthTabs from '@/components/EqualWidthTabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@/components/ui/dropdown-menu';
import { BUSINESS_CATEGORIES } from '@/lib/db-types';
import BusinessCard from './business-card';
import ExternalBusinessCard from './external-business-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getMessaging, getToken } from 'firebase/messaging';
import { getApp, getApps, initializeApp } from 'firebase/app';
import MandalList from './mandal-list';
import Link from 'next/link';


interface AndroidInterface {
  getFCMToken?: () => string | null;
}

declare global {
  interface Window {
    Android?: AndroidInterface;
  }
}

const POSTS_PER_PAGE = 5;

type FeedType = 'nearby' | 'family' | 'services' | 'festival';

type FeedState = {
    posts: Post[];
    page: number;
    hasMore: boolean;
    isLoading: boolean;
};

type BusinessFeedState = {
    businesses: BusinessUser[];
    externalBusinesses: ExternalBusiness[];
    page: number;
    hasMore: boolean;
    isLoading: boolean;
    isLoadingAI: boolean;
    category?: string;
};

const initialFeedState: FeedState = {
    posts: [],
    page: 1,
    hasMore: true,
    isLoading: true,
};

const initialBusinessFeedState: BusinessFeedState = {
    businesses: [],
    externalBusinesses: [],
    page: 1,
    hasMore: true,
    isLoading: false,
    isLoadingAI: false,
    category: undefined,
};

function NotificationButtonContent({
  notificationPermissionStatus,
}: {
  notificationPermissionStatus: 'default' | 'loading' | 'granted' | 'denied';
}) {
  switch (notificationPermissionStatus) {
    case 'loading':
      return <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> <span className="hidden sm:inline">Checking...</span></>;
    case 'granted':
      return <><BellRing className="w-5 h-5 mr-2 text-green-500" /> <span className="hidden sm:inline">Subscribed</span></>;
    case 'denied':
      return <><BellOff className="w-5 h-5 mr-2 text-destructive" /> <span className="hidden sm:inline">Setup Failed</span></>;
    case 'default':
    default:
      return <><Bell className="w-5 h-5 mr-2" /> <span className="hidden sm:inline">Notifications</span></>;
  }
}

export function NoPostsContent({ feedType, radiusKm, onRadiusChange }: { feedType: FeedType; radiusKm?: number; onRadiusChange?: (radius: number) => void; }) {
  const messages = {
    nearby: {
      title: 'The air is quiet here...',
      description: 'No pulses found nearby. Be the first to post!'
    },
    family: {
      title: 'No Family Pulses Yet',
      description: 'Your family members have not posted anything yet. Share a family post to get started!'
    },
    services: {
      title: 'No Businesses Found',
      description: radiusKm ? `We looked within ${radiusKm} km. Want to try a wider radius?` : 'No businesses found in your area for the selected category. Try a different filter!'
    },
    festival: {
        title: 'The Festivities Await!',
        description: 'No mandals have been registered for the selected city yet.'
    }
  }
  const currentMessage = messages[feedType];

  return (
    <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center">
        {feedType === 'services' ? <Briefcase className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" /> : feedType === 'festival' ? <PartyPopper className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" /> : <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />}
        <p className="text-2xl text-muted-foreground font-semibold">{currentMessage.title}</p>
        <p className="text-md text-muted-foreground/80 mt-2">{currentMessage.description}</p>
        {feedType === 'services' && onRadiusChange && (
            <div className="flex gap-2 mt-4">
              {[10, 15, 25].map(r => (
                <Button key={r} variant="outline" size="sm" onClick={() => onRadiusChange(r)}>
                  {r} km
                </Button>
              ))}
            </div>
        )}
        {feedType !== 'services' && (
            <div className="mt-6">
            <a
                href="#"
                onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm bg-background hover:bg-muted"
            >
                Share your first Pulse
            </a>
            </div>
        )}
      </CardContent>
    </Card>
  );
}


// --- Main Component ---

interface PostFeedClientProps {
  sessionUser: User | null;
  initialPosts: Post[];
}

const PostFeedClient: FC<PostFeedClientProps> = ({ sessionUser, initialPosts }) => {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as FeedType) || 'nearby';
  
  const [feeds, setFeeds] = useState<{ [key in 'nearby' | 'family']: FeedState }>({
    nearby: { ...initialFeedState, posts: initialPosts, isLoading: initialPosts.length === 0, hasMore: initialPosts.length === POSTS_PER_PAGE },
    family: { ...initialFeedState, isLoading: false }, // Family feed doesn't load initially
  });
  const [businessFeed, setBusinessFeed] = useState<BusinessFeedState>(initialBusinessFeedState);

  const [sortBy, setSortBy] = useState<SortOption>('nearby');
  const [radiusKm, setRadiusKm] = useState(5);
  
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<'default' | 'loading' | 'granted' | 'denied'>('default');
  const [showTroubleshootingDialog, setShowTroubleshootingDialog] = useState(false);
  const [unreadFamilyPostCount, setUnreadFamilyPostCount] = useState(0);
  const [locationPromptVisible, setLocationPromptVisible] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  
  const [selectedService, setSelectedService] = useState<string | null>(null);
  
  const liveSeedingTriggered = useRef(false);
  const businessInitialLoad = useRef(false);


  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermissionStatus(Notification.permission);
    }
  }, []);
  
  // Fetch unread family post count on initial load and periodically
  useEffect(() => {
    if (!sessionUser) return;
    const fetchCount = () => {
      getUnreadFamilyPostCount().then(setUnreadFamilyPostCount);
    };
    fetchCount(); // Initial fetch
    const intervalId = setInterval(fetchCount, 30000); // Poll every 30 seconds
    return () => clearInterval(intervalId);
  }, [sessionUser]);


  const fetchPosts = useCallback(async (feed: 'nearby' | 'family', page: number, sort: SortOption, currentLoc: { latitude: number; longitude: number } | null) => {
    setFeeds(prev => ({ ...prev, [feed]: { ...prev[feed], isLoading: true } }));

    try {
        const fetcher = feed === 'nearby'
            ? getPosts({ page, limit: POSTS_PER_PAGE, latitude: currentLoc?.latitude, longitude: currentLoc?.longitude, sortBy: sort })
            : getFamilyPosts({ page, limit: POSTS_PER_PAGE, sortBy: sort });

        const newPosts = await fetcher;
      
        setFeeds(prev => {
            const currentFeed = prev[feed];
            const allPosts = page === 1 ? newPosts : [...currentFeed.posts, ...newPosts.filter(p => !currentFeed.posts.some(ep => ep.id === p.id))];
            
            return {
                ...prev,
                [feed]: {
                    ...currentFeed,
                    posts: allPosts,
                    page: page,
                    hasMore: newPosts.length === POSTS_PER_PAGE,
                    isLoading: false,
                }
            };
        });
    } catch (error) {
        console.error(`Error fetching ${feed} posts:`, error);
        setFeeds(prev => ({ ...prev, [feed]: { ...prev[feed], isLoading: false } }));
    }
  }, []);

  const fetchBusinesses = useCallback(async (page: number, category?: string) => {
    if (!location) {
        setLocationPromptVisible(true);
        return;
    }
    setLocationPromptVisible(false);
    setBusinessFeed(prev => ({ ...prev, isLoading: true, externalBusinesses: [] }));
    try {
      const newBusinesses = await getNearbyBusinesses({ page, limit: POSTS_PER_PAGE, latitude: location.latitude, longitude: location.longitude, category, radiusKm });
      
      const allBusinesses = page === 1 ? newBusinesses : [...businessFeed.businesses, ...newBusinesses.filter(b => !businessFeed.businesses.some(eb => eb.id === b.id))];
      
      setBusinessFeed(prev => ({
        ...prev,
        businesses: allBusinesses,
        page: page,
        hasMore: newBusinesses.length === POSTS_PER_PAGE,
        isLoading: false,
        category,
      }));

      // If DB search returns no results and a category is selected, trigger AI search
      if (allBusinesses.length === 0 && page === 1 && category) {
          setBusinessFeed(prev => ({ ...prev, isLoadingAI: true }));
          try {
              const aiResult = await findExternalBusinesses({
                  category: category,
                  latitude: location.latitude,
                  longitude: location.longitude,
              });
              setBusinessFeed(prev => ({...prev, externalBusinesses: aiResult.businesses, isLoadingAI: false }));
          } catch(aiError) {
              console.error("AI business search failed:", aiError);
              setBusinessFeed(prev => ({...prev, isLoadingAI: false }));
          }
      }

    } catch (error) {
      console.error('Error fetching businesses:', error);
      setBusinessFeed(prev => ({ ...prev, isLoading: false }));
    }
  }, [location, radiusKm, businessFeed.businesses]);

  const requestLocation = useCallback(() => {
      if (isFetchingLocation) return;
      setIsFetchingLocation(true);
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  const newLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                  setLocation(newLocation);
                  setLocationPromptVisible(false);
                  setIsFetchingLocation(false);
                  
                  if (!liveSeedingTriggered.current) {
                      triggerLiveSeeding(newLocation.latitude, newLocation.longitude);
                      liveSeedingTriggered.current = true;
                  }

                  if (sessionUser) {
                      updateUserLocation(newLocation.latitude, newLocation.longitude).catch(err => console.warn("Silent location update failed:", err));
                  }
              },
              (err) => {
                  console.warn("Could not get user location:", err.message);
                  toast({ variant: 'destructive', title: 'Location Error', description: 'Could not access your location. Please check your browser settings.' });
                  setLocationPromptVisible(true); // Keep prompt visible
                  setIsFetchingLocation(false);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
      }
  }, [isFetchingLocation, sessionUser, toast]);

  // Initial location check (doesn't prompt, just checks)
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);
  
  useEffect(() => {
    if (activeTab === 'services' && location && !businessInitialLoad.current && selectedService) {
        businessInitialLoad.current = true;
        fetchBusinesses(1, selectedService);
    }
  }, [activeTab, location, fetchBusinesses, selectedService]);

  
  const handleTabChange = useCallback((newTab: FeedType) => {
    if (newTab === 'family') {
      if (unreadFamilyPostCount > 0) {
        markFamilyFeedAsRead();
        setUnreadFamilyPostCount(0);
      }
      if (feeds.family.posts.length === 0 && !feeds.family.isLoading) {
        fetchPosts('family', 1, sortBy, location);
      }
    } else if (newTab === 'services') {
        setSelectedService(null);
        if (!location) {
            setLocationPromptVisible(true);
            setBusinessFeed(initialBusinessFeedState);
        }
    } else if (newTab === 'festival') {
        setLocationPromptVisible(false);
        // MandalList component fetches its own data
    } else { // nearby
        setLocationPromptVisible(false);
        if (feeds.nearby.posts.length === 0 && !feeds.nearby.isLoading) {
            fetchPosts('nearby', 1, sortBy, location);
        }
    }
  }, [unreadFamilyPostCount, feeds.family.posts.length, feeds.family.isLoading, fetchPosts, sortBy, location, feeds.nearby.posts.length, feeds.nearby.isLoading]);

  useEffect(() => {
    handleTabChange(activeTab);
  }, [activeTab, handleTabChange]);

  const handleNotificationRegistration = async () => {
    if (notificationPermissionStatus === 'granted') {
      toast({ title: "Notifications Enabled", description: "You are already set up to receive notifications." });
      return;
    }
    if (notificationPermissionStatus === 'denied') {
       setShowTroubleshootingDialog(true);
      return;
    }

    setNotificationPermissionStatus('loading');
    
    // This is the consolidated logic for getting a token from either the WebView or Web Push API
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    try {
      let token: string | null = null;
      // 1. First, try the Android WebView path
      if (window.Android && typeof window.Android.getFCMToken === 'function') {
        console.log("Attempting to get token from Android WebView...");
        token = window.Android.getFCMToken();
      }

      // 2. If not in WebView or token is null, fall back to Web Push API
      if (!token) {
        console.log("Not in WebView or token not found, falling back to Web Push API.");
        if (!vapidKey) {
          throw new Error("Web notification key is not configured on the server.");
        }
        
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
            const messaging = getMessaging(app);
            token = await getToken(messaging, { vapidKey });
        } else {
            throw new Error("Notification permission was denied.");
        }
      }
      
      // 3. If we have a token (from either source), register it.
      if (token) {
        const result = await registerDeviceToken(token, location?.latitude, location?.longitude);
        if (result.success) {
          setNotificationPermissionStatus('granted');
          toast({ title: "Success!", description: "You are now set up for notifications."});
        } else {
          throw new Error(result.error || "Failed to register token with server.");
        }
      } else {
        throw new Error("Could not get a notification token. Please try again.");
      }

    } catch (error: any) {
        console.error("Error during notification registration:", error);
        toast({ variant: 'destructive', title: "Registration Failed", description: error.message });
        setShowTroubleshootingDialog(true);
        setNotificationPermissionStatus('denied');
    }
  };

  const refreshFeed = useCallback(async () => {
    setIsRefreshing(true);
    if(activeTab === 'services') {
        await fetchBusinesses(1, businessFeed.category);
    } else if (activeTab === 'festival') {
        // MandalList will handle its own refresh
    }
     else {
        if (activeTab === 'family') {
            setUnreadFamilyPostCount(0);
            markFamilyFeedAsRead();
        }
        await fetchPosts(activeTab, 1, sortBy, location);
    }
    setIsRefreshing(false);
    if (window) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, fetchPosts, sortBy, fetchBusinesses, businessFeed.category, location]);
  
  const handleLoadMore = useCallback(async () => {
    if (activeTab === 'services') {
        if (businessFeed.isLoading || !businessFeed.hasMore) return;
        fetchBusinesses(businessFeed.page + 1, businessFeed.category);
    } else if (activeTab === 'festival') {
        // MandalList handles its own loading
    } else {
        const currentFeed = feeds[activeTab];
        if (currentFeed.isLoading || !currentFeed.hasMore) return;
        fetchPosts(activeTab, currentFeed.page + 1, sortBy, location);
    }
  }, [feeds, activeTab, fetchPosts, sortBy, businessFeed, fetchBusinesses, location]);

  const observer = useRef<IntersectionObserver>();
  const loaderRef = useCallback((node: HTMLDivElement | null) => {
    let isLoading = false;
    let hasMore = false;

    if (activeTab === 'services') {
        isLoading = businessFeed.isLoading;
        hasMore = businessFeed.hasMore;
    } else if (activeTab !== 'festival') {
        isLoading = feeds[activeTab].isLoading;
        hasMore = feeds[activeTab].hasMore;
    }
    
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        handleLoadMore();
      }
    });

    if (node) observer.current.observe(node);
  }, [activeTab, businessFeed.isLoading, businessFeed.hasMore, feeds, handleLoadMore]);

  const swipeHandlers = useSwipeable({
    onSwipedDown: () => {
      if (window.scrollY === 0) refreshFeed();
    },
    trackMouse: true,
  });

  const handleSortChange = (newSortBy: SortOption) => {
    if (newSortBy === sortBy) return;
    setSortBy(newSortBy);
    if(activeTab !== 'services' && activeTab !== 'festival') {
        fetchPosts(activeTab, 1, newSortBy, location);
    }
  };

  const handleCategoryChange = (newCategory: string) => {
    const category = newCategory === 'all' ? undefined : newCategory;
    if(category === businessFeed.category) return;
    fetchBusinesses(1, category);
  };
  
  const handleRadiusChange = (newRadius: number) => {
    setRadiusKm(newRadius);
    fetchBusinesses(1, businessFeed.category);
  }

  const renderServiceCategories = () => (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center text-primary tracking-tight">Select a Service</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card onClick={() => { setSelectedService('Saloon / Barber Shop'); fetchBusinesses(1, 'Saloon / Barber Shop'); }} className="p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-primary/20 hover:border-primary/50 transition-all duration-200">
                <Scissors className="h-12 w-12 text-accent mb-3"/>
                <p className="font-semibold text-lg">Saloon</p>
                <p className="text-sm text-muted-foreground">Haircuts, Shaving, Styling</p>
            </Card>
            <Card onClick={() => { setSelectedService('Car/Bike Washing'); fetchBusinesses(1, 'Car/Bike Washing'); }} className="p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-primary/20 hover:border-primary/50 transition-all duration-200">
                <Wind className="h-12 w-12 text-accent mb-3"/>
                <p className="font-semibold text-lg">Car/Bike Washing</p>
                <p className="text-sm text-muted-foreground">Cleaning, Polishing, Detailing</p>
            </Card>
        </div>
    </div>
  );

  const renderFeedContent = () => {
    if (activeTab === 'festival') {
        return <MandalList sessionUser={sessionUser} userLocation={location} />;
    }

    if (activeTab === 'services') {
        if (!selectedService) {
            return renderServiceCategories();
        }

        if (locationPromptVisible) {
            return (
                <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center">
                        <LocateFixed className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
                        <p className="text-2xl text-muted-foreground font-semibold">Location Needed</p>
                        <p className="text-md text-muted-foreground/80 mt-2 max-w-sm">To find businesses near you, we need access to your location.</p>
                        <Button onClick={requestLocation} disabled={isFetchingLocation} className="mt-6">
                            {isFetchingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                            {isFetchingLocation ? 'Finding You...' : 'Grant Location Access'}
                        </Button>
                    </CardContent>
                </Card>
            );
        }
        
        const showDbLoading = businessFeed.isLoading && businessFeed.page === 1;
        const showAiLoading = businessFeed.isLoadingAI;
        const showLoadingSkeleton = showDbLoading || showAiLoading;

        if (showLoadingSkeleton) {
            return <PostFeedSkeleton />;
        }
        
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => setSelectedService(null)} className="mb-2">
                    <ArrowLeft className="mr-2 h-4 w-4"/>
                    Back to Services
                </Button>

                {businessFeed.businesses.map((business) => (
                    <BusinessCard key={`db-${business.id}`} business={business} userLocation={location} />
                ))}
                {businessFeed.externalBusinesses.map((business, index) => (
                    <ExternalBusinessCard key={`ai-${index}`} business={business} />
                ))}

                {businessFeed.businesses.length === 0 && businessFeed.externalBusinesses.length === 0 && !businessFeed.isLoadingAI && (
                    <NoPostsContent feedType='services' radiusKm={radiusKm} onRadiusChange={(r) => { setRadiusKm(r); fetchBusinesses(1, businessFeed.category); }} />
                )}
                
                {businessFeed.hasMore && <div ref={loaderRef} className="h-1 w-full" />}
                
                {businessFeed.isLoading && businessFeed.page > 1 && (
                    <div className="flex justify-center items-center py-6">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
            </div>
        );
    }
    
    const feed = feeds[activeTab];
    if ((feed.isLoading && feed.posts.length === 0) || isRefreshing) {
      return <PostFeedSkeleton />;
    }
    
    return (
      <div className="space-y-6">
        {activeTab === 'nearby' && (
          <Card className="shadow-lg hover:shadow-primary/10 transition-shadow duration-300 bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
                <Link href="/?tab=services" className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-full border-2 border-primary/20">
                      <HandPlatter className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-primary">Local Services</h3>
                    <p className="text-sm text-muted-foreground">Need a salon or car wash? Book now!</p>
                  </div>
                </Link>
            </CardContent>
          </Card>
        )}
        {feed.posts.length > 0 ? (
          feed.posts.map((post, index) => (
            <PostCard key={post.id} post={post} userLocation={location} sessionUser={sessionUser} isFirst={index === 0} />
          ))
        ) : (
          <NoPostsContent feedType={activeTab} />
        )}
        {feed.hasMore && <div ref={loaderRef} className="h-1 w-full" />}
        {feed.isLoading && feed.posts.length > 0 && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    );
  };

  const TABS = [
      { key: "nearby", label: "Nearby" },
      { key: "festival", label: "Festival" },
      ...(sessionUser ? [{ key: "family", label: "Family", badge: unreadFamilyPostCount }] : []),
      { key: "services", label: "Services" },
  ];

  return (
    <div {...swipeHandlers}>
       <AlertDialog open={showTroubleshootingDialog} onOpenChange={setShowTroubleshootingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
              Enable Background Notifications
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 text-left pt-2 text-foreground/80">
                <p>To receive notifications reliably on your device, please enable these two settings for the LocalPulse app:</p>
                <ol className="list-decimal list-inside space-y-2 font-medium bg-muted p-3 rounded-md border">
                    <li><span className="font-semibold">Enable "Autostart"</span> (or "Auto-launch").</li>
                    <li><span className="font-semibold">Set Battery Saver to "No restrictions"</span>.</li>
                </ol>
                <p className="text-xs text-muted-foreground pt-1">
                    These options are usually found in your phone's Settings app under "Apps" or "Security". Unfortunately, we cannot open this page for you automatically.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>I'll check later</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowTroubleshootingDialog(false); handleNotificationRegistration(); }}>I've checked, Try Again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <EqualWidthTabs
                tabs={TABS}
                param="tab"
                activeKey={activeTab}
            />
            <div className="flex items-center gap-2">
              {activeTab === 'services' && selectedService && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 shadow-sm">
                      <Filter className="w-4 h-4 mr-2" />
                      <span>{radiusKm} km</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Search Radius</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={String(radiusKm)} onValueChange={(v) => handleRadiusChange(Number(v))}>
                      {[5, 10, 15, 30].map(r => <DropdownMenuRadioItem key={r} value={String(r)}>{r} km</DropdownMenuRadioItem>)}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {activeTab !== 'services' && activeTab !== 'festival' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 shadow-sm">
                      <Filter className="w-4 h-4 mr-2" />
                      <span>Sort</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => handleSortChange(v as SortOption)}>
                      <DropdownMenuRadioItem value="nearby">Nearby</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="likes">Most Popular</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="comments">Most Discussed</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shadow-sm"
                  onClick={handleNotificationRegistration}
                  disabled={notificationPermissionStatus === 'loading'}
                  aria-label="Toggle Notifications"
              >
                  <NotificationButtonContent notificationPermissionStatus={notificationPermissionStatus} />
              </Button>
            </div>
        </div>
        <div className="mt-4">
          {renderFeedContent()}
        </div>
    </div>
  );
};

export default PostFeedClient;

