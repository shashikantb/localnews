
import type { FC } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Building } from 'lucide-react';
import type { ExternalBusiness } from '@/lib/db-types';

interface ExternalBusinessCardProps {
  business: ExternalBusiness;
}

const ExternalBusinessCard: FC<ExternalBusinessCardProps> = ({ business }) => {
  return (
    <Card className="shadow-lg hover:shadow-primary/10 transition-shadow duration-300 h-full bg-blue-500/5 border-blue-500/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full border-2 border-primary/20">
              <Building className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-primary">{business.name}</h3>
            {business.address && (
                 <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    {business.address}
                </p>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            {business.phone && (
              <a href={`tel:${business.phone}`} onClick={(e) => e.stopPropagation()}>
                <Button className="w-full">
                  <Phone className="mr-2 h-4 w-4" />
                  Call Now
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

export default ExternalBusinessCard;
