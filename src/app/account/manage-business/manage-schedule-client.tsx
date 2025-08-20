
'use client';

import React, { useState, useTransition } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import type { BusinessHour, User } from '@/lib/db-types';
import { useToast } from '@/hooks/use-toast';
import { updateBusinessHours } from './actions';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2);
    const minutes = (i % 2) * 30;
    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    return `${formattedHours}:${formattedMinutes}`;
});

const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone');
const INDIAN_SUBCONTINENT_TIMEZONES = ALL_TIMEZONES.filter(tz => tz.startsWith('Asia/Calcutta') || tz.startsWith('Asia/Dhaka') || tz.startsWith('Asia/Karachi') || tz.startsWith('Asia/Kathmandu'));

const scheduleSchema = z.object({
  timezone: z.string().min(1, "Timezone is required."),
  schedule: z.array(
    z.object({
      day_of_week: z.number(),
      is_closed: z.boolean(),
      start_time: z.string().nullable(),
      end_time: z.string().nullable(),
    })
  ).superRefine((schedule, ctx) => {
    schedule.forEach((day, index) => {
        if(!day.is_closed && day.start_time && day.end_time && day.start_time >= day.end_time) {
            ctx.addIssue({
                path: [`schedule`, index, 'end_time'],
                message: 'End time must be after start time.',
            });
        }
    });
  }),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ManageScheduleClientProps {
  initialHours: BusinessHour[];
  businessUser: User;
}

const ManageScheduleClient: React.FC<ManageScheduleClientProps> = ({ initialHours, businessUser }) => {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const getDefaultValues = () => {
    const defaultSchedule = DAYS_OF_WEEK.map((_, index) => {
        const existing = initialHours.find(h => h.day_of_week === index);
        return {
            day_of_week: index,
            is_closed: existing?.is_closed ?? true,
            start_time: existing?.start_time ?? '09:00',
            end_time: existing?.end_time ?? '18:00',
        };
    });
    return { 
        schedule: defaultSchedule,
        timezone: businessUser.timezone || 'Asia/Kolkata', // Default to IST
    };
  };

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: getDefaultValues(),
    mode: 'onChange',
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'schedule',
  });

  const { formState: { errors } } = form;

  const onSubmit = (data: ScheduleFormData) => {
    startTransition(async () => {
        const result = await updateBusinessHours(data.schedule, data.timezone);
        if (result.success) {
            toast({ title: 'Schedule Updated!', description: 'Your working hours have been saved.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!businessUser.timezone && (
              <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Set Your Timezone</AlertTitle>
                  <AlertDescription>
                      Please select your business's timezone below to ensure accurate booking times for customers.
                  </AlertDescription>
              </Alert>
          )}
          <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                  <FormItem>
                      <FormLabel>Business Timezone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select your timezone" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <Label className="px-2 py-1.5 text-sm font-semibold">Indian Subcontinent</Label>
                              {INDIAN_SUBCONTINENT_TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                              <Label className="px-2 py-1.5 text-sm font-semibold">All Timezones</Label>
                              {ALL_TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
              )}
          />
          <div className="space-y-3 rounded-md border p-4">
          {fields.map((field, index) => {
            const isClosed = form.watch(`schedule.${index}.is_closed`);
            return (
              <div key={field.id} className={cn("grid grid-cols-3 gap-3 items-center p-2 rounded-md", isClosed && 'opacity-60')}>
                <Label className="font-semibold col-span-3 sm:col-span-1">{DAYS_OF_WEEK[index]}</Label>
                <div className="flex items-center gap-4 col-span-3 sm:col-span-2">
                  <Controller
                      control={form.control}
                      name={`schedule.${index}.is_closed`}
                      render={({ field: checkboxField }) => (
                          <div className="flex items-center space-x-2">
                              <Checkbox 
                                  id={`is_closed_${index}`} 
                                  checked={checkboxField.value}
                                  onCheckedChange={checkboxField.onChange}
                              />
                              <Label htmlFor={`is_closed_${index}`} className="text-sm">Closed</Label>
                          </div>
                      )}
                  />
                  {!isClosed && (
                      <div className="flex items-center gap-2 flex-grow">
                          <Controller
                              name={`schedule.${index}.start_time`}
                              control={form.control}
                              render={({ field: timeField }) => (
                                  <Select onValueChange={timeField.onChange} value={timeField.value || '09:00'}>
                                      <SelectTrigger><SelectValue/></SelectTrigger>
                                      <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={`start-${t}`} value={t}>{t}</SelectItem>)}</SelectContent>
                                  </Select>
                              )}
                          />
                          <span>to</span>
                          <Controller
                              name={`schedule.${index}.end_time`}
                              control={form.control}
                              render={({ field: timeField }) => (
                                  <Select onValueChange={timeField.onChange} value={timeField.value || '18:00'}>
                                      <SelectTrigger><SelectValue/></SelectTrigger>
                                      <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={`end-${t}`} value={t}>{t}</SelectItem>)}</SelectContent>
                                  </Select>
                              )}
                          />
                      </div>
                  )}
                </div>
                {errors.schedule?.[index]?.end_time && <p className="text-destructive text-xs col-span-3 text-right -mt-2">{errors.schedule[index]!.end_time!.message}</p>}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              <Save className="mr-2 h-4 w-4"/>
              Save Schedule
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ManageScheduleClient;
