

'use client';

import React, { type FC } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Post, User, SortOption, BusinessUser } from '@/lib/db-types';
import { getPosts, getFamilyPosts, getNearbyBusinesses, registerDeviceToken, updateUserLocation, getUnreadFamilyPostCount, markFamilyFeedAsRead } from '@/app/actions';
import { PostCard } from '@/components/post-card';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Zap, Loader2, Bell, BellOff, BellRing, AlertTriangle, Users, Rss, Filter, Briefcase, PartyPopper, LocateFixed, HandPlatter, ArrowLeft, Wind, Scissors, Map, List, CalendarCheck, Wrench, Car, Home as HomeIcon } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@/components/ui/dropdown-menu';
import BusinessCard from './business-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getMessaging, getToken } from 'firebase/messaging';
import { getApp, getApps, initializeApp } from 'firebase/app';
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

type FeedType = 'nearby' | 'family' | 'services';

type FeedState = {
    posts: Post[];
    page: number;
    hasMore: boolean;
    isLoading: boolean;
};

type BusinessFeedState = {
    businesses: BusinessUser[];
    page: number;
    hasMore: boolean;
    isLoading: boolean;
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
    page: 1,
    hasMore: true,
    isLoading: false,
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

export function NoPostsContent({ feedType, radiusKm, onRadiusChange, category }: { feedType: FeedType; radiusKm?: number; onRadiusChange?: (radius: number) => void; category?: string }) {
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
      title: `No ${category || 'Businesses'} Found`,
      description: radiusKm ? `We looked within ${radiusKm} km. Want to try a wider radius?` : 'No businesses found in your area for the selected category. Try a different filter!'
    },
  }
  const currentMessage = messages[feedType];

  return (
    <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center">
        {feedType === 'services' ? <Briefcase className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" /> : <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />}
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

const serviceCategories = [
    { name: 'Personal Care', icon: Scissors, description: "Saloons, Barbers, Spas", subcategories: ["Saloon / Barber Shop", "Beauty Parlour", "Spa / Massage Center", "Mehendi / Tattoo Artist"] },
    { name: 'Vehicle Services', icon: Car, description: "Washing, Detailing", subcategories: ["Car/Bike Washing"] },
    { name: 'Home Services', icon: HomeIcon, description: "Electricians, Plumbers", subcategories: ["Electrician", "Plumber", "Carpenter", "Painter", "Civil Worker / Mason", "AC / Refrigerator Mechanic", "CCTV Installer", "RO / Water Purifier Service", "Gas Stove Repair"] },
    { name: 'Professional Services', icon: Wrench, description: "Repairs, Laundry, etc.", subcategories: ["Computer Repair & Service", "Laundry / Dry Cleaning", "Courier Service"] }
];

const PostFeedClient: FC<PostFeedClientProps> = ({ sessionUser, initialPosts }) => {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleTabChangeRouter = (newTab: string) => {
    const usp = new URLSearchParams(window.location.search);
    usp.set('tab', newTab);
    router.replace(`?${usp.toString()}`, { scroll: false });
  };
  
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
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const businessInitialLoad = useRef(false);


  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermissionStatus(Notification.permission);
    }
  }, []);
  
  // This effect will only poll for the unread family count.
  // It will NOT cause a re-render that resets the business feed.
  useEffect(() => {
    if (!sessionUser) {
      setUnreadFamilyPostCount(0);
      return;
    }
    const fetchCount = () => {
      getUnreadFamilyPostCount().then(setUnreadFamilyPostCount);
    };
    fetchCount(); // Initial fetch
    const intervalId = setInterval(fetchCount, 30000);
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
    setBusinessFeed(prev => ({ ...prev, isLoading: true, category: category || prev.category }));

    try {
      const newBusinesses = await getNearbyBusinesses({ page, limit: POSTS_PER_PAGE, latitude: location.latitude, longitude: location.longitude, category, radiusKm });
      
      setBusinessFeed(prev => {
        const allBusinesses = page === 1 ? newBusinesses : [...prev.businesses, ...newBusinesses.filter(b => !prev.businesses.some(eb => eb.id === b.id))];
        return {
          ...prev,
          businesses: allBusinesses,
          page: page,
          hasMore: newBusinesses.length === POSTS_PER_PAGE,
          isLoading: false,
        }
      });
    } catch (error) {
      console.error('Error fetching businesses:', error);
      setBusinessFeed(prev => ({ ...prev, isLoading: false }));
    }
  }, [location, radiusKm]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation || isFetchingLocation) return;
    
    setIsFetchingLocation(true);
    setLocationPromptVisible(false);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLocation(newLocation);
        setIsFetchingLocation(false);
        
        if (sessionUser) {
          updateUserLocation(newLocation.latitude, newLocation.longitude).catch(err => console.warn("Silent location update failed:", err));
        }
        
        fetchPosts('nearby', 1, sortBy, newLocation);
      },
      (err) => {
        console.warn("Could not get user location:", err.message);
        toast({ variant: 'destructive', title: 'Location Error', description: 'Could not access your location. Please check your browser settings.' });
        setLocationPromptVisible(true);
        setIsFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [isFetchingLocation, sessionUser, toast, fetchPosts, sortBy]);
  
  useEffect(() => {
    requestLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
        setSelectedCategory(null);
        setBusinessFeed(initialBusinessFeedState); 
        if (!location) {
            setLocationPromptVisible(true);
        }
    } else { 
        setLocationPromptVisible(false);
        if (feeds.nearby.posts.length === 0 && !feeds.nearby.isLoading) {
            fetchPosts('nearby', 1, sortBy, location);
        }
    }
  }, [unreadFamilyPostCount, feeds.family.posts.length, feeds.family.isLoading, fetchPosts, sortBy, location, feeds.nearby.posts.length, feeds.nearby.isLoading]);

  // This effect now only runs when the active tab changes from the URL
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
    } else {
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
    } else {
        const currentFeed = feeds[activeTab];
        if(currentFeed){
            isLoading = currentFeed.isLoading;
            hasMore = currentFeed.hasMore;
        }
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
    if(activeTab !== 'services' ) {
        fetchPosts(activeTab, 1, newSortBy, location);
    }
  };
  
  const handleRadiusChange = (newRadius: number) => {
    setRadiusKm(newRadius);
    fetchBusinesses(1, businessFeed.category);
  }

  const renderServiceCategories = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-primary tracking-tight">Book a Service</h2>
            {sessionUser && (
                <Button variant="outline" asChild>
                    <Link href="/account/my-bookings">
                        <CalendarCheck className="mr-2 h-4 w-4" /> My Bookings
                    </Link>
                </Button>
            )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {serviceCategories.map((category) => (
                <Card
                    key={category.name}
                    onClick={() => {
                        const categoryString = category.subcategories.join(',');
                        setSelectedCategory(categoryString);
                        fetchBusinesses(1, categoryString);
                    }}
                    className="p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-primary/20 hover:border-primary/50 transition-all duration-200"
                >
                    <category.icon className="h-12 w-12 text-accent mb-3"/>
                    <p className="font-semibold text-lg">{category.name}</p>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                </Card>
            ))}
        </div>
    </div>
  );

  const renderFeedContent = () => {
    if (activeTab === 'services') {
        if (!selectedCategory) {
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
        
        if (businessFeed.isLoading && businessFeed.page === 1) {
            return <PostFeedSkeleton />;
        }
        
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center mb-2">
                    <Button variant="ghost" onClick={() => setSelectedCategory(null)}>
                        <ArrowLeft className="mr-2 h-4 w-4"/>
                        Back to Categories
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 shadow-sm" asChild>
                      <Link href="/map">
                        <Map className="mr-2 h-4 w-4"/> Map View
                      </Link>
                    </Button>
                </div>

                {businessFeed.businesses.map((business) => (
                    <BusinessCard key={`db-${business.id}`} business={business} userLocation={location} sessionUser={sessionUser}/>
                ))}

                {!businessFeed.isLoading && businessFeed.businesses.length === 0 && (
                    <NoPostsContent feedType='services' radiusKm={radiusKm} onRadiusChange={handleRadiusChange} category={businessFeed.category} />
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

      <div className="flex items-center justify-between gap-4 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChangeRouter(tab.key)}
              className={cn(
                'relative w-full rounded-md py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-background/50'
              )}
            >
              {tab.label}
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                    {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              ) : null}
            </button>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 shadow-sm">
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
        </div>
        <div className="mt-4">
          {renderFeedContent()}
        </div>
    </div>
  );
};

export default PostFeedClient;
