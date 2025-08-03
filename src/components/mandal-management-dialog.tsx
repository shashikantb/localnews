
'use client';

import React, { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import type { GanpatiMandal } from '@/lib/db-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Bell, Edit, Film, Loader2, PartyPopper, PlusCircle } from 'lucide-react';
import PostComposerLoader from './post-composer-loader';
import { updateMandal, sendAartiNotification } from '@/app/actions';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

const mandalEditSchema = z.object({
  name: z.string().min(3, 'Mandal name must be at least 3 characters long.'),
  city: z.string().min(2, 'City name is required.'),
  description: z.string().max(500, 'Description cannot exceed 500 characters.').optional(),
});
type MandalEditFormData = z.infer<typeof mandalEditSchema>;


const EditMandalForm: React.FC<{ mandal: GanpatiMandal; onUpdateSuccess: () => void }> = ({ mandal, onUpdateSuccess }) => {
    const { toast } = useToast();
    const form = useForm<MandalEditFormData>({
        resolver: zodResolver(mandalEditSchema),
        defaultValues: {
            name: mandal.name,
            city: mandal.city,
            description: mandal.description || '',
        },
    });

    const { isSubmitting } = form.formState;

    const onSubmit: SubmitHandler<MandalEditFormData> = async (data) => {
        const result = await updateMandal(mandal.id, data);
        if (result.success) {
            toast({ title: 'Mandal Updated!', description: 'Your changes have been saved.' });
            onUpdateSuccess();
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Edit Info</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit {mandal.name}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Mandal Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="city" render={({ field }) => (
                             <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Changes</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const SendAartiNotificationButton: React.FC<{ mandalId: number }> = ({ mandalId }) => {
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();

    const handleSend = async () => {
        setIsSending(true);
        const result = await sendAartiNotification(mandalId);
        if (result.success) {
            toast({ title: 'Notification Sent!', description: `Sent Aarti notification to ${result.sentCount} nearby users.` });
        } else {
            toast({ variant: 'destructive', title: 'Failed to Send', description: result.error });
        }
        setIsSending(false);
    };

    return <Button onClick={handleSend} disabled={isSending}>{isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Notification</Button>;
};

interface MandalManagementDialogProps {
  children: React.ReactNode;
  mandal: GanpatiMandal;
  onUpdate: () => void;
}

export default function MandalManagementDialog({ children, mandal, onUpdate }: MandalManagementDialogProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PartyPopper className="w-6 h-6 text-primary" />
                        Manage {mandal.name}
                    </DialogTitle>
                    <DialogDescription>
                        Edit details, post media, and send notifications for your mandal.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow space-y-6 overflow-y-auto -mx-6 px-6 pt-2">
                    <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold flex items-center gap-2"><Edit className="w-4 h-4" /> Edit Details</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-3">Update your mandal's information.</p>
                        <EditMandalForm mandal={mandal} onUpdateSuccess={() => { setIsOpen(false); onUpdate(); }} />
                    </div>

                    <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4" /> Send Aarti Notification</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-3">Notify nearby users about Aarti timings (1km radius).</p>
                        <SendAartiNotificationButton mandalId={mandal.id} />
                    </div>

                    <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Post Media</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-3">Share photos or videos. This will only appear in your Mandal's gallery.</p>
                        <PostComposerLoader sessionUser={null} mandalId={mandal.id} isMandalPost={true} onPostSuccess={() => setIsOpen(false)} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
