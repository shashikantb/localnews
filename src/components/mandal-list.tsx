
'use client';

import React, { useState, useEffect } from 'react';
import { getMandalsDb, getMandalsForUserDb } from '@/app/actions';
import type { GanpatiMandal, User } from '@/lib/db-types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PartyPopper, MapPin } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { NoPostsContent } from './post-feed-client';
import MandalManagementDialog from './mandal-management-dialog';

const MandalCard: React.FC<{ mandal: GanpatiMandal, isOwner: boolean }> = ({ mandal, isOwner }) => {
    const cardContent = (
      <Card className="hover:shadow-lg transition-shadow h-full">
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
      </Card>
    );

    if (isOwner) {
        return (
            <MandalManagementDialog mandal={mandal}>
                <div className="cursor-pointer h-full">{cardContent}</div>
            </MandalManagementDialog>
        );
    }

    return <div className="h-full">{cardContent}</div>;
};


const MandalList: React.FC<{ sessionUser: User | null }> = ({ sessionUser }) => {
    const [allMandals, setAllMandals] = useState<GanpatiMandal[]>([]);
    const [userMandals, setUserMandals] = useState<GanpatiMandal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const fetchMandals = async () => {
            try {
                const [all, user] = await Promise.all([
                    getMandalsDb(),
                    sessionUser ? getMandalsForUserDb(sessionUser.id) : Promise.resolve([])
                ]);
                setAllMandals(all);
                setUserMandals(user);
            } catch (err) {
                console.error("Failed to fetch mandals:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMandals();
    }, [sessionUser]);
    
    const userMandalIds = new Set(userMandals.map(m => m.id));
    const otherMandals = allMandals.filter(m => !userMandalIds.has(m.id));

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
        <div className="space-y-6">
            {userMandals.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-primary pl-1 border-b-2 border-primary/20 pb-2">Your Registered Mandals</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {userMandals.map(mandal => (
                           <MandalCard key={`user-${mandal.id}`} mandal={mandal} isOwner={true} />
                        ))}
                    </div>
                </div>
            )}
            {otherMandals.length > 0 && (
                 <div className="space-y-3">
                    {userMandals.length > 0 && <h3 className="text-lg font-semibold text-muted-foreground pl-1 border-b pb-2">Other Mandals</h3>}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {otherMandals.map(mandal => (
                           <MandalCard key={`other-${mandal.id}`} mandal={mandal} isOwner={sessionUser?.id === mandal.admin_user_id} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MandalList;
