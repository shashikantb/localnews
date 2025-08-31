
'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';

interface ReferralSharerProps {
    code: string;
}

export default function ReferralSharer({ code }: ReferralSharerProps) {
    const [origin, setOrigin] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        // This ensures window is defined, as it only runs on the client
        setOrigin(window.location.origin);
    }, []);

    const handleShare = async () => {
        if (!origin) return;

        const referralLink = `${origin}/signup?ref=${code}`;
        const shareText = `Join me on LocalPulse and get 20 bonus LP Points! Use my referral code or click the link to sign up: ${referralLink}`;
        const shareData = {
            title: 'Join LocalPulse!',
            text: shareText,
            url: referralLink,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.log('Share canceled or failed:', error);
            }
        } else {
            // Fallback for desktop or browsers that don't support the Web Share API
            try {
                await navigator.clipboard.writeText(referralLink);
                toast({ title: 'Referral Link Copied!', description: 'The link has been copied to your clipboard.' });
            } catch (err) {
                console.error("Failed to copy link:", err);
            }
        }
    };

    return (
        <Card className="shadow-xl border-border/60 rounded-xl bg-gradient-to-tr from-accent/10 to-primary/10">
            <CardHeader className="p-4 pb-2">
                <p className="text-sm font-semibold text-primary">Grow Your Community & Earn Rewards!</p>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-background/70 border border-primary/10 shadow-inner">
                    <div className="flex-1 text-center sm:text-left">
                        <p className="text-sm text-muted-foreground">Share your code and earn <span className="font-bold text-accent">50 LP Points</span>! New users get <span className="font-bold text-accent">20 LP Points</span>.</p>
                        <p className="text-lg font-bold tracking-wider text-foreground mt-1">Your Code: {code}</p>
                    </div>
                    <Button onClick={handleShare} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Referral
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
