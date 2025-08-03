

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getMandalsDb } from '@/app/actions';
import type { GanpatiMandal, User } from '@/lib/db-types';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PartyPopper, MapPin, ThumbsUp, Loader2, Filter } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { NoPostsContent } from './post-feed-client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import MandalManagementDialog from './mandal-management-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  toggleMandalLikeDb
} from '@/lib/db'

const MandalCard: React.FC<{ mandal: GanpatiMandal; sessionUser: User | null; onUpdate: () => void; }> = ({ mandal: initialMandal, sessionUser, onUpdate }) => {
    const [mandal, setMandal] = useState(initialMandal);
    const [isLiking, setIsLiking] = useState(false);
    const { toast } = useToast();
    
    useEffect(() => {
        setMandal(initialMandal);
    }, [initialMandal]);

    const isOwner = sessionUser?.id === mandal.admin_user_id;

    const handleLike = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!sessionUser) {
            toast({ variant: 'destructive', title: 'You must be logged in to like a mandal.' });
            return;
        }
        setIsLiking(true);

        // Optimistic update
        const newIsLiked = !mandal.isLikedByCurrentUser;
        const newLikeCount = mandal.isLikedByCurrentUser ? mandal.likecount - 1 : mandal.likecount + 1;
        setMandal(prev => ({ ...prev, isLikedByCurrentUser: newIsLiked, likecount: newLikeCount }));

        const result = await toggleMandalLikeDb(sessionUser.id, mandal.id);
        if (!result) {
             toast({ variant: 'destructive', title: 'Failed to update like.' });
             setMandal(initialMandal); // Revert
        } else {
             setMandal(result); // Sync with server state
        }
        setIsLiking(false);
    };

    return (
        <Card className="hover:shadow-lg transition-shadow h-full w-full flex flex-col">
            <Link href={`/mandals/${mandal.id}`} className="block h-full flex flex-col flex-grow">
                <CardHeader className="flex-grow">
                    <CardTitle className="flex items-center gap-2 text-primary">
                        <PartyPopper className="w-5 h-5" />
                        {mandal.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5 pt-1">
                        <MapPin className="w-4 h-4" />
                        {mandal.city}
                    </CardDescription>
                </CardHeader>
                <CardFooter className="p-3 border-t bg-muted/50 flex items-center justify-between">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 justify-start"
                        onClick={handleLike}
                        disabled={isLiking}
                    >
                        {isLiking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className={cn("mr-2 h-4 w-4", mandal.isLikedByCurrentUser && "fill-current text-blue-500")} />}
                        {mandal.likecount} Likes
                    </Button>
                    {isOwner && (
                        <MandalManagementDialog mandal={mandal} onUpdate={onUpdate}>
                            <Button variant="secondary" size="sm">Manage</Button>
                        </MandalManagementDialog>
                    )}
                </CardFooter>
            </Link>
        </Card>
    );
};


const MandalList: React.FC<{ sessionUser: User | null }> = ({ sessionUser }) => {
    const [allMandals, setAllMandals] = useState<GanpatiMandal[]>([]);
    const [filteredMandals, setFilteredMandals] = useState<GanpatiMandal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cities, setCities] = useState<string[]>([]);
    const [selectedCity, setSelectedCity] = useState<string>('all');

    const fetchMandals = useCallback(() => {
        setIsLoading(true);
        getMandalsDb(sessionUser?.id)
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
            setFilteredMandals(allMandals.filter(m => m.city === selectedCity));
        }
    }, [selectedCity, allMandals]);
    
    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full max-w-xs" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }
    
    if (allMandals.length === 0) {
        return <NoPostsContent feedType="festival" />;
    }
    
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-muted-foreground"/>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Filter by city..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Cities</SelectItem>
                        {cities.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            {filteredMandals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredMandals.map(mandal => (
                       <MandalCard 
                           key={mandal.id} 
                           mandal={mandal} 
                           sessionUser={sessionUser}
                           onUpdate={fetchMandals}
                       />
                    ))}
                </div>
            ) : (
                <NoPostsContent feedType="festival" />
            )}
        </div>
    );
};

export default MandalList;
