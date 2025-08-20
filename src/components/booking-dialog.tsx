
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { User, BusinessService, BusinessHour, BusinessResource } from '@/lib/db-types';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogClose, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Calendar as CalendarIcon, ChevronLeft, Check, ArrowRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isBefore, addMinutes } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface BookingDialogProps {
  business: User;
  sessionUser: User | null;
  children: React.ReactNode;
}

type BusySlot = { startUtc: string; endUtc: string; resourceId?: number };

const steps = ['Select Service', 'Select Date & Time', 'Confirm Booking'];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || 'An API error occurred');
  }
  return res.json() as Promise<T>;
}

// Helper to check for overlaps
const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

// Builds potential slots based on working hours
function buildSlotsForWindow(
  dateISO: string,
  tz: string,
  windowStartHHmm: string,
  windowEndHHmm: string,
  durationMin: number,
  stepMin: number
): Date[] {
  const startUtc = zonedTimeToUtc(`${dateISO} ${windowStartHHmm}`, tz);
  const endUtc = zonedTimeToUtc(`${dateISO} ${windowEndHHmm}`, tz);

  const slots: Date[] = [];
  for (let s = startUtc; addMinutes(s, durationMin) <= endUtc; s = addMinutes(s, stepMin)) {
    slots.push(new Date(s));
  }
  return slots;
}

// Filters out past and conflicting slots
function filterAvailable(
  slotsUtc: Date[],
  durationMin: number,
  tz: string,
  busySlots: BusySlot[],
  totalResources: number,
) {
  const nowInTz = utcToZonedTime(new Date(), tz);

  return slotsUtc.filter((slotStartUtc) => {
    // 1) Hide past slots in the business's timezone
    const slotStartInTz = utcToZonedTime(slotStartUtc, tz);
    if (isBefore(slotStartInTz, nowInTz)) {
      return false;
    }

    // 2) Hide slots that conflict with existing bookings
    const slotEndUtc = addMinutes(slotStartUtc, durationMin);
    const conflictingAppointments = busySlots.filter(b =>
      overlaps(slotStartUtc, slotEndUtc, new Date(b.startUtc), new Date(b.endUtc))
    ).length;
    
    // A slot is available if the number of conflicts is less than the number of resources
    return conflictingAppointments < totalResources;
  });
}


export default function BookingDialog({ business, sessionUser, children }: BookingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [services, setServices] = useState<BusinessService[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [resources, setResources] = useState<BusinessResource[]>([]);
  const [timeSlots, setTimeSlots] = useState<Date[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [selectedService, setSelectedService] = useState<BusinessService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  const businessId = business.id;
  const businessTimeZone = business.timezone || 'UTC';

  // Fetch services and hours when dialog opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      Promise.all([
          api<{ services: BusinessService[] }>(`/api/booking/services/${businessId}`),
          api<{ hours: BusinessHour[] }>(`/api/booking/hours/${businessId}`),
          api<{ resources: BusinessResource[] }>(`/api/booking/resources/${businessId}`),
      ]).then(([serviceData, hourData, resourceData]) => {
          setServices(serviceData.services);
          setHours(hourData.hours);
          setResources(resourceData.resources);
      }).catch(e => {
          console.error(e);
          toast({ variant: 'destructive', title: 'Failed to load business details.' });
          setIsOpen(false);
      }).finally(() => setIsLoading(false));
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
    if (!selectedService || !selectedDate || hours.length === 0) return;

    setIsLoadingSlots(true);
    setSelectedTime(null);
    setTimeSlots([]);

    const dateISO = format(selectedDate, 'yyyy-MM-dd');
    const dayOfWeek = selectedDate.getDay();
    const workingWindows = hours.filter(h => h.day_of_week === dayOfWeek && !h.is_closed && h.start_time && h.end_time);

    const stepMin = 15; // Slots every 15 minutes
    const totalResources = resources.length > 0 ? resources.length : 1;

    api<{ busy: BusySlot[] }>(`/api/booking/availability?businessId=${businessId}&date=${dateISO}&tz=${businessTimeZone}`)
      .then(({ busy }) => {
          const allPotentialSlots = workingWindows.flatMap(w =>
              buildSlotsForWindow(dateISO, businessTimeZone, w.start_time, w.end_time, selectedService.duration_minutes, stepMin)
          );
          const available = filterAvailable(allPotentialSlots, selectedService.duration_minutes, businessTimeZone, busy, totalResources);
          setTimeSlots(available);
      })
      .catch(e => {
          console.error('Failed to fetch availability:', e);
          toast({ variant: 'destructive', title: 'Could not fetch slots.', description: e.message });
      })
      .finally(() => setIsLoadingSlots(false));

  }, [selectedService, selectedDate, businessId, businessTimeZone, hours, resources, toast]);

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
      await api('/api/booking/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              business_id: businessId,
              service_id: selectedService.id,
              date: format(selectedDate, 'yyyy-MM-dd'),
              time: format(selectedTime, 'HH:mm'), // Send the selected slot time
          }),
      });

      toast({ title: 'Appointment Booked!', description: `Your appointment with ${business.name} is confirmed.` });
      setIsOpen(false);
      router.push('/account/my-bookings');

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
              onSelect={(date) => { if (date) setSelectedDate(date); }}
              disabled={(date) => isBefore(date, new Date()) && !format(date, 'yyyy-MM-dd').includes(format(new Date(), 'yyyy-MM-dd'))}
              className="rounded-md border mx-auto"
            />
            <div className="w-full sm:w-48 flex-shrink-0">
              <h4 className="font-semibold mb-2 text-center">Available Slots</h4>
              <ScrollArea className="h-60 pr-2">
                <div className="grid grid-cols-3 gap-2">
                  {isLoadingSlots ? (
                      <div className="col-span-3 flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
                  ) : timeSlots.length > 0 ? (
                    timeSlots.map((slotDate) => (
                      <Button 
                        key={slotDate.toISOString()} 
                        variant={selectedTime?.getTime() === slotDate.getTime() ? 'default' : 'outline'} 
                        onClick={() => setSelectedTime(slotDate)} 
                        size="sm"
                      >
                        {format(slotDate, 'HH:mm')}
                      </Button>
                    ))
                  ) : (
                    <p className="col-span-3 text-center text-sm text-muted-foreground pt-4">No slots available for this day.</p>
                  )}
                </div>
              </ScrollArea>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Time:</span> <span className="font-semibold">{selectedTime ? format(selectedTime, 'p') : ''}</span></div>
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
            <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={(currentStep === 0 && !selectedService) || (currentStep === 1 && !selectedTime)}>
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
