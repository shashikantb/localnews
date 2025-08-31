
'use client';

import React from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Heading2, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

const features = [
  {
    value: 'discover',
    title: 'Discover What\'s Around You',
    description: 'Tap into the pulse of your city. Find hidden gems, local news, and real-time events happening right in your neighborhood.',
    points: [
      'Live map of local happenings.',
      'Nearby business and service discovery.',
      'Community-driven news and alerts.'
    ],
    imageUrl: 'https://picsum.photos/800/600',
    imageHint: 'city map',
  },
  {
    value: 'connect',
    title: 'Connect with Your Community',
    description: 'Build meaningful connections with neighbors and family. Share moments, create groups, and stay in touch with what matters most.',
    points: [
      'Private family and group chats.',
      'Follow friends and local businesses.',
      'Share your thoughts with a "Pulse".'
    ],
    imageUrl: 'https://picsum.photos/800/601',
    imageHint: 'community gathering',
  },
  {
    value: 'grow',
    title: 'Grow Your Local Business',
    description: 'Reach customers right in your area. Our platform makes it easy for local businesses to offer services and manage bookings seamlessly.',
    points: [
      'Easy-to-use booking system.',
      'Showcase your services and schedule.',
      'Directly connect with local customers.'
    ],
    imageUrl: 'https://picsum.photos/800/602',
    imageHint: 'small business',
  },
];

export default function FeatureTabs() {
  const [activeTab, setActiveTab] = React.useState(features[0].value);

  return (
    <div className="w-full max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          What you get with us by your side
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 h-auto">
          {features.map((feature, index) => (
            <TabsTrigger
              key={feature.value}
              value={feature.value}
              className={cn(
                'relative h-auto whitespace-normal rounded-none border-b-2 bg-transparent p-4 text-base font-semibold text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none',
                'border-border',
                activeTab === feature.value ? 'border-primary' : 'hover:border-primary/40',
                 index === 0 && 'rounded-tl-lg',
                 index === features.length - 1 && 'rounded-tr-lg'
              )}
            >
              {feature.title.split(' ')[0]}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <Card className="rounded-t-none border-t-0 shadow-xl">
          <CardContent className="pt-8">
            {features.map((feature) => (
              <TabsContent key={feature.value} value={feature.value} className="m-0">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-8">
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                    <ul className="space-y-3">
                      {feature.points.map((point) => (
                        <li key={point} className="flex items-start">
                          <CheckCircle className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                          <span className="text-foreground/90">{point}</span>
                        </li>
                      ))}
                    </ul>
                    <Button>Get Started</Button>
                  </div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-lg">
                    <Image
                      src={feature.imageUrl}
                      alt={feature.title}
                      data-ai-hint={feature.imageHint}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </TabsContent>
            ))}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
