
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { User, BusinessService, Appointment } from '@/lib/db-types';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogClose, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Calendar as CalendarIcon, ChevronLeft, Check, ArrowRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface BookingDialogProps {
  business: User;
  sessionUser: User | null;
  children: React.ReactNode;
}

const steps = ['Select Service', 'Select Date & Time', 'Confirm Booking'];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || 'An API error occurred');
  }
  return res.json() as Promise<T>;
}

export default function BookingDialog({ business, sessionUser, children }: BookingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [services, setServices] = useState<BusinessService[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [selectedService, setSelectedService] = useState<BusinessService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const businessId = (business as any).owner_user_id ?? (business as any).user_id ?? business.id;

  // Fetch services when dialog opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api<{ services: BusinessService[] }>(`/api/booking/services/${businessId}`)
        .then(data => setServices(data.services))
        .catch(e => {
          console.error(e);
          toast({ variant: 'destructive', title: 'Failed to load services.' });
          setIsOpen(false);
        })
        .finally(() => setIsLoading(false));
    } else {
      // Reset state on close
      setCurrentStep(0);
      setSelectedService(null);
      setSelectedDate(new Date());
      setSelectedTime(null);
      setTimeSlots([]);
    }
  }, [isOpen, businessId, toast]);

  // Fetch slots when service or date changes
  useEffect(() => {
    if (selectedService && selectedDate) {
      setIsLoadingSlots(true);
      setSelectedTime(null);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const url = `/api/booking/slots?businessId=${businessId}&serviceId=${selectedService.id}&date=${dateStr}`;
      
      api<{ slots: string[] }>(url)
        .then(data => setTimeSlots(data.slots))
        .catch(e => {
          console.error('Failed to fetch slots:', e);
          toast({ variant: 'destructive', title: 'Could not fetch slots.', description: e.message });
          setTimeSlots([]);
        })
        .finally(() => setIsLoadingSlots(false));
    }
  }, [selectedService, selectedDate, businessId, toast]);

  const handleCreateAppointment = async () => {
    if (!sessionUser) {
      toast({ variant: 'destructive', title: 'Please log in to book an appointment.' });
      router.push('/login');
      return;
    }
    if (!selectedService || !selectedDate || !selectedTime) {
      toast({ variant: 'destructive', title: 'Incomplete selection' });
      return;
    }
    setIsSubmitting(true);
    
    try {
      // The new API route for creation doesn't need to know about all the complex logic,
      // it just needs the final details to create the appointment row.
      // We will need to re-fetch appointments on the server in the createAppointmentDb function to prevent double bookings.
      // For now, let's assume the API handles it.
      const result = await api<{ success: boolean; error?: string; appointment?: Appointment }>('/api/booking/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              business_id: businessId,
              service_id: selectedService.id,
              date: format(selectedDate, 'yyyy-MM-dd'),
              time: selectedTime,
          }),
      });

      toast({ title: 'Appointment Booked!', description: `Your appointment with ${business.name} is confirmed.` });
      setIsOpen(false);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Booking Failed', description: error.message || 'Please try another slot.' });
    } finally {
        setIsSubmitting(false);
    }
  };


  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    switch (currentStep) {
      case 0: // Select Service
        return (
          <div className="space-y-3">
            {services.map((service) => (
              <Button
                key={service.id}
                variant="outline"
                className="w-full justify-between h-auto p-4"
                onClick={() => { setSelectedService(service); setCurrentStep(1); }}
              >
                <div>
                  <p className="font-semibold text-left">{service.name}</p>
                  <p className="text-sm text-muted-foreground text-left">{service.duration_minutes} min</p>
                </div>
                <p className="font-bold text-primary">₹{service.price}</p>
              </Button>
            ))}
            {services.length === 0 && <p className="text-center text-muted-foreground py-8">This business has not listed any services yet.</p>}
          </div>
        );

      case 1: // Select Date & Time
        return (
          <div className="flex flex-col sm:flex-row gap-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => { if (!date) return; setSelectedDate(new Date(date)); }}
              disabled={(date) => isPast(date) && !isToday(date)}
              className="rounded-md border mx-auto"
            />
            <div className="w-full sm:w-48 flex-shrink-0">
              <h4 className="font-semibold mb-2 text-center">Available Slots</h4>
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2">
                {isLoadingSlots ? (
                    <div className="col-span-3 flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : timeSlots.length > 0 ? (
                  timeSlots.map((time) => (
                    <Button key={time} variant={selectedTime === time ? 'default' : 'outline'} onClick={() => setSelectedTime(time)} size="sm">
                      {time}
                    </Button>
                  ))
                ) : (
                  <p className="col-span-3 text-center text-sm text-muted-foreground pt-4">No slots available for this day.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 2: // Confirm
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Confirm Your Appointment</h3>
            <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
              <div className="flex justify-between"><span className="text-muted-foreground">Business:</span> <span className="font-semibold">{business.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Service:</span> <span className="font-semibold">{selectedService?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date:</span> <span className="font-semibold">{selectedDate ? format(selectedDate, 'PPP') : ''}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time:</span> <span className="font-semibold">{selectedTime}</span></div>
              <div className="flex justify-between text-lg text-primary"><span className="text-muted-foreground">Price:</span> <span className="font-bold">₹{selectedService?.price}</span></div>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" /> Book Appointment with {business.name}
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            {steps.map((step, index) => (
              <div key={step} className={cn('flex-1 h-1 rounded-full', currentStep >= index ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
        </DialogHeader>

        {renderContent()}

        <DialogFooter className="pt-4">
          {currentStep > 0 && (
            <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          {currentStep < 2 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={currentStep === 0 ? !selectedService : !selectedTime}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleCreateAppointment} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="mr-2 h-4 w-4" /> Confirm Booking
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
