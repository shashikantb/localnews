
import { getSession } from '@/app/auth/actions';
import { redirect } from 'next/navigation';
import { getBusinessServicesDb } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Wrench } from 'lucide-react';
import ManageServicesClient from './manage-services-client';

export const dynamic = 'force-dynamic';

export default async function ManageBusinessPage() {
    const { user } = await getSession();

    if (!user || user.role !== 'Business') {
        redirect('/');
    }

    const initialServices = await getBusinessServicesDb(user.id);

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

                {/* Placeholder for future features */}
                <Card className="shadow-lg border-border/60 opacity-50">
                    <CardHeader>
                        <CardTitle>Hours & Schedule</CardTitle>
                        <CardDescription>Coming Soon: Set your working hours and days off.</CardDescription>
                    </CardHeader>
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
