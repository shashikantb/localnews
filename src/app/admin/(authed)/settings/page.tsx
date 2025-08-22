
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Bell, Shield } from 'lucide-react';

const AdminSettingsPage: FC = () => {

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Admin Settings</h1>
        <p className="text-lg text-muted-foreground">Configure general application settings.</p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-6 w-6 text-primary" />
            General Settings
          </CardTitle>
          <CardDescription>Modify core application parameters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="siteName">Site Name</Label>
            <Input id="siteName" defaultValue="LocalPulse" />
            <p className="text-xs text-muted-foreground">The public name of your application.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxPostLength">Maximum Post Length</Label>
            <Input id="maxPostLength" type="number" defaultValue={280} />
            <p className="text-xs text-muted-foreground">The maximum number of characters allowed in a user post.</p>
          </div>
          
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="maintenanceMode" className="text-base">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Temporarily disable access to the site for users.
              </p>
            </div>
            <Switch id="maintenanceMode" />
          </div>

           <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="allowGuestComments" className="text-base">Allow Guest Comments</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable commenting for non-registered users.
              </p>
            </div>
            <Switch id="allowGuestComments" defaultChecked={true}/>
          </div>
          
          <Button className="w-full sm:w-auto">
            <Save className="mr-2 h-5 w-5" />
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-6 w-6 text-primary" />
            Notification Settings
          </CardTitle>
          <CardDescription>Configure admin email notifications (Placeholder).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Notification Email</Label>
            <Input id="adminEmail" type="email" placeholder="admin@example.com" />
          </div>
           <div className="flex items-center space-x-2">
            <Switch id="newPostNotification" />
            <Label htmlFor="newPostNotification">Notify on new posts</Label>
          </div>
           <div className="flex items-center space-x-2">
            <Switch id="newUserNotification" />
            <Label htmlFor="newUserNotification">Notify on new user registration</Label>
          </div>
          <Button className="w-full sm:w-auto" variant="outline">
            Update Notification Settings
          </Button>
        </CardContent>
      </Card>

    </div>
  );
};

export default AdminSettingsPage;
