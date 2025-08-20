
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { getAppointmentsForBusiness, updateAppointmentStatus } from './actions';
import type { BusinessAppointment, AppointmentStatus } from '@/lib/db-types';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Check, User, Clock, Scissors, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toMs } from '@/lib/toMs';

const AppointmentCard: React.FC<{ appointment: BusinessAppointment, onStatusChange: (id: number, status: AppointmentStatus) => void; isUpdating: boolean; }> = ({ appointment, onStatusChange, isUpdating }) => {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleUpdate = (status: AppointmentStatus) => {
        startTransition(async () => {
            const result = await updateAppointmentStatus(appointment.id, status);
            if (result.success) {
                toast({ title: 'Appointment Updated' });
                onStatusChange(appointment.id, status);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };

    const getStatusVariant = (status: AppointmentStatus) => {
        switch(status) {
            case 'completed': return 'success';
            case 'cancelled': return 'destructive';
            default: return 'secondary';
        }
    }

    return (
        <div className="p-4 border rounded-lg flex flex-col sm:flex-row gap-4 justify-between bg-muted/20">
            <div className="flex gap-4">
                <Avatar>
                    <AvatarImage src={appointment.customer_avatar || undefined} />
                    <AvatarFallback><User /></AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-foreground">{appointment.customer_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Scissors className="w-3 h-3"/>{appointment.service_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Tag className="w-3 h-3"/>₹{appointment.price}</p>
                </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
                 <div className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary"/>
                    {format(new Date(toMs(appointment.start_time)), 'h:mm a')} - {format(new Date(toMs(appointment.end_time)), 'h:mm a')}
                 </div>
                 <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(appointment.status)} className="capitalize">{appointment.status}</Badge>
                    {appointment.status === 'confirmed' && (
                        <Button size="sm" onClick={() => handleUpdate('completed')} disabled={isPending || isUpdating}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <Check className="mr-2 h-4 w-4"/> Mark as Done
                        </Button>
                    )}
                 </div>
            </div>
        </div>
    );
};


export default function ManageBookingsClient() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [appointments, setAppointments] = useState<BusinessAppointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, startUpdatingTransition] = useTransition();

    useEffect(() => {
        if (!date) return;
        setIsLoading(true);
        const dateString = format(date, 'yyyy-MM-dd');
        getAppointmentsForBusiness(dateString)
            .then(setAppointments)
            .finally(() => setIsLoading(false));
    }, [date]);

    const handleStatusChange = (appointmentId: number, newStatus: AppointmentStatus) => {
        setAppointments(prev => prev.map(appt => 
            appt.id === appointmentId ? { ...appt, status: newStatus } : appt
        ));
    };

    const normalizedAppointments = useMemo(() => {
        return (appointments ?? []).map((appt) => ({
            ...appt,
            __startMs: toMs(appt.start_time),
        }));
    }, [appointments]);

    const upcomingAppointments = useMemo(() => 
        normalizedAppointments
            .filter(a => a.status === 'confirmed')
            .sort((a,b) => a.__startMs - b.__startMs),
        [normalizedAppointments]
    );
    const pastAppointments = useMemo(() =>
        normalizedAppointments
            .filter(a => a.status !== 'confirmed')
            .sort((a,b) => b.__startMs - a.__startMs),
        [normalizedAppointments]
    );

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            <div className="mx-auto">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border"
                />
            </div>
            <div className="flex-1 space-y-4">
                 <h3 className="font-semibold text-lg text-center lg:text-left">
                    Appointments for {date ? format(date, 'PPP') : '...'}
                 </h3>
                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : appointments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No appointments scheduled for this day.</p>
                ) : (
                    <div className="space-y-4">
                        {upcomingAppointments.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-primary">Upcoming</h4>
                                {upcomingAppointments.map(appt => 
                                    <AppointmentCard key={appt.id} appointment={appt} onStatusChange={handleStatusChange} isUpdating={isUpdating} />
                                )}
                            </div>
                        )}
                         {pastAppointments.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-muted-foreground">Completed / Cancelled</h4>
                                {pastAppointments.map(appt => 
                                    <AppointmentCard key={appt.id} appointment={appt} onStatusChange={handleStatusChange} isUpdating={isUpdating} />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
