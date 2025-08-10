
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCheck } from 'lucide-react';


const AdminApprovalsPage: FC = async () => {

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">User Approvals</h1>
        <p className="text-lg text-muted-foreground">This page is no longer used. User accounts are now verified via email OTP.</p>
      </header>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Manual Approvals</CardTitle>
          <CardDescription>
            There are no users awaiting manual approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="text-center py-12 text-muted-foreground">
                <UserCheck className="mx-auto h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg">All clear! No pending approvals.</p>
                <p className="text-sm">New users can now log in immediately after verifying their email.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminApprovalsPage;
