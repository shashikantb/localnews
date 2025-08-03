
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getMandalsDb, toggleMandalLikeDb } from '@/app/actions';
import type { GanpatiMandal, User } from '@/lib/db-types';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PartyPopper, MapPin, ThumbsUp, Loader2 } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { NoPostsContent } from './post-feed-client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MandalCard: React.FC<{ mandal: GanpatiMandal; sessionUser: User | null; }> = ({ mandal: initialMandal, sessionUser }) => {
    const [mandal, setMandal] = useState(initialMandal);
    const [isLiking, setIsLiking] = useState(false);
    const { toast } = useToast();

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
        
        // Optimistic update
        setMandal(prev => ({ ...prev, isLikedByCurrentUser: newIsLiked, likecount: newLikeCount }));

        const result = await toggleMandalLikeDb(mandal.id);
        if (!result) {
             toast({ variant: 'destructive', title: 'Failed to update like.' });
             // Revert optimistic update
             setMandal(initialMandal);
        } else {
             // Sync with server state
             setMandal(result);
        }
        setIsLiking(false);
    };

    return (
        <Link href={`/mandals/${mandal.id}`} className="block h-full">
            <Card className="hover:shadow-lg transition-shadow h-full w-full flex flex-col">
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
                <CardFooter className="p-3 border-t bg-muted/50">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full"
                        onClick={handleLike}
                        disabled={isLiking}
                    >
                        {isLiking ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <ThumbsUp className={cn("mr-2 h-4 w-4", mandal.isLikedByCurrentUser && "fill-current text-blue-500")} />
                        )}
                        {mandal.likecount} Likes
                    </Button>
                </CardFooter>
            </Card>
        </Link>
    );
};


const MandalList: React.FC<{ sessionUser: User | null }> = ({ sessionUser }) => {
    const [allMandals, setAllMandals] = useState<GanpatiMandal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchMandals = useCallback(() => {
        setIsLoading(true);
        getMandalsDb(sessionUser?.id)
            .then(setAllMandals)
            .catch(err => console.error("Failed to fetch mandals:", err))
            .finally(() => setIsLoading(false));
    }, [sessionUser]);

    useEffect(() => {
        fetchMandals();
    }, [fetchMandals]);
    
    if (isLoading) {
        return (
            <div className="space-y-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allMandals.map(mandal => (
                   <MandalCard 
                       key={mandal.id} 
                       mandal={mandal} 
                       sessionUser={sessionUser}
                   />
                ))}
            </div>
        </div>
    );
};

export default MandalList;
