
'use client';

import React, { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { registerMandal } from '@/app/actions';
import type { NewGanpatiMandal } from '@/lib/db-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PartyPopper } from 'lucide-react';

const mandalSchema = z.object({
  name: z.string().min(3, 'Mandal name must be at least 3 characters long.'),
  city: z.string().min(2, 'City name is required.'),
  description: z.string().max(500, 'Description cannot exceed 500 characters.').optional(),
});

type MandalFormData = z.infer<typeof mandalSchema>;

interface RegisterMandalDialogProps {
    userLocation: { latitude: number, longitude: number } | null;
}

export default function RegisterMandalDialog({ userLocation }: RegisterMandalDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<MandalFormData>({
    resolver: zodResolver(mandalSchema),
    defaultValues: {
      name: '',
      city: '',
      description: '',
    },
  });
  
  const { isSubmitting } = form.formState;

  const onSubmit: SubmitHandler<MandalFormData> = async (data) => {
    if (!userLocation) {
        toast({
            variant: 'destructive',
            title: 'Location Required',
            description: 'Your location is needed to register a mandal. Please ensure location services are enabled.'
        });
        return;
    }

    const newMandal: NewGanpatiMandal = {
        ...data,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
    };
    
    const result = await registerMandal(newMandal);
    if (result.success) {
      toast({
        title: 'Mandal Registered!',
        description: 'Your Ganpati Mandal has been successfully registered.',
      });
      setIsOpen(false);
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: result.error || 'An unexpected error occurred.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PartyPopper className="mr-2 h-4 w-4" /> Register Your Mandal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register Ganpati Mandal</DialogTitle>
          <DialogDescription>
            Add your mandal to the festival map for everyone to see.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mandal Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Lalbaugcha Raja" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Mumbai" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Share details about the theme, timings, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
