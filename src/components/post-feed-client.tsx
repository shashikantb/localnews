
'use client';

import React, { type FC } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post, User, SortOption, BusinessUser } from '@/lib/db-types';
import { getPosts, getFamilyPosts, getNearbyBusinesses, registerDeviceToken, updateUserLocation } from '@/app/actions';
import { PostCard } from '@/components/post-card';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Loader2, Bell, BellOff, BellRing, AlertTriangle, Users, Rss, Filter, Briefcase } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ScrollArea } from '@/components/ui/scroll-area';

interface AndroidInterface {
  getFCMToken?: () => string | null;
}

declare global {
  interface Window {
    Android?: AndroidInterface;
  }
}

const POSTS_PER_PAGE = 5;

type FeedType = 'nearby' | 'family' | 'business';

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

function NoPostsContent({ feedType }: { feedType: FeedType }) {
  const messages = {
    nearby: {
      title: 'The air is quiet here...',
      description: 'No pulses found nearby. Be the first to post!'
    },
    family: {
      title: 'No Family Pulses Yet',
      description: 'Your family members have not posted anything yet. Share a family post to get started!'
    },
    business: {
      title: 'No Businesses Found',
      description: 'No businesses found in your area for the selected category. Try a different filter!'
    }
  }
  const currentMessage = messages[feedType];

  return (
    <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center">
        {feedType === 'business' ? <Briefcase className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" /> : <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />}
        <p className="text-2xl text-muted-foreground font-semibold">{currentMessage.title}</p>
        <p className="text-md text-muted-foreground/80 mt-2">{currentMessage.description}</p>
      </CardContent>
    </Card>
  );
}


// --- Main Component ---

interface PostFeedClientProps {
  sessionUser: User | null;
}

const PostFeedClient: FC<PostFeedClientProps> = ({ sessionUser }) => {
  const { toast } = useToast();
  
  const [feeds, setFeeds] = useState<{ [key in 'nearby' | 'family']: FeedState }>({
    nearby: { ...initialFeedState },
    family: { ...initialFeedState, isLoading: false }, // Family feed doesn't load initially
  });
  const [businessFeed, setBusinessFeed] = useState<BusinessFeedState>(initialBusinessFeedState);

  const [activeTab, setActiveTab] = useState<FeedType>('nearby');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<'default' | 'loading' | 'granted' | 'denied'>('default');
  const [showTroubleshootingDialog, setShowTroubleshootingDialog] = useState(false);
  
  const fetchPosts = useCallback(async (feed: 'nearby' | 'family', page: number, sort: SortOption) => {
    setFeeds(prev => ({ ...prev, [feed]: { ...prev[feed], isLoading: true } }));

    try {
        const fetcher = feed === 'nearby'
            ? getPosts({ page, limit: POSTS_PER_PAGE, latitude: location?.latitude, longitude: location?.longitude, sortBy: sort })
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
  }, [location?.latitude, location?.longitude]);

  const fetchBusinesses = useCallback(async (page: number, category?: string) => {
    setBusinessFeed(prev => ({ ...prev, isLoading: true }));
    try {
      if (!location) {
        // Don't fetch if location is not available
        setBusinessFeed(prev => ({ ...prev, isLoading: false, hasMore: false }));
        return;
      }
      const newBusinesses = await getNearbyBusinesses({ page, limit: POSTS_PER_PAGE, latitude: location?.latitude, longitude: location?.longitude, category });
      setBusinessFeed(prev => {
        const allBusinesses = page === 1 ? newBusinesses : [...prev.businesses, ...newBusinesses.filter(b => !prev.businesses.some(eb => eb.id === b.id))];
        return {
          ...prev,
          businesses: allBusinesses,
          page: page,
          hasMore: newBusinesses.length === POSTS_PER_PAGE,
          isLoading: false,
          category,
        };
      });
    } catch (error) {
      console.error('Error fetching businesses:', error);
      setBusinessFeed(prev => ({ ...prev, isLoading: false }));
    }
  }, [location]);


  // Initial location fetch
  useEffect(() => {
    const locationPromise = new Promise<{ latitude: number; longitude: number } | null>(resolve => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          resolve(null);
        }
    });

    locationPromise.then(loc => {
        setLocation(loc);
        if (sessionUser && loc) {
            updateUserLocation(loc.latitude, loc.longitude).catch(err => console.warn("Silent location update failed:", err));
        }
    });
  }, [sessionUser]);
  
  // Fetch data for the initial tab once location is known
  useEffect(() => {
    if (location !== null || !navigator.geolocation) {
        if(activeTab === 'nearby' || activeTab === 'family') {
            fetchPosts(activeTab, 1, sortBy);
        } else if (activeTab === 'business') {
            fetchBusinesses(1, businessFeed.category);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const handleTabChange = (value: string) => {
    const newTab = value as FeedType;
    setActiveTab(newTab);
    
    if (newTab === 'business') {
        if (businessFeed.businesses.length === 0 && !businessFeed.isLoading) {
            fetchBusinesses(1, businessFeed.category);
        }
    } else {
        if (feeds[newTab].posts.length === 0 && !feeds[newTab].isLoading) {
            fetchPosts(newTab, 1, sortBy);
        }
    }
  };

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
    
    const getTokenWithRetries = (retries = 3, delay = 500): Promise<string | null> => {
        return new Promise((resolve) => {
            let attempts = 0;
            const tryGetToken = () => {
                if (window.Android && typeof window.Android.getFCMToken === 'function') {
                    const token = window.Android.getFCMToken();
                    if (token) {
                        resolve(token);
                        return;
                    }
                }
                
                attempts++;
                if (attempts < retries) {
                    setTimeout(tryGetToken, delay);
                } else {
                    resolve(null);
                }
            };
            tryGetToken();
        });
    };

    try {
      if (window.Android && typeof window.Android.getFCMToken === 'function') {
        const token = await getTokenWithRetries();
        if (token) {
          const result = await registerDeviceToken(token, location?.latitude, location?.longitude);
          if (result.success) {
            setNotificationPermissionStatus('granted');
            toast({ title: "Success!", description: "You are now set up for notifications."});
          } else {
             console.error("Could not register for notifications:", result.error);
             setNotificationPermissionStatus('denied');
          }
        } else {
          setShowTroubleshootingDialog(true);
          setNotificationPermissionStatus('denied');
        }
      } else {
        toast({ title: "Web Notifications", description: "Web push notifications are not yet available. Please use our Android app for real-time updates." });
        setNotificationPermissionStatus('denied');
      }
    } catch (error) {
        console.error("Error during notification registration:", error);
        setShowTroubleshootingDialog(true);
        setNotificationPermissionStatus('denied');
    }
  };

  const refreshFeed = useCallback(async () => {
    setIsRefreshing(true);
    if(activeTab === 'business') {
        await fetchBusinesses(1, businessFeed.category);
    } else {
        await fetchPosts(activeTab, 1, sortBy);
    }
    setIsRefreshing(false);
    if (window) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, fetchPosts, sortBy, fetchBusinesses, businessFeed.category]);
  
  const handleLoadMore = useCallback(async () => {
    if (activeTab === 'business') {
        if (businessFeed.isLoading || !businessFeed.hasMore) return;
        fetchBusinesses(businessFeed.page + 1, businessFeed.category);
    } else {
        const currentFeed = feeds[activeTab];
        if (currentFeed.isLoading || !currentFeed.hasMore) return;
        fetchPosts(activeTab, currentFeed.page + 1, sortBy);
    }
  }, [feeds, activeTab, fetchPosts, sortBy, businessFeed, fetchBusinesses]);

  const observer = useRef<IntersectionObserver>();
  const loaderRef = useCallback((node: HTMLDivElement | null) => {
    const isLoading = activeTab === 'business' ? businessFeed.isLoading : feeds[activeTab].isLoading;
    const hasMore = activeTab === 'business' ? businessFeed.hasMore : feeds[activeTab].hasMore;
    
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
    if(activeTab !== 'business') {
        fetchPosts(activeTab, 1, newSortBy);
    }
  };

  const handleCategoryChange = (newCategory: string) => {
    const category = newCategory === 'all' ? undefined : newCategory;
    if(category === businessFeed.category) return;
    fetchBusinesses(1, category);
  };

  const renderFeedContent = () => {
    if (activeTab === 'business') {
        if ((businessFeed.isLoading && businessFeed.businesses.length === 0) || isRefreshing) {
            return <PostFeedSkeleton />;
        }
        return (
            <div className="space-y-6">
                {businessFeed.businesses.length > 0 ? (
                    businessFeed.businesses.map((business, index) => (
                        <BusinessCard key={business.id} business={business} userLocation={location} />
                    ))
                ) : (
                    <NoPostsContent feedType='business' />
                )}
                <div ref={loaderRef} className="h-1 w-full" />
                {businessFeed.isLoading && businessFeed.businesses.length > 0 && (
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
        {feed.posts.length > 0 ? (
          feed.posts.map((post, index) => (
            <PostCard key={post.id} post={post} userLocation={location} sessionUser={sessionUser} isFirst={index === 0} />
          ))
        ) : (
          <NoPostsContent feedType={activeTab} />
        )}
        <div ref={loaderRef} className="h-1 w-full" />
        {feed.isLoading && feed.posts.length > 0 && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    );
  };

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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <TabsList>
                <TabsTrigger value="nearby" className="flex items-center gap-2"><Rss className="w-4 h-4"/> Nearby</TabsTrigger>
                {sessionUser && <TabsTrigger value="family" className="flex items-center gap-2"><Users className="w-4 h-4"/> Family</TabsTrigger>}
                {sessionUser && <TabsTrigger value="business" className="flex items-center gap-2"><Briefcase className="w-4 h-4"/> Business</TabsTrigger>}
            </TabsList>
            <div className="flex items-center gap-2">
              {activeTab === 'business' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 shadow-sm">
                      <Filter className="w-4 h-4 mr-2" />
                      <span>Category</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <ScrollArea className="h-72">
                      <DropdownMenuRadioGroup value={businessFeed.category || 'all'} onValueChange={handleCategoryChange} className="p-1">
                        <DropdownMenuRadioItem value="all">All Categories</DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                          {Object.entries(BUSINESS_CATEGORIES).map(([group, categories]) => (
                              <React.Fragment key={group}>
                                  <DropdownMenuLabel>{group}</DropdownMenuLabel>
                                  {categories.map(category => (
                                      <DropdownMenuRadioItem key={category} value={category}>{category}</DropdownMenuRadioItem>
                                  ))}
                              </React.Fragment>
                          ))}
                      </DropdownMenuRadioGroup>
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
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
                      <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="likes">Most Popular</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="comments">Most Discussed</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

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

        <TabsContent value="nearby">
           {renderFeedContent()}
        </TabsContent>
        {sessionUser && <TabsContent value="family">{renderFeedContent()}</TabsContent>}
        {sessionUser && <TabsContent value="business">{renderFeedContent()}</TabsContent>}
      </Tabs>
    </div>
  );
};

export default PostFeedClient;
