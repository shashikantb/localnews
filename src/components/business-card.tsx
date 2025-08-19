
import type { FC } from 'react';
import Link from 'next/link';
import type { BusinessUser } from '@/lib/db-types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Briefcase, BadgeCheck, CalendarPlus } from 'lucide-react';

interface BusinessCardProps {
  business: BusinessUser;
  userLocation: { latitude: number; longitude: number } | null;
}

const BusinessCard: FC<BusinessCardProps> = ({ business, userLocation }) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const distanceInKm = business.distance ? (business.distance / 1000).toFixed(1) : null;
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
          <div className="flex-1 min-w-0">
            <Link href={`/users/${business.id}`}>
              <CardTitle className="flex items-center gap-2 text-primary text-xl">
                  {business.name}
                  {isVerified && (
                      <BadgeCheck className="h-6 w-6 text-green-600 flex-shrink-0" title="Verified Business" />
                  )}
              </CardTitle>
            </Link>
            <CardDescription className="flex items-center gap-1.5 mt-1">
              <Briefcase className="w-4 h-4" />
              {business.business_category === 'Any Other' ? business.business_other_category : business.business_category}
            </CardDescription>
            {distanceInKm !== null && (
                <p className="text-xs text-accent font-semibold flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3 h-3"/>
                    Approx. {distanceInKm} km away
                </p>
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
          <Button className="w-full sm:w-auto flex-1" disabled>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Book Appointment
          </Button>
      </CardFooter>
    </Card>
  );
};

export default BusinessCard;
