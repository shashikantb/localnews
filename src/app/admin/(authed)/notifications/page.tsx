
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Award, UserPlus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SendNotificationButton from './send-notification-button';
import SendReminderButton from './send-reminder-button';

export const dynamic = 'force-dynamic';

const AdminNotificationsPage: FC = () => {

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Notifications</h1>
        <p className="text-lg text-muted-foreground">Send targeted push notifications to your users.</p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Award className="mr-2 h-6 w-6 text-primary" />
            LP Points Reminder
          </CardTitle>
          <CardDescription>
            Send a notification to all **registered users** with their current and yesterday's LP Points balance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription>
              <p>This will send a personalized push notification to every registered user who has enabled them. The message will be dynamic based on their points activity.</p>
            </AlertDescription>
          </Alert>
          <SendNotificationButton />
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserPlus className="mr-2 h-6 w-6 text-primary" />
            Registration Reminder
          </CardTitle>
          <CardDescription>
            Encourage **unregistered users** who have installed the app to sign up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription>
              <p>This will send a generic push notification to everyone who has installed the app and enabled notifications but has not yet created an account.</p>
              <div className="space-y-2 mt-2">
                 <p className="italic bg-muted p-2 rounded-md text-sm">
                  "Complete Your LocalPulse Profile! 🚀 Sign up to post, earn LP Points, and unlock all features. Join the community now!"
                </p>
              </div>
            </AlertDescription>
          </Alert>
          <SendReminderButton />
        </CardContent>
      </Card>

    </div>
  );
};

export default AdminNotificationsPage;
