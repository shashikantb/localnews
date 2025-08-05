

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getMandalsForFeed, toggleMandalLike, getMandalMediaPosts, sendAartiNotification } from '@/app/actions';
import type { GanpatiMandal, User, Post } from '@/lib/db-types';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PartyPopper, MapPin, ThumbsUp, Loader2, Filter, Edit, Bell } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { NoPostsContent } from './post-feed-client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import MandalManagementDialog from './mandal-management-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import MandalMediaViewer from './mandal-media-viewer';
import RegisterMandalDialog from './register-mandal-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';


const SendAartiNotificationButton: React.FC<{ mandal: GanpatiMandal }> = ({ mandal }) => {
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();

    const handleSend = async () => {
        setIsSending(true);
        const result = await sendAartiNotification(mandal.id);
        if (result.success) {
            toast({ title: 'Notification Sent!', description: `Sent Aarti notification to ${result.sentCount} nearby users.` });
        } else {
            toast({ variant: 'destructive', title: 'Failed to Send', description: result.error });
        }
        setIsSending(false);
    };

    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
                <Bell className="mr-2 h-4 w-4" /> Notify
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Send Aarti Notification for {mandal.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will send a push notification to all users within a 1km radius of your mandal. This action cannot be undone. Are you sure you want to proceed?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSend} disabled={isSending}>
                    {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Yes, Send Notification
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
};


const MandalCard: React.FC<{ mandal: GanpatiMandal; sessionUser: User | null; onUpdate: () => void; }> = ({ mandal: initialMandal, sessionUser, onUpdate }) => {
    const [mandal, setMandal] = useState(initialMandal);
    const [mediaPosts, setMediaPosts] = useState<Post[]>([]);
    const [isLoadingMedia, setIsLoadingMedia] = useState(true);
    const [isLiking, setIsLiking] = useState(false);
    const { toast } = useToast();
    
    useEffect(() => {
        setMandal(initialMandal);
    }, [initialMandal]);

    useEffect(() => {
        setIsLoadingMedia(true);
        getMandalMediaPosts(mandal.id)
            .then(setMediaPosts)
            .finally(() => setIsLoadingMedia(false));
    }, [mandal.id]);

    const isOwner = sessionUser?.id === mandal.admin_user_id;

    const handleLike = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!sessionUser) {
            toast({ variant: 'destructive', title: 'You must be logged in to like a mandal.' });
            return;
        }
        setIsLiking(true);

        const newIsLiked = !mandal.isLikedByCurrentUser;
        const newLikeCount = mandal.isLikedByCurrentUser ? mandal.likecount - 1 : mandal.likecount + 1;
        setMandal(prev => ({ ...prev, isLikedByCurrentUser: newIsLiked, likecount: newLikeCount }));

        const result = await toggleMandalLike(mandal.id);
        if (result.error || !result.mandal) {
             toast({ variant: 'destructive', title: 'Failed to update like.' });
             setMandal(initialMandal);
        } else {
             setMandal(result.mandal);
        }
        setIsLiking(false);
    };

    return (
        <Card className="hover:shadow-lg transition-shadow h-full w-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                    <PartyPopper className="w-5 h-5" />
                    {mandal.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5 pt-1">
                    <MapPin className="w-4 h-4" />
                    {mandal.city}
                </CardDescription>
            </CardHeader>
             <CardContent className="p-0">
                {isLoadingMedia ? (
                    <div className="aspect-video w-full flex items-center justify-center bg-muted">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <MandalMediaViewer posts={mediaPosts} />
                )}
            </CardContent>
            <CardFooter className="p-3 border-t bg-muted/50 flex items-center justify-between flex-wrap gap-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 justify-start h-9"
                    onClick={handleLike}
                    disabled={isLiking}
                >
                    {isLiking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className={cn("mr-2 h-4 w-4", mandal.isLikedByCurrentUser && "fill-current text-blue-500")} />}
                    {mandal.likecount} Likes
                </Button>
                {isOwner && (
                    <div className="flex items-center gap-2">
                        <SendAartiNotificationButton mandal={mandal} />
                        <MandalManagementDialog mandal={mandal} onUpdate={onUpdate}>
                            <Button variant="secondary" size="sm" className="h-9">Manage</Button>
                        </MandalManagementDialog>
                    </div>
                )}
            </CardFooter>
        </Card>
    );
};


const MandalList: React.FC<{ sessionUser: User | null, userLocation: { latitude: number, longitude: number } | null }> = ({ sessionUser, userLocation }) => {
    const [allMandals, setAllMandals] = useState<GanpatiMandal[]>([]);
    const [filteredMandals, setFilteredMandals] = useState<GanpatiMandal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cities, setCities] = useState<string[]>([]);
    const [selectedCity, setSelectedCity] = useState<string>('all');

    const fetchMandals = useCallback(() => {
        setIsLoading(true);
        getMandalsForFeed(sessionUser?.id)
            .then(mandals => {
                setAllMandals(mandals);
                setFilteredMandals(mandals);
                const uniqueCities = Array.from(new Set(mandals.map(m => m.city))).sort();
                setCities(uniqueCities);
            })
            .catch(err => console.error("Failed to fetch mandals:", err))
            .finally(() => setIsLoading(false));
    }, [sessionUser]);

    useEffect(() => {
        fetchMandals();
    }, [fetchMandals]);

    useEffect(() => {
        if (selectedCity === 'all') {
            setFilteredMandals(allMandals);
        } else {
            const cityFiltered = allMandals.filter(m => m.city === selectedCity);
            setFilteredMandals(cityFiltered.sort((a, b) => a.name.localeCompare(b.name)));
        }
    }, [selectedCity, allMandals]);
    
    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full max-w-xs" />
                <div className="space-y-6">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }
    
    if (allMandals.length === 0) {
        return (
            <div className="text-center py-10">
                <NoPostsContent feedType="festival" />
                <div className="mt-6">
                    <RegisterMandalDialog userLocation={userLocation} />
                </div>
            </div>
        )
    }
    
    return (
        <div className="space-y-4">
             <div className="flex flex-col sm:flex-row gap-4 justify-between items-center p-3 border bg-card rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">Know a Mandal not listed here?</p>
                <RegisterMandalDialog userLocation={userLocation} />
            </div>

            <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-muted-foreground"/>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Filter by city..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Cities (by Likes)</SelectItem>
                        {cities.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-6">
                {filteredMandals.length > 0 ? (
                    filteredMandals.map(mandal => (
                       <MandalCard 
                           key={mandal.id} 
                           mandal={mandal} 
                           sessionUser={sessionUser}
                           onUpdate={fetchMandals}
                       />
                    ))
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        <p>No mandals found for the selected city.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MandalList;
