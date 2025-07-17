
'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { signUp } from '@/app/auth/actions';
import { Loader2, UserPlus, ShieldAlert, Building, ShieldCheck, User, Phone, Briefcase, CheckCircle, XCircle, Ticket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_CATEGORIES } from '@/lib/db-types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum(['Business', 'Gorakshak', 'Public(जनता)'], { required_error: 'You must select a role.' }),
  countryCode: z.string().min(1, 'Country code is required.'),
  mobilenumber: z.string().regex(/^\d{10}$/, "A valid 10-digit mobile number is required."),
  business_category: z.string().optional(),
  business_other_category: z.string().optional(),
  referral_code: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'Business' && !data.business_category) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please select a business category.",
      path: ['business_category'],
    });
  }
  if (data.role === 'Business' && data.business_category === 'Any Other' && (!data.business_other_category || data.business_other_category.trim().length < 2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please specify your business type.",
      path: ['business_other_category'],
    });
  }
});

type SignupFormInputs = z.infer<typeof signupSchema>;

const PasswordValidationChecklist: FC<{ password?: string }> = ({ password = '' }) => {
  const checks = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
  ];

  return (
    <ul className="grid gap-2 text-sm text-muted-foreground mt-2">
      {checks.map((check, index) => (
        <li key={index} className={cn('flex items-center', check.valid ? 'text-green-600' : 'text-destructive')}>
          {check.valid ? <CheckCircle className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
          {check.label}
        </li>
      ))}
    </ul>
  );
};


const SignupPage: FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const refCodeFromUrl = searchParams.get('ref') || '';

  const form = useForm<SignupFormInputs>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      countryCode: '+91',
      mobilenumber: '',
      referral_code: refCodeFromUrl,
    },
  });

  const selectedRole = form.watch('role');
  const selectedCategory = form.watch('business_category');
  const passwordValue = form.watch('password');

  const onSubmit: SubmitHandler<SignupFormInputs> = async (data) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signUp({ ...data, passwordplaintext: data.password });
      if (result.success) {
        setIsSuccess(true);
        toast({
          title: 'Account Created!',
          description: 'Your account is now pending approval from an administrator.',
        });
      } else {
        setError(result.error || 'Failed to create account.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
       <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-2xl text-center">
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-green-600">Registration Successful!</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    {'Your account is pending approval. You will be able to log in once an administrator reviews it.'}
                </p>
            </CardContent>
            <CardFooter className="flex justify-center">
                <Button asChild>
                    <Link href="/login">Back to Login</Link>
                </Button>
            </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
            <UserPlus className="mr-2 h-8 w-8" />
            Create an Account
          </CardTitle>
          <CardDescription>Join LocalPulse to share and discover.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Signup Failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="name">Full Name</Label>
                    <FormControl>
                      <Input id="name" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="email">Email</Label>
                    <FormControl>
                      <Input id="email" type="email" {...field} disabled={isSubmitting} autoComplete="email"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="password">Password</Label>
                    <FormControl>
                      <Input id="password" type="password" {...field} disabled={isSubmitting} autoComplete="new-password"/>
                    </FormControl>
                    <FormMessage />
                    <PasswordValidationChecklist password={passwordValue} />
                  </FormItem>
                )}
              />

              <FormItem>
                <Label>Mobile Number</Label>
                <div className="flex gap-2">
                    <FormField
                        control={form.control}
                        name="countryCode"
                        render={({ field }) => (
                            <FormItem className="w-1/4">
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="+91">IN +91</SelectItem>
                                        <SelectItem value="+1">US +1</SelectItem>
                                        <SelectItem value="+44">UK +44</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="mobilenumber"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormControl>
                                    <Input id="mobilenumber" type="tel" placeholder="10-digit number" {...field} disabled={isSubmitting} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
              </FormItem>
              
              <FormField
                control={form.control}
                name="referral_code"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="referral_code">Referral Code (Optional)</Label>
                    <div className="relative">
                      <Ticket className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <FormControl>
                        <Input id="referral_code" placeholder="Enter referral code" className="pl-10" {...field} disabled={isSubmitting} />
                      </FormControl>
                    </div>
                    {refCodeFromUrl && refCodeFromUrl !== 'null' && <p className="text-xs text-green-600 pt-1">Referral code applied!</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <Label>I am a...</Label>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                        disabled={isSubmitting}
                      >
                        <FormItem>
                           <FormControl>
                            <RadioGroupItem value="Business" id="role-business" className="peer sr-only" />
                           </FormControl>
                           <Label htmlFor="role-business" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <Building className="mb-3 h-6 w-6" />
                            Business
                          </Label>
                        </FormItem>
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem value="Gorakshak" id="role-gorakshak" className="peer sr-only" />
                          </FormControl>
                          <Label htmlFor="role-gorakshak" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <ShieldCheck className="mb-3 h-6 w-6" />
                            Gorakshak
                          </Label>
                        </FormItem>
                         <FormItem>
                          <FormControl>
                            <RadioGroupItem value="Public(जनता)" id="role-public" className="peer sr-only" />
                          </FormControl>
                          <Label htmlFor="role-public" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <User className="mb-3 h-6 w-6" />
                            Public(जनता)
                          </Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {selectedRole === 'Business' && (
                <div className='space-y-4 pt-2 border-t'>
                    <FormField
                    control={form.control}
                    name="business_category"
                    render={({ field }) => (
                        <FormItem>
                        <Label>Business Category</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select your business category" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <ScrollArea className="h-72">
                                {Object.entries(BUSINESS_CATEGORIES).map(([group, categories]) => (
                                    <React.Fragment key={group}>
                                    <Label className="px-2 py-1.5 text-sm font-semibold">{group}</Label>
                                    {categories.map(category => (
                                        <SelectItem key={category} value={category}>{category}</SelectItem>
                                    ))}
                                    </React.Fragment>
                                ))}
                                </ScrollArea>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    {selectedCategory === 'Any Other' && (
                        <FormField
                            control={form.control}
                            name="business_other_category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Please Specify Your Business</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="e.g., Book Binding Service" disabled={isSubmitting} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Submitting...' : 'Create Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
           <p className="text-muted-foreground">
            Already have an account?&nbsp;
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SignupPage;
