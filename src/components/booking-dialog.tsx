
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { User, BusinessService, BusinessHour, BusinessResource, Appointment } from '@/lib/db-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Calendar as CalendarIcon, Clock, Scissors, Armchair, ChevronLeft, Check, ArrowRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, setHours, setMinutes, startOfDay, getDay, addMinutes, isPast, isToday, areIntervalsOverlapping } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface BookingDialogProps {
  business: User;
  sessionUser: User | null;
  children: React.ReactNode;
}

const steps = ['Select Service', 'Select Date & Time', 'Confirm Booking'];

// Helper to safely parse dates, returning null for invalid ones
const toValidDate = (v: string | Date | null | undefined) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Helper to ensure service duration is a valid number
const safeDuration = (n: unknown, fallback = 30) => {
  const num = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  if (!res.ok) throw new Error(await res.text());
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
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [resources, setResources] = useState<BusinessResource[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [selectedService, setSelectedService] = useState<BusinessService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const fetchBusinessData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, h, r] = await Promise.all([
        api<{services:any[]}>('/api/booking/services/' + business.id),
        api<{hours:any[]}>('/api/booking/hours/' + business.id),
        api<{resources:any[]}>(`/api/booking/resources/${business.id}`),
      ]);
      setServices(s.services);
      setHours(h.hours);
      setResources(r.resources);
    } catch (e) {
      console.error(e);
      toast({ variant:"destructive", title:"Failed to load booking data" });
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [business.id, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchBusinessData();
    } else {
      // Reset state when dialog closes
      setCurrentStep(0);
      setSelectedService(null);
      setSelectedDate(new Date());
      setSelectedTime(null);
    }
  }, [isOpen, fetchBusinessData]);

  useEffect(() => {
    if (!selectedDate) return;
    api<{appointments:any[]}>(`/api/booking/appointments?businessId=${business.id}&date=${format(selectedDate,'yyyy-MM-dd')}`)
      .then(d => setAppointments(Array.isArray(d.appointments) ? d.appointments : []))
      .catch(() => setAppointments([]));
  }, [selectedDate, business.id]);

  const timeSlots = useMemo(() => {
    if (!selectedDate || !selectedService || !Array.isArray(hours)) return [];

    const dayOfWeek = getDay(selectedDate);
    const dayHours = hours.find(h => h?.day_of_week === dayOfWeek);

    if (!dayHours || dayHours.is_closed || !dayHours.start_time || !dayHours.end_time) return [];

    const serviceDuration = safeDuration((selectedService as any).duration_minutes, 30);

    const [startH, startM] = String(dayHours.start_time).split(':').map(Number);
    const [endH, endM]   = String(dayHours.end_time).split(':').map(Number);

    const start = setMinutes(setHours(startOfDay(selectedDate), startH || 0), startM || 0);
    const end   = setMinutes(setHours(startOfDay(selectedDate), endH || 0),   endM || 0);

    if (!(start < end)) return [];

    const out: string[] = [];
    let cur = start;

    while (cur < end) {
      const slotEnd = addMinutes(cur, serviceDuration);
      if (slotEnd > end) break;

      if (isToday(selectedDate) && isPast(slotEnd)) {
        cur = addMinutes(cur, 15);
        continue;
      }
      
      const availableResourcesForSlot = resources.filter(resource => {
          const isResourceBooked = appointments.some(appt => {
              if (appt.resource_id !== resource.id) return false;
              
              const aStart = toValidDate(appt?.start_time);
              const aEnd   = toValidDate(appt?.end_time);
              if (!aStart || !aEnd) return false;

              try {
                return areIntervalsOverlapping(
                    { start: cur, end: slotEnd },
                    { start: aStart,  end: aEnd },
                    { inclusive: true }
                );
              } catch {
                return true; 
              }
          });
          return !isResourceBooked;
      });

      if (availableResourcesForSlot.length > 0) {
        out.push(format(cur, 'HH:mm'));
      }
      cur = addMinutes(cur, 15);
    }
    return out;
  }, [selectedDate, selectedService, hours, resources, appointments]);

  const handleCreateAppointment = async () => {
    if (!sessionUser) {
        toast({ variant: "destructive", title: "Please log in", description: "You must be logged in to book an appointment."});
        router.push('/login');
        return;
    }
    if (!selectedService || !selectedDate || !selectedTime) {
        toast({ variant: "destructive", title: "Incomplete selection" });
        return;
    }
    setIsSubmitting(true);
    
    const [hour, minute] = selectedTime.split(':').map(Number);
    const startTime = setMinutes(setHours(selectedDate, hour), minute);
    const endTime = addMinutes(startTime, selectedService.duration_minutes);

    const availableResource = resources.find(resource => 
        !appointments.some(appt => {
            if (appt.resource_id !== resource.id) return false;
            const aStart = toValidDate(appt.start_time);
            const aEnd = toValidDate(appt.end_time);
            if (!aStart || !aEnd) return false;
            return areIntervalsOverlapping(
                { start: startTime, end: endTime },
                { start: aStart, end: aEnd },
                { inclusive: true }
            )
        })
    );

    if (!availableResource) {
        toast({ variant: "destructive", title: "Slot taken!", description: "This time slot was just booked. Please select another time."});
        setIsSubmitting(false);
        return;
    }

    const result = await api<{success:boolean; error?:string; appointment?:any}>(
      `/api/booking/appointments`,
      {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          service_id: selectedService.id,
          resource_id: availableResource.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        })
      }
    );

    if (result.success) {
        toast({ title: "Appointment Booked!", description: `Your appointment with ${business.name} is confirmed.`});
        setIsOpen(false);
    } else {
        toast({ variant: "destructive", title: "Booking Failed", description: result.error || "Please try another slot."});
    }
    setIsSubmitting(false);
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    
    switch (currentStep) {
      case 0: // Select Service
        return (
          <div className="space-y-3">
            {services.map(service => (
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
              onSelect={(date) => { setSelectedDate(date); setSelectedTime(null); }}
              disabled={(date) => isPast(date) && !isToday(date)}
              className="rounded-md border mx-auto"
            />
            <div className="w-full sm:w-48 flex-shrink-0">
                <h4 className="font-semibold mb-2 text-center">Available Slots</h4>
                <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2">
                    {timeSlots.map(time => (
                        <Button
                            key={time}
                            variant={selectedTime === time ? "default" : "outline"}
                            onClick={() => setSelectedTime(time)}
                            size="sm"
                        >
                            {time}
                        </Button>
                    ))}
                    {timeSlots.length === 0 && <p className="col-span-3 text-center text-sm text-muted-foreground pt-4">No slots available for this day.</p>}
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

      default:
        return null;
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
              <div key={step} className={cn("flex-1 h-1 rounded-full", currentStep >= index ? "bg-primary" : "bg-muted")}></div>
            ))}
          </div>
        </DialogHeader>
        
        {renderContent()}

        <DialogFooter className="pt-4">
            {currentStep > 0 && <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}><ChevronLeft className="mr-2 h-4 w-4"/> Back</Button>}
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            {currentStep < 2 ? (
                <Button 
                    onClick={() => {
                        if (currentStep === 0 && !selectedService) return;
                        setCurrentStep(currentStep + 1);
                    }}
                    disabled={currentStep === 0 ? !selectedService : (currentStep === 1 ? !selectedTime : false)}
                >
                    Next <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
            ) : (
                <Button onClick={handleCreateAppointment} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    <Check className="mr-2 h-4 w-4"/> Confirm Booking
                </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
