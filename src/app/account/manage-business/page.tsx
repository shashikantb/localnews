

import { getSession } from '@/app/auth/actions';
import { redirect } from 'next/navigation';
import { getBusinessServicesDb, getBusinessHoursDb, getBusinessResourcesDb, getUserByIdDb } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Wrench } from 'lucide-react';
import ManageBusinessTabs from './manage-business-tabs';


export const dynamic = 'force-dynamic';

export default async function ManageBusinessPage() {
    const { user } = await getSession();

    if (!user || user.role !== 'Business') {
        redirect('/');
    }

    // Fetch initial data for all tabs in parallel, including full business user details for timezone
    const [initialServices, initialHours, initialResources, businessUser] = await Promise.all([
        getBusinessServicesDb(user.id),
        getBusinessHoursDb(user.id),
        getBusinessResourcesDb(user.id),
        getUserByIdDb(user.id), // Fetch the full user object
    ]);
    
    if(!businessUser) {
        // This case should ideally not happen if the session is valid
        redirect('/');
    }

    return (
        <div className="flex flex-col items-center p-4 sm:p-6 md:p-8">
            <div className="container mx-auto w-full max-w-2xl space-y-6">
                 <Button variant="outline" size="sm" asChild>
                    <Link href={`/users/${user.id}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Profile
                    </Link>
                </Button>

                <Card className="shadow-lg border-border/60">
                    <CardHeader>
                        <CardTitle className="flex items-center text-3xl font-bold">
                            <Wrench className="w-8 h-8 mr-3 text-primary" />
                            Manage Business
                        </CardTitle>
                        <CardDescription>
                            Define your services, set your schedule, and manage your bookings here.
                        </CardDescription>
                    </CardHeader>
                </Card>

                <ManageBusinessTabs
                    initialServices={initialServices}
                    initialHours={initialHours}
                    initialResources={initialResources}
                    businessUser={businessUser}
                />
            </div>
        </div>
    );
}
