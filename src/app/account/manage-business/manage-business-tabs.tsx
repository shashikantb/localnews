

'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Wrench, Clock, Armchair, CalendarCheck } from 'lucide-react';
import ManageServicesClient from './manage-services-client';
import ManageScheduleClient from './manage-schedule-client';
import ManageResourcesClient from './manage-resources-client';
import ManageBookingsClient from './manage-bookings-client';
import type { BusinessService, BusinessHour, BusinessResource, User } from '@/lib/db-types';

interface ManageBusinessTabsProps {
    initialServices: BusinessService[];
    initialHours: BusinessHour[];
    initialResources: BusinessResource[];
    businessUser: User;
}

export default function ManageBusinessTabs({ initialServices, initialHours, initialResources, businessUser }: ManageBusinessTabsProps) {
    return (
        <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="bookings"><CalendarCheck className="w-4 h-4 mr-2"/> Bookings</TabsTrigger>
                <TabsTrigger value="services"><Wrench className="w-4 h-4 mr-2"/> Services</TabsTrigger>
                <TabsTrigger value="schedule"><Clock className="w-4 h-4 mr-2"/> Schedule</TabsTrigger>
                <TabsTrigger value="resources"><Armchair className="w-4 h-4 mr-2"/> Resources</TabsTrigger>
            </TabsList>

            <TabsContent value="bookings">
                <Card className="shadow-lg border-border/60">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <CalendarCheck className="w-6 h-6 mr-3 text-primary" />
                            Daily Bookings
                        </CardTitle>
                        <CardDescription>View your appointment schedule for a specific day.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ManageBookingsClient />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="services">
                <Card className="shadow-lg border-border/60">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Wrench className="w-6 h-6 mr-3 text-primary" />
                           Your Services
                        </CardTitle>
                        <CardDescription>Define the bookable services you offer to customers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <ManageServicesClient initialServices={initialServices} businessUserId={businessUser.id} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="schedule">
                <Card className="shadow-lg border-border/60">
                    <CardHeader>
                         <CardTitle className="flex items-center">
                            <Clock className="w-6 h-6 mr-3 text-primary" />
                           Hours & Schedule
                        </CardTitle>
                        <CardDescription>Set your weekly working hours, days off, and business timezone.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ManageScheduleClient initialHours={initialHours} businessUser={businessUser} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="resources">
                <Card className="shadow-lg border-border/60">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Armchair className="w-6 h-6 mr-3 text-primary" />
                            Resources
                        </CardTitle>
                        <CardDescription>Manage your bookable resources (e.g., salon chairs, washing bays).</CardDescription>
                    </CardHeader>
                     <CardContent>
                        <ManageResourcesClient initialResources={initialResources} businessUserId={businessUser.id} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
