
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { approveVerification, rejectVerification } from './actions';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
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

export default function VerificationActions({ userId }: { userId: number }) {
  const [isApproving, startApproveTransition] = useTransition();
  const [isRejecting, startRejectTransition] = useTransition();
  const { toast } = useToast();

  const handleApprove = () => {
    startApproveTransition(async () => {
      const result = await approveVerification(userId);
      if (result.success) {
        toast({ title: 'Verification Approved', description: 'The user has been granted a verified badge.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  const handleReject = () => {
    startRejectTransition(async () => {
      const result = await rejectVerification(userId);
      if (result.success) {
        toast({ title: 'Verification Rejected', description: "The user's status has been reverted to approved." });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  return (
    <div className="flex gap-2 flex-shrink-0">
      <Button
        variant="default"
        size="sm"
        onClick={handleApprove}
        disabled={isApproving || isRejecting}
        className="bg-green-600 hover:bg-green-700"
      >
        {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
        Approve
      </Button>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={isApproving || isRejecting}>
            {isRejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Reject
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will reject the verification request. The user will still be able to use the app as an 'approved' (but not 'verified') business. This action can be reversed later if they re-apply.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReject}>Yes, Reject</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
