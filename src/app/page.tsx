'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { Post, NewPost } from '@/lib/db-types';
import { getPosts, addPost } from './actions';
import { PostCard } from '@/components/post-card';
import { PostForm } from '@/components/post-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal, Zap, Loader2, Filter, SlidersHorizontal, Rss } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"

const Home: FC = () => {
  const { toast } = useToast();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [distanceFilterKm, setDistanceFilterKm] = useState<number>(101); // Default to max (Any Distance)
  const [showAnyDistance, setShowAnyDistance] = useState<boolean>(true); // Default to "Any Distance"

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
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
  }, []);

  const processAndSetPosts = useCallback((postsToProcess: Post[], currentLocation: { latitude: number; longitude: number } | null, currentDistanceFilterKm: number, currentShowAnyDistance: boolean) => {
    let filtered = postsToProcess;
    if (currentLocation && !currentShowAnyDistance) {
      filtered = postsToProcess.filter(p =>
        calculateDistance(currentLocation.latitude, currentLocation.longitude, p.latitude, p.longitude) <= currentDistanceFilterKm
      );
    }

    const sorted = [...filtered];
    if (currentLocation) {
      sorted.sort((a, b) => {
        const distA = calculateDistance(currentLocation.latitude, currentLocation.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(currentLocation.latitude, currentLocation.longitude, b.latitude, b.longitude);
        if (Math.abs(distA - distB) < 0.1) {
          return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
        }
        return distA - distB;
      });
    } else {
      sorted.sort((a, b) => new Date(b.createdat).getTime() - new Date(a.createdat).getTime());
    }
    setDisplayedPosts(sorted);
  }, [calculateDistance]);


  useEffect(() => {
    setLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError(null);
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          let errorMessage = `Error getting location: ${error.message}. Please ensure location services are enabled.`;
           // Handle insecure origin error specifically
          if (error.code === error.PERMISSION_DENIED && error.message.includes('Only secure origins are allowed')) {
            errorMessage = `Error getting location: Location access is only available on secure (HTTPS) connections. Functionality might be limited. Enable HTTPS for your site.`;
          }
          setLocationError(errorMessage);
          setLoadingLocation(false);
          toast({
            variant: "destructive",
            title: "Location Error",
            description: errorMessage,
            duration: 9000, // Longer duration for important errors
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
      setLoadingLocation(false);
      toast({
        variant: "destructive",
        title: "Location Error",
        description: "Geolocation is not supported. Filters and sorting by distance will be affected.",
      });
    }
  }, [toast]);


  useEffect(() => {
    const fetchInitialPosts = async () => {
      setLoadingPosts(true);
      try {
        const fetchedPosts = await getPosts();
        setAllPosts(fetchedPosts);
      } catch (error) {
        console.error("Error fetching posts:", error);
        toast({
          variant: "destructive",
          title: "Fetch Error",
          description: "Could not load posts. Please try again later.",
        });
      } finally {
        setLoadingPosts(false);
      }
    };

    if (!loadingLocation) { // Only fetch posts after location attempt is complete
        fetchInitialPosts();
    }
  }, [loadingLocation, toast]);

  useEffect(() => {
    if (!loadingPosts) { // Only process if posts are loaded
        processAndSetPosts(allPosts, location, distanceFilterKm, showAnyDistance);
    }
  }, [allPosts, location, distanceFilterKm, showAnyDistance, processAndSetPosts, loadingPosts]);


  const handleAddPost = async (content: string, mediaUrl?: string, mediaType?: 'image' | 'video') => {
    if (!location) {
      const errMessage = "Cannot post without location. Please enable location services.";
      setLocationError(errMessage);
      toast({
        variant: "destructive",
        title: "Post Error",
        description: errMessage,
      });
      return;
    }
    setFormSubmitting(true);
    try {
      const postData: NewPost = {
        content,
        latitude: location.latitude,
        longitude: location.longitude,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
      };

      const result = await addPost(postData);

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Post Error",
          description: result.error || "Failed to add your post. Please try again.",
        });
      } else if (result.post) {
        setAllPosts(prevPosts => [result.post!, ...prevPosts]);
        toast({
          title: "Post Added!",
          description: "Your pulse is now live!",
          variant: "default",
          className: "bg-primary text-primary-foreground",
        });
      } else {
         toast({
          variant: "destructive",
          title: "Post Error",
          description: "An unexpected issue occurred. Failed to add your post.",
        });
      }

    } catch (error: any) { // Catch any errors not handled by the server action's return type
      console.error("Error adding post (client-side catch):", error);
      toast({
        variant: "destructive",
        title: "Post Error",
        description: error.message || "An unexpected client-side error occurred. Please try again.",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDistanceChange = (value: number[]) => {
    setDistanceFilterKm(value[0]);
    if (value[0] > 100) {
        setShowAnyDistance(true);
    } else {
        setShowAnyDistance(false);
    }
  };

  const FilterSheetContent = () => (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center"><Filter className="w-5 h-5 mr-2 text-accent" /> Filter Pulses</SheetTitle>
        <SheetDescription>
          Adjust the distance to find pulses near you. Your current location is used as the center.
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 py-4">
        <div className="space-y-3">
          <Label htmlFor="distance-filter-slider" className="text-muted-foreground flex justify-between items-center">
            <span>Max Distance:</span>
            <span className="font-semibold text-primary">
              {showAnyDistance ? "Any Distance" : `${distanceFilterKm} km`}
            </span>
          </Label>
          <Slider
            id="distance-filter-slider"
            min={1}
            max={101} // Keep max at 101 to represent "Any Distance"
            step={1}
            value={[distanceFilterKm]} // Use controlled value
            onValueChange={handleDistanceChange} // Update state on change
            disabled={!location || loadingPosts}
            aria-label="Distance filter"
          />
          {!location && <p className="text-xs text-destructive mt-1">Enable location services to use distance filter.</p>}
        </div>
        {/* Simplified button to just reset to "Any Distance" */}
        <Button
            variant="outline"
            onClick={() => {
                setDistanceFilterKm(101);
                setShowAnyDistance(true);
            }}
            disabled={!location || loadingPosts || showAnyDistance} // Disable if already "Any Distance"
            className="w-full"
        >
            Show Pulses from Any Distance
        </Button>
      </div>
      <SheetFooter>
        <SheetClose asChild>
          <Button variant="outline">Close</Button>
        </SheetClose>
      </SheetFooter>
      <p className="text-xs text-center pt-4 text-muted-foreground/80">Developed by S. P. Borgavakar</p>
    </>
  );


  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
        <div className="container mx-auto max-w-2xl space-y-8 py-8">
        <header className="text-center space-y-3 py-8 bg-card/90 backdrop-blur-lg rounded-xl shadow-2xl border border-border/50 sticky top-4 z-40 transform hover:scale-[1.01] transition-transform duration-300">
            <div className="flex items-center justify-center space-x-3 animate-pulse-slow">
              <Rss className="h-16 w-16 text-accent drop-shadow-[0_0_15px_rgba(var(--accent-hsl),0.5)]" />
              <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary tracking-tight drop-shadow-lg">
                LocalPulse
              </h1>
            </div>
            <p className="text-xl text-muted-foreground font-medium">Catch the Vibe, Share the Pulse.</p>
            <p className="text-xs text-muted-foreground/80">Developed by S. P. Borgavakar</p>
        </header>

        {loadingLocation && (
            <Card className="flex flex-col items-center justify-center space-y-3 p-6 rounded-lg shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Locating Your Vibe...</p>
            <Skeleton className="h-4 w-3/4 bg-muted-foreground/10 rounded-md" />
            <Skeleton className="h-4 w-1/2 bg-muted-foreground/10 rounded-md" />
            </Card>
        )}

        {locationError && !loadingLocation && (
            <Alert variant="destructive" className="shadow-xl border-destructive/70">
            <Terminal className="h-6 w-6" />
            <AlertTitle className="text-lg font-semibold">Location Access Denied</AlertTitle>
            <AlertDescription className="text-base">{locationError}</AlertDescription>
            </Alert>
        )}

        {!loadingLocation && (
            <div className="space-y-8">
            {location && (
                <Card className="overflow-hidden shadow-2xl border border-primary/30 rounded-xl bg-card/90 backdrop-blur-md transform hover:shadow-primary/20 transition-all duration-300 hover:border-primary/60">
                <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/5 p-5">
                    <CardTitle className="text-2xl font-semibold text-primary flex items-center">
                    <Zap className="w-7 h-7 mr-2 text-accent drop-shadow-sm" />
                    Share Your Pulse
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                    <PostForm onSubmit={handleAddPost} submitting={formSubmitting} />
                    <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary/80" />
                    Pulse Origin: {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
                    </p>
                </CardContent>
                {/* Removed "Developed by..." text from here */}
                </Card>
            )}

            <div className="flex justify-end sticky top-[calc(theme(spacing.4)_+_theme(headerHeight,9rem))] z-30 -mt-4 mb-4"> {/* Adjusted top value based on header */}
                <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" className="shadow-lg hover:shadow-xl transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary">
                    <SlidersHorizontal className="w-5 h-5 mr-2" />
                    Filters
                    </Button>
                </SheetTrigger>
                <SheetContent className="bg-card/95 backdrop-blur-md border-border">
                    <FilterSheetContent />
                     {/* Removed "Developed by..." text from here */}
                </SheetContent>
                </Sheet>
            </div>


            <div className="space-y-6">
                <h2 className="text-4xl font-bold text-primary pl-1 flex items-center border-b-2 border-primary/30 pb-3 mb-6">
                <Rss className="w-9 h-9 mr-3 text-accent opacity-90" />
                Nearby Pulses
                </h2>
                {loadingPosts && !allPosts.length ? (
                Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-4 p-5 bg-card/70 backdrop-blur-sm rounded-xl shadow-xl animate-pulse border border-border/30">
                    <div className="flex items-center space-x-3">
                        <Skeleton className="h-12 w-12 rounded-full bg-muted/50" />
                        <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3 bg-muted/50" />
                        <Skeleton className="h-3 w-1/4 bg-muted/50" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-full bg-muted/50" />
                    <Skeleton className="h-5 w-5/6 bg-muted/50" />
                    <Skeleton className="h-40 w-full bg-muted/50 rounded-md" />
                     {/* Removed "Developed by..." text from skeleton */}
                    </div>
                ))
                ) : displayedPosts.length > 0 ? (
                displayedPosts.map((post) => (
                    <PostCard
                    key={post.id}
                    post={post}
                    userLocation={location}
                    calculateDistance={calculateDistance}
                    />
                ))
                ) : (
                <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center">
                    <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
                    <p className="text-2xl text-muted-foreground font-semibold">
                        {allPosts.length > 0 && !showAnyDistance ? "No pulses found in this range." : "The air is quiet here..."}
                    </p>
                    <p className="text-md text-muted-foreground/80 mt-2">
                        {allPosts.length > 0 && !showAnyDistance ? "Try expanding the distance or " : ""}
                        Be the first to make some noise!
                    </p>
                     {/* Removed "Developed by..." text from here */}
                    </CardContent>
                </Card>
                )}
            </div>
            </div>
        )}
        </div>
    </main>
  );
};

export default Home;