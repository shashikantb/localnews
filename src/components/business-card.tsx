
import type { FC } from 'react';
import Link from 'next/link';
import type { BusinessUser, User } from '@/lib/db-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Briefcase, BadgeCheck, CalendarPlus } from 'lucide-react';
import BookingDialog from './booking-dialog';

interface BusinessCardProps {
  business: BusinessUser;
  sessionUser: User | null;
  userLocation: { latitude: number; longitude: number } | null;
}

const BusinessCard: FC<BusinessCardProps> = ({ business, sessionUser, userLocation }) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const distanceInMeters = business.distance;
  const isVerified = business.status === 'verified';

  return (
    <Card className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300 h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href={`/users/${business.id}`} className="flex-shrink-0">
            <Avatar className="h-20 w-20 border-4 border-primary/20">
              <AvatarImage src={business.profilepictureurl || undefined} alt={business.name} />
              <AvatarFallback className="text-2xl bg-muted">{getInitials(business.name)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0 space-y-1">
            <Link href={`/users/${business.id}`}>
              <CardTitle className="flex items-center gap-2 text-primary text-xl">
                  {business.name}
                  {isVerified && (
                      <BadgeCheck className="h-6 w-6 text-green-600 flex-shrink-0" title="Verified Business" />
                  )}
              </CardTitle>
            </Link>
            <CardDescription className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              {business.business_category === 'Any Other' ? business.business_other_category : business.business_category}
            </CardDescription>
             {business.latitude && business.longitude && (
              <a href={`https://www.google.com/maps?q=${business.latitude},${business.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground hover:text-primary group">
                 <MapPin className="w-4 h-4 text-primary/70 flex-shrink-0 transition-colors group-hover:text-primary" />
                 <span className="font-medium transition-colors group-hover:underline">
                    Location: {business.latitude.toFixed(3)}, {business.longitude.toFixed(3)}
                 </span>
                 {distanceInMeters !== null && distanceInMeters !== undefined && (
                     <span className="ml-1 text-accent font-semibold transition-colors group-hover:underline">
                        (approx. {distanceInMeters < 100 ? '<100m' : `${(distanceInMeters / 1000).toFixed(1)} km`} away)
                     </span>
                 )}
              </a>
             )}
          </div>
        </div>
      </CardHeader>
      <CardFooter className="p-4 border-t bg-muted/30 flex-grow flex-col sm:flex-row items-center justify-center gap-2">
          {business.mobilenumber && (
            <a href={`tel:${business.mobilenumber}`} className="w-full sm:w-auto flex-1">
                <Button className="w-full" variant="outline">
                  <Phone className="mr-2 h-4 w-4" />
                  Call Now
                </Button>
            </a>
          )}
          <BookingDialog business={business} sessionUser={sessionUser}>
            <Button className="w-full sm:w-auto flex-1">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Book Appointment
            </Button>
          </BookingDialog>
      </CardFooter>
    </Card>
  );
};

export default BusinessCard;
