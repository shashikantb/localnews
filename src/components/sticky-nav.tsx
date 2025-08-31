

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, Film, MessageSquare, User as UserIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getUnreadMessageCount } from '@/app/actions';
import type { User } from '@/lib/db-types';
import SosButton from './sos-button';

const UNREAD_POLL_INTERVAL = 15_000;

type Props = { user?: User | null };

export default function StickyNav({ user }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Figure out the current tab by the route.
  // This now correctly highlights the 'Profile' tab for login, signup, and account pages.
  const current =
    pathname.startsWith('/reels') ? '/reels' :
    pathname.startsWith('/chat') ? '/chat' :
    (pathname.startsWith('/users') || pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password') || pathname.startsWith('/account')) ? '/profile' :
    '/';

  // unread chat indicator
  const [unread, setUnread] = useState<number>(0);
  useEffect(() => {
    if (!user) return; // Don't poll for unread messages if user is not logged in.
    let active = true;
    const tick = async () => {
      try {
        const n = await getUnreadMessageCount();
        if (active) setUnread(n ?? 0);
      } catch {}
    };
    tick();
    const t = setInterval(tick, UNREAD_POLL_INTERVAL);
    return () => { active = false; clearInterval(t); };
  }, [user]);

  // routes for tabs
  const profileHref = user ? `/users/${user.id}` : '/login';
  
  const allTabs = [
    { value: '/',       label: 'Home',   icon: Home,          href: '/' },
    { value: '/reels',  label: 'Reels',  icon: Film,          href: '/reels' },
    { value: '/chat',   label: 'Chat',   icon: MessageSquare, href: '/chat' },
    { value: '/profile',label: 'Profile',icon: UserIcon,      href: profileHref },
  ];

  const tabs = user ? allTabs : allTabs.filter(t => t.value !== '/chat');

  return (
    <nav className="sticky top-[56px] sm:top-[64px] z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-screen-md px-3 py-2">
        <div className="relative">
          {/* Segmented / pill tabs */}
          <Tabs value={current} onValueChange={(v) => {
            const target = tabs.find(t => t.value === v)?.href ?? '/';
            router.push(target);
          }}>
            <TabsList
              className={cn(
                'w-full h-12 rounded-full bg-muted p-1 text-muted-foreground',
                'flex justify-between'
              )}
            >
              {tabs.map(t => {
                const Icon = t.icon;
                const isChat = t.value === '/chat';
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className={cn(
                      'relative flex-1 h-10 rounded-full gap-2',
                      'data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm'
                    )}
                    // allow middle-click / open in new tab via Link
                    asChild
                  >
                    <Link href={t.href}>
                      <Icon className="h-5 w-5" />
                      <span className="hidden sm:inline">{t.label}</span>
                      {isChat && unread > 0 && user && (
                        <span className="absolute -top-1 right-3 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      )}
                    </Link>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Center floating SOS button - now only shows for logged-in users */}
          {user && (
            <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="pointer-events-auto">
                <SosButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

