
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const AdminVerificationPage: FC = async () => {

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Business Verification</h1>
        <p className="text-lg text-muted-foreground">This feature has been removed. Businesses are approved automatically on signup.</p>
      </header>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Pending Verifications</CardTitle>
          <CardDescription>
            There are no businesses awaiting verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="text-center py-12 text-muted-foreground">
                <BadgeCheck className="mx-auto h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg">All clear! No pending verifications.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminVerificationPage;
