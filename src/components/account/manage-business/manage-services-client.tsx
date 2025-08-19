

'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Tag, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addBusinessService, updateBusinessService, deleteBusinessService } from './actions';
import type { BusinessService } from '@/lib/db-types';
import { getSession } from '@/app/auth/actions';

const serviceSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  duration_minutes: z.coerce.number().int().min(5, 'Duration must be at least 5 minutes.'),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormDialogProps {
  service?: BusinessService;
  onSuccess: () => void;
  children: React.ReactNode;
}

const ServiceFormDialog: React.FC<ServiceFormDialogProps> = ({ service, onSuccess, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: service || {
      name: '',
      price: 0,
      duration_minutes: 30,
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: ServiceFormData) => {
    const result = service
      ? await updateBusinessService(service.id, data)
      : await addBusinessService(data);

    if (result.success) {
      toast({ title: `Service ${service ? 'Updated' : 'Added'}!` });
      onSuccess();
      setIsOpen(false);
      form.reset(service || { name: '', price: 0, duration_minutes: 30 });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          <DialogDescription>
            {service ? `Update the details for "${service.name}".` : 'Define a new service your business offers.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Haircut, Beard Trim" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (min)</FormLabel>
                    <FormControl>
                      <Input type="number" step="5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {service ? 'Save Changes' : 'Add Service'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};


interface ManageServicesClientProps {
  initialServices: BusinessService[];
}

const ManageServicesClient: React.FC<ManageServicesClientProps> = ({ initialServices }) => {
  const [services, setServices] = useState(initialServices);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchServices = async () => {
    setIsLoading(true);
    const { user } = await getSession();
    if(!user) return;
    const { getBusinessServices } = await import('./actions');
    const updatedServices = await getBusinessServices(user.id);
    setServices(updatedServices);
    setIsLoading(false);
  };
  
  const handleDelete = async (serviceId: number) => {
    const result = await deleteBusinessService(serviceId);
    if(result.success) {
      toast({ title: 'Service Deleted' });
      fetchServices();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  }

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
          <CardTitle>Your Services</CardTitle>
          <CardDescription>The list of bookable services you offer to customers.</CardDescription>
        </div>
        <ServiceFormDialog onSuccess={fetchServices}>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Service
            </Button>
        </ServiceFormDialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="text-center py-8">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            </div>
        ) : services.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>You haven't added any services yet.</p>
            <p className="text-sm">Click "Add Service" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                <div>
                  <p className="font-semibold">{service.name}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1.5"><Tag className="w-3 h-3 text-primary"/> ₹{service.price}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-primary"/> {service.duration_minutes} min</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    <ServiceFormDialog service={service} onSuccess={fetchServices}>
                        <Button variant="ghost" size="icon"><Edit className="w-4 h-4" /></Button>
                    </ServiceFormDialog>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(service.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManageServicesClient;
