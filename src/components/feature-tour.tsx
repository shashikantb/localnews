
'use client';

import React, { useEffect, useState } from 'react';
import Joyride, { type CallBackProps, type Step, STATUS } from 'react-joyride';
import { useTourStore } from '@/hooks/use-tour-store';
import { useTheme } from 'next-themes';
import { useIsMobile } from '@/hooks/use-mobile';

const tourSteps: Step[] = [
    {
        target: '#nav-home',
        content: "Welcome to LocalPulse! This is the Home feed where you'll see all the latest posts.",
        placement: 'bottom',
    },
    {
        target: '#post-composer-button',
        content: 'Click here to share your own pulse with the community. You can add text, media, and more!',
        placement: 'bottom',
    },
    {
        target: '#nav-reels',
        content: "Switch to the Reels tab to watch short video and image posts in a full-screen view.",
        placement: 'bottom',
    },
    {
        target: '#nav-chat',
        content: 'The Chat tab is where you can find all your private and group conversations.',
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '#ai-helper-button',
        content: 'Need help? Our AI Helper can find local businesses or search for recent posts for you.',
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: 'header > div > div > button', // More specific selector for the user nav in the header
        content: "Click on your profile icon to view your profile, manage settings, or start this tour again.",
        placement: 'bottom-end',
    },
];

const FeatureTour = () => {
    const { isTourRunning, stopTour } = useTourStore();
    const { theme } = useTheme();
    const isMobile = useIsMobile();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, type } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            stopTour();
        }
    };
    
    // The tour component cannot render on the server, so we wait for mount.
    if (!isMounted) {
        return null;
    }

    // Adapt step targets for mobile layout if necessary
    const adaptedSteps = tourSteps.map(step => {
        if (isMobile && step.target === 'header > div > div > button') {
            // In mobile view, the user nav moves to the bottom bar.
            // This is a placeholder; a more robust solution would use unique IDs.
            return { ...step, target: 'nav > div > div:last-child > div' };
        }
        return step;
    });

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous
            run={isTourRunning}
            scrollToFirstStep
            showProgress
            showSkipButton
            steps={adaptedSteps}
            styles={{
                options: {
                    zIndex: 10000,
                    arrowColor: theme === 'dark' ? '#17253d' : '#ffffff',
                    backgroundColor: theme === 'dark' ? '#17253d' : '#ffffff',
                    primaryColor: '#14b8a6', // teal-500
                    textColor: theme === 'dark' ? '#f0f9ff' : '#020817',
                },
            }}
        />
    );
};

export default FeatureTour;
