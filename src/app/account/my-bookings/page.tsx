

import { getSession } from '@/app/auth/actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import BookingListClient from './booking-list-client';
import { getAppointmentsForCustomerDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MyBookingsPage() {
    const { user } = await getSession();
    if (!user) {
        redirect('/login');
    }

    const initialBookings = await getAppointmentsForCustomerDb(user.id);

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
                            <CalendarCheck className="w-8 h-8 mr-3 text-primary" />
                            My Bookings
                        </CardTitle>
                        <CardDescription>
                            View and manage your upcoming and past appointments here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BookingListClient initialBookings={initialBookings} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
