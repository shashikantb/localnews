
import { getSession } from '@/app/auth/actions';
import { redirect } from 'next/navigation';
import { getBusinessServicesDb, getBusinessHoursDb } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Wrench, Clock } from 'lucide-react';
import ManageServicesClient from './manage-services-client';
import ManageScheduleClient from './manage-schedule-client';

export const dynamic = 'force-dynamic';

export default async function ManageBusinessPage() {
    const { user } = await getSession();

    if (!user || user.role !== 'Business') {
        redirect('/');
    }

    // Fetch initial data in parallel
    const [initialServices, initialHours] = await Promise.all([
        getBusinessServicesDb(user.id),
        getBusinessHoursDb(user.id)
    ]);

    return (
        <div className="flex flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16">
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
                            Define the services you offer, set your schedule, and manage your bookings here.
                        </CardDescription>
                    </CardHeader>
                </Card>

                <ManageServicesClient initialServices={initialServices} />

                <Card className="shadow-lg border-border/60">
                    <CardHeader>
                         <CardTitle className="flex items-center">
                            <Clock className="w-6 h-6 mr-3 text-primary" />
                           Hours & Schedule
                        </CardTitle>
                        <CardDescription>Set your weekly working hours and days off.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ManageScheduleClient initialHours={initialHours} />
                    </CardContent>
                </Card>

                 <Card className="shadow-lg border-border/60 opacity-50">
                    <CardHeader>
                        <CardTitle>Resources</CardTitle>
                        <CardDescription>Coming Soon: Manage your bookable resources (e.g., salon chairs).</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}
