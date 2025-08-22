

'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { updateUserLocationAction } from '@/app/users/[userId]/actions';
import { Loader2, LocateFixed } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


export default function UpdateLocationButton() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateLocation = () => {
    setIsLoading(true);
    if (!navigator.geolocation) {
        toast({ variant: 'destructive', title: 'Error', description: 'Geolocation is not supported by your browser.' });
        setIsLoading(false);
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const result = await updateUserLocationAction(latitude, longitude);
        if (result.success) {
            toast({ title: 'Location Updated!', description: 'Your business location has been set to your current position.' });
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
        setIsLoading(false);
      },
      (error) => {
        toast({ variant: 'destructive', title: 'Location Error', description: error.message });
        setIsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="outline">
                <LocateFixed className="mr-2 h-4 w-4" /> Set Business Location
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Set Your Business Location?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will use your device's current location as your business address. Please ensure you are physically at your business location before confirming.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleUpdateLocation} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Location
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
}
