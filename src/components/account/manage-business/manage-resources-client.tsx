

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Armchair } from 'lucide-react';
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
import { addBusinessResource, updateBusinessResource, deleteBusinessResource } from './actions';
import type { BusinessResource } from '@/lib/db-types';
import { getSession } from '@/app/auth/actions';

const resourceSchema = z.object({
  name: z.string().min(2, 'Resource name must be at least 2 characters.'),
});

type ResourceFormData = z.infer<typeof resourceSchema>;

interface ResourceFormDialogProps {
  resource?: BusinessResource;
  onSuccess: () => void;
  children: React.ReactNode;
}

const ResourceFormDialog: React.FC<ResourceFormDialogProps> = ({ resource, onSuccess, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
    defaultValues: resource || { name: '' },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: ResourceFormData) => {
    const result = resource
      ? await updateBusinessResource(resource.id, data)
      : await addBusinessResource(data);

    if (result.success) {
      toast({ title: `Resource ${resource ? 'Updated' : 'Added'}!` });
      onSuccess();
      setIsOpen(false);
      form.reset({ name: '' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{resource ? 'Edit Resource' : 'Add New Resource'}</DialogTitle>
          <DialogDescription>
            {resource ? `Update the name for "${resource.name}".` : 'Define a new bookable resource, e.g., "Stylist Chair 1".'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Chair 1, Washing Bay A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {resource ? 'Save Changes' : 'Add Resource'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};


interface ManageResourcesClientProps {
  initialResources: BusinessResource[];
}

const ManageResourcesClient: React.FC<ManageResourcesClientProps> = ({ initialResources }) => {
  const [resources, setResources] = useState(initialResources);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchResources = async () => {
    setIsLoading(true);
    const { user } = await getSession();
    if(!user) return;
    const { getBusinessResources } = await import('./actions');
    const updatedResources = await getBusinessResources(user.id);
    setResources(updatedResources);
    setIsLoading(false);
  };
  
  const handleDelete = async (resourceId: number) => {
    const result = await deleteBusinessResource(resourceId);
    if(result.success) {
      toast({ title: 'Resource Deleted' });
      fetchResources();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  }

  return (
    <div>
        <div className="flex justify-end mb-4">
            <ResourceFormDialog onSuccess={fetchResources}>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Resource
                </Button>
            </ResourceFormDialog>
        </div>

        {isLoading ? (
            <div className="text-center py-8">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-lg">
            <Armchair className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>You haven't added any resources yet.</p>
            <p className="text-sm">Click "Add Resource" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resources.map((resource) => (
              <div key={resource.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                <p className="font-semibold">{resource.name}</p>
                <div className="flex items-center gap-2">
                    <ResourceFormDialog resource={resource} onSuccess={fetchResources}>
                        <Button variant="ghost" size="icon"><Edit className="w-4 h-4" /></Button>
                    </ResourceFormDialog>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(resource.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

export default ManageResourcesClient;
