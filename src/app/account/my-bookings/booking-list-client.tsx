'use client';

import React, { useState, useTransition, useMemo } from 'react';
import type { CustomerAppointment } from '@/lib/db-types';
import { cancelMyBooking } from './actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { Loader2, Calendar, Clock, Tag, Building, XCircle, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const AppointmentCard: React.FC<{ appointment: CustomerAppointment, onCancel: (id: number) => void }> = ({ appointment, onCancel }) => {
    const [isCancelling, startTransition] = useTransition();
    const { toast } = useToast();

    const handleCancel = () => {
        startTransition(async () => {
            const result = await cancelMyBooking(appointment.id);
            if (result.success) {
                toast({ title: "Booking Cancelled", description: "Your appointment has been successfully cancelled." });
                onCancel(appointment.id);
            } else {
                toast({ variant: 'destructive', title: "Cancellation Failed", description: result.error });
            }
        });
    };
    
    const isUpcoming = appointment.status === 'confirmed' && new Date(appointment.start_time) > new Date();

    return (
        <Card className="shadow-lg border-border/60">
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="w-16 h-16 border-2 border-primary">
                            <AvatarImage src={appointment.business_avatar || undefined} />
                            <AvatarFallback>{appointment.business_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-primary">{appointment.service_name}</CardTitle>
                            <CardDescription>with <Link href={`/users/${appointment.business_id}`} className="font-semibold hover:underline">{appointment.business_name}</Link></CardDescription>
                        </div>
                    </div>
                    <Badge variant={
                        appointment.status === 'completed' ? 'success' : 
                        appointment.status === 'cancelled' ? 'destructive' : 'secondary'
                    } className="capitalize">{appointment.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4 text-primary" /> <span className="font-semibold text-foreground">{format(parseISO(appointment.start_time), 'EEEE, MMMM d, yyyy')}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4 text-primary" /> <span className="font-semibold text-foreground">{format(parseISO(appointment.start_time), 'h:mm a')}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Tag className="w-4 h-4 text-primary" /> <span className="font-semibold text-foreground">₹{appointment.price}</span></div>
            </CardContent>
            {isUpcoming && (
                 <CardFooter className="bg-muted/30 p-3">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" className="w-full" disabled={isCancelling}>
                                {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                                Cancel Booking
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This will permanently cancel your appointment. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCancel}>Yes, Cancel</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 </CardFooter>
            )}
        </Card>
    );
};

interface BookingListClientProps {
    initialBookings: CustomerAppointment[];
}

export default function BookingListClient({ initialBookings }: BookingListClientProps) {
    const [bookings, setBookings] = useState<CustomerAppointment[]>(initialBookings);

    const onCancel = (appointmentId: number) => {
        setBookings(prev => prev.map(b => b.id === appointmentId ? { ...b, status: 'cancelled' } : b));
    };

    const { upcoming, past } = useMemo(() => {
        const now = new Date();
        const upcomingBookings = bookings.filter(b => b.status === 'confirmed' && parseISO(b.start_time) >= now)
                                        .sort((a,b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime());
        const pastBookings = bookings.filter(b => b.status !== 'confirmed' || parseISO(b.start_time) < now)
                                     .sort((a,b) => parseISO(b.start_time).getTime() - parseISO(a.start_time).getTime());
        return { upcoming: upcomingBookings, past: pastBookings };
    }, [bookings]);


    if (bookings.length === 0) {
        return (
            <div className="text-center py-16">
                <Calendar className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">You have no bookings.</h3>
                <p className="text-muted-foreground">Find local services on the home page to make a booking.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {upcoming.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><CheckCircle className="w-6 h-6 text-primary"/>Upcoming Bookings</h2>
                    <div className="space-y-4">
                        {upcoming.map(booking => (
                            <AppointmentCard key={booking.id} appointment={booking} onCancel={onCancel} />
                        ))}
                    </div>
                </section>
            )}
             {past.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Clock className="w-6 h-6 text-muted-foreground"/>Past Bookings</h2>
                    <div className="space-y-4">
                        {past.map(booking => (
                            <AppointmentCard key={booking.id} appointment={booking} onCancel={onCancel} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}