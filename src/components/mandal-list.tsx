
'use client';

import React, { useState, useEffect } from 'react';
import { getMandalsDb } from '@/app/actions';
import type { GanpatiMandal } from '@/lib/db-types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PartyPopper, MapPin } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { NoPostsContent } from './post-feed-client'; // Assuming this is exported

const MandalCard: React.FC<{ mandal: GanpatiMandal }> = ({ mandal }) => (
    <Card className="hover:shadow-lg transition-shadow">
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
        {mandal.description && (
            <CardContent>
                <p className="text-sm text-muted-foreground">{mandal.description}</p>
            </CardContent>
        )}
    </Card>
);


const MandalList: React.FC = () => {
    const [mandals, setMandals] = useState<GanpatiMandal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        getMandalsDb()
            .then(setMandals)
            .catch(err => console.error("Failed to fetch mandals:", err))
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }
    
    if (mandals.length === 0) {
        return <NoPostsContent feedType="festival" />;
    }

    return (
        <div className="space-y-4">
            {mandals.map(mandal => (
                <MandalCard key={mandal.id} mandal={mandal} />
            ))}
        </div>
    );
};

export default MandalList;
