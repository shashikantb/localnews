`
'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { requestPasswordReset, resetPassword } from '@/app/auth/actions';
import { Loader2, KeyRound, ShieldAlert, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

// Step 1: Request OTP
const requestSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});
type RequestFormInputs = z.infer<typeof requestSchema>;

// Step 2: Verify OTP and set new password
const resetSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});
type ResetFormInputs = z.infer<typeof resetSchema>;

const ForgotPasswordPage: FC = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [emailToReset, setEmailToReset] = useState('');
  const otpInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (step === 'reset') {
      setTimeout(() => otpInputRef.current?.focus(), 0);
    }
  }, [step]);
  
  const requestForm = useForm<RequestFormInputs>({
    resolver: zodResolver(requestSchema),
  });
  
  const resetForm = useForm<ResetFormInputs>({
    resolver: zodResolver(resetSchema),
  });

  const onRequestSubmit: SubmitHandler<RequestFormInputs> = async (data) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await requestPasswordReset(data.email);
      if (result.success) {
        setEmailToReset(data.email);
        resetForm.reset({ otp: '', password: '' });
        setIsSubmitting(false);
        setStep('reset');
        setTimeout(() => otpInputRef.current?.focus(), 0);
        toast({
          title: 'OTP Sent!',
          description: 'A password reset code has been sent to your email.',
        });
        return;
      } else {
        setError(result.error || 'Failed to send reset email.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
    setIsSubmitting(false);
  };
  
  const onResetSubmit: SubmitHandler<ResetFormInputs> = async (data) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await resetPassword(emailToReset, data.otp, data.password);
      if (result.success) {
        toast({
          title: 'Password Reset Successful!',
          description: 'You can now log in with your new password.',
        });
        router.push('/login');
      } else {
        setError(result.error || 'Failed to reset password.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected server error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        {step === 'request' ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
                <KeyRound className="mr-2 h-8 w-8" />
                Forgot Password
              </CardTitle>
              <CardDescription>
                Enter your email to receive a reset code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-6">
                  {error && (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <FormField
                    control={requestForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="email">Email Address</FormLabel>
                        <FormControl>
                            <Input {...field} id="email" type="email" placeholder="you@example.com" disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send Reset Code
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-primary">Reset Your Password</CardTitle>
              <CardDescription>
                Enter the code sent to <span className="font-semibold text-foreground">{emailToReset}</span> and your new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...resetForm}>
                <form 
                  key={`reset-${emailToReset}`}
                  onSubmit={resetForm.handleSubmit(onResetSubmit)} 
                  autoComplete="off"
                  className="space-y-4"
                >
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    style={{ position:'absolute', left:'-9999px', width:0, height:0, opacity:0 }}
                    tabIndex={-1}
                  />
                  <input
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    style={{ position:'absolute', left:'-9999px', width:0, height:0, opacity:0 }}
                    tabIndex={-1}
                  />
                  {error && (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <FormField
                    control={resetForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="otp">Reset Code</FormLabel>
                        <FormControl>
                          <Input
                            ref={otpInputRef}
                            id="otp"
                            name="one-time-code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="one-time-code"
                            autoCorrect="off"
                            autoCapitalize="off"
                            maxLength={6}
                            placeholder="••••••"
                            disabled={isSubmitting}
                            value={field.value ?? ''}
                            onChange={(e) => {
                                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                                field.onChange(v);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={resetForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="password">New Password</FormLabel>
                        <FormControl>
                          <Input {...field} id="password" type="password" autoComplete="new-password" placeholder="New strong password" disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
`                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting || !resetForm.formState.isValid}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reset Password
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        )}
        <CardContent className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-primary">
                Back to Login
            </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
