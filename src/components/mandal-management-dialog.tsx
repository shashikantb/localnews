
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { GanpatiMandal, NewPost, User } from '@/lib/db-types';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Bell, Edit, Film, Loader2, PartyPopper } from 'lucide-react';
import PostComposer from './post-composer';
import { addPost } from '@/app/actions';
import { getSession } from '../app/auth/actions';


interface MandalManagementDialogProps {
  children: React.ReactNode;
  mandal: GanpatiMandal;
}

const MandalPostUploader: React.FC<{ mandal: GanpatiMandal; onPostSuccess: () => void, sessionUser: User | null }> = ({ mandal, onPostSuccess, sessionUser }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddPost = async (content: string, hashtags: string[], isFamilyPost: boolean, hideLocation: boolean, mediaUrls?: string[], mediaType?: 'image' | 'video' | 'gallery') => {
        if (!mandal.latitude || !mandal.longitude) {
            toast({ variant: 'destructive', title: "Mandal Location Missing", description: "This mandal doesn't have a location set." });
            return;
        }

        if (!content.trim() && (!mediaUrls || mediaUrls.length === 0)) {
            toast({ variant: 'destructive', title: "Empty Post", description: "Please write some content or upload media." });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const postData: NewPost = {
                content: content,
                latitude: mandal.latitude,
                longitude: mandal.longitude,
                mediaUrls: mediaUrls,
                mediaType: mediaType,
                hashtags: [`#${mandal.name.replace(/\s/g, '')}`, ...(hashtags || [])],
                isFamilyPost: false,
                hideLocation: false,
                authorId: sessionUser?.id,
                mandalId: mandal.id, // Link post to the mandal
            };
            const result = await addPost(postData);

            if (result.error) {
                toast({ variant: "destructive", title: "Post Failed", description: result.error });
            } else {
                toast({ title: "Post Added!", description: "Your pulse for the mandal is now live!" });
                onPostSuccess();
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "An Error Occurred", description: "Could not add post." });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!sessionUser) return null;

    return (
        <div className="pt-4 border-t">
            <h3 className="text-lg font-semibold mb-2">Post an Update for {mandal.name}</h3>
            <PostComposer sessionUser={sessionUser} onPostSuccess={onPostSuccess} />
        </div>
    );
};


export default function MandalManagementDialog({ children, mandal }: MandalManagementDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [sessionUser, setSessionUser] = useState<User | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            getSession().then(session => setSessionUser(session.user));
        }
    }, [isOpen]);

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

                <ScrollArea className="flex-grow -mx-6 px-6">
                    <div className="space-y-6">
                        {/* Edit Mandal Info Section */}
                        <div className="p-4 border rounded-lg">
                           <h3 className="font-semibold flex items-center gap-2"><Edit className="w-4 h-4"/> Edit Details</h3>
                           <p className="text-sm text-muted-foreground mt-1 mb-3">Update your mandal's information.</p>
                           <Button disabled>Edit Info (Coming Soon)</Button>
                        </div>
                        
                         {/* Send Notification Section */}
                        <div className="p-4 border rounded-lg">
                           <h3 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4"/> Send Aarti Notification</h3>
                           <p className="text-sm text-muted-foreground mt-1 mb-3">Notify nearby users about Aarti timings.</p>
                           <Button disabled>Send Notification (Coming Soon)</Button>
                        </div>
                        
                        {/* Post Media Section */}
                        <div className="p-4 border rounded-lg">
                           <h3 className="font-semibold flex items-center gap-2"><Film className="w-4 h-4"/> Post Media Update</h3>
                           <p className="text-sm text-muted-foreground mt-1">Share photos or videos from your mandal.</p>
                           {sessionUser ? (
                             <MandalPostUploader mandal={mandal} onPostSuccess={() => setIsOpen(false)} sessionUser={sessionUser} />
                           ) : (
                             <div className="flex items-center justify-center p-4"><Loader2 className="animate-spin"/></div>
                           )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

