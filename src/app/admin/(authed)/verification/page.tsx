
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeCheck, User, Building, Phone } from 'lucide-react';
import { getVerificationRequests } from './actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import VerificationActions from './verification-actions';

export const dynamic = 'force-dynamic';

const AdminVerificationPage: FC = async () => {
  const requests = await getVerificationRequests();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Business Verification</h1>
        <p className="text-lg text-muted-foreground">Review and approve businesses to grant them a verified badge.</p>
      </header>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Pending Verifications ({requests.length})</CardTitle>
          <CardDescription>
            These businesses have requested verification. Review their details before approving.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {requests.length > 0 ? (
                <div className="space-y-4">
                    {requests.map((user) => (
                        <div key={user.id} className="p-4 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex-1 space-y-2">
                                <p className="font-bold text-lg flex items-center gap-2">
                                    <Building className="w-5 h-5 text-primary" />
                                    {user.name}
                                </p>
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    <Button variant="link" asChild className="p-0 h-auto">
                                        <Link href={`/users/${user.id}`} target="_blank">View Profile</Link>
                                    </Button>
                                </p>
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    {user.mobilenumber || 'Not provided'}
                                </p>
                            </div>
                            <VerificationActions userId={user.id} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <BadgeCheck className="mx-auto h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg">All clear! No pending verifications.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminVerificationPage;
