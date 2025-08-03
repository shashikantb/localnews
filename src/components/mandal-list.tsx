
'use client';

import React, { useState, useEffect } from 'react';
import { getMandalsDb } from '@/app/actions';
import type { GanpatiMandal, User } from '@/lib/db-types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PartyPopper, MapPin, Edit } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { NoPostsContent } from './post-feed-client';
import MandalManagementDialog from './mandal-management-dialog';

const MandalCard: React.FC<{ mandal: GanpatiMandal; isOwner: boolean }> = ({ mandal, isOwner }) => {
    return (
      <Card className="hover:shadow-lg transition-shadow h-full">
          <CardHeader>
              <div className="flex justify-between items-start">
                  <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-primary">
                          <PartyPopper className="w-5 h-5" />
                          {mandal.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1.5 pt-1">
                          <MapPin className="w-4 h-4" />
                          {mandal.city}
                      </CardDescription>
                  </div>
                  {isOwner && (
                      <MandalManagementDialog mandal={mandal}>
                          <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4 mr-2" />
                              Manage
                          </Button>
                      </MandalManagementDialog>
                  )}
              </div>
          </CardHeader>
      </Card>
    );
};


const MandalList: React.FC<{ sessionUser: User | null }> = ({ sessionUser }) => {
    const [allMandals, setAllMandals] = useState<GanpatiMandal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        getMandalsDb()
            .then(setAllMandals)
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
    
    if (allMandals.length === 0) {
        return <NoPostsContent feedType="festival" />;
    }
    
    // Sort mandals to show the user's own mandals first
    const sortedMandals = [...allMandals].sort((a, b) => {
        const aIsOwner = a.admin_user_id === sessionUser?.id;
        const bIsOwner = b.admin_user_id === sessionUser?.id;
        if (aIsOwner && !bIsOwner) return -1;
        if (!aIsOwner && bIsOwner) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sortedMandals.map(mandal => (
                   <MandalCard 
                       key={mandal.id} 
                       mandal={mandal} 
                       isOwner={sessionUser?.id === mandal.admin_user_id}
                   />
                ))}
            </div>
        </div>
    );
};

export default MandalList;
