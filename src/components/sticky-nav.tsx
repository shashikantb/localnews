
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Film, User as UserIcon, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUnreadMessageCount } from '@/app/actions';
import type { User } from '@/lib/db-types';
import SosButton from './sos-button';

const UNREAD_POLL_INTERVAL = 15000; // 15 seconds

interface StickyNavProps {
  user: User | null;
}

const StickyNav: FC<StickyNavProps> = ({ user }) => {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread messages only if the user is logged in
  useEffect(() => {
    if (!user) {
      setUnreadCount(0); // Reset count if user logs out
      return;
    }
    
    // Fetch immediately on component mount/user change
    getUnreadMessageCount().then(setUnreadCount);

    const intervalId = setInterval(() => {
        getUnreadMessageCount().then(setUnreadCount);
    }, UNREAD_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user]); // Depend on the user prop

  const navItems = [
    { name: 'Home', href: '/', icon: Home, current: pathname === '/' },
    { name: 'Reels', href: '/reels', icon: Film, current: pathname === '/reels' },
  ];

  const authNavItems = [
    { name: 'Chat', href: '/chat', icon: MessageSquare, current: pathname.startsWith('/chat'), badgeCount: unreadCount },
    { 
      name: 'Profile', 
      href: user ? `/users/${user.id}` : '/login', 
      icon: UserIcon, 
      current: user ? pathname.startsWith(`/users/${user.id}`) : pathname === '/login' 
    }
  ];

  const renderNavItem = (item: any) => (
    <div key={item.name} className="flex-1 flex h-full">
        <Link
            href={item.href}
            className={cn(
                'relative flex h-full w-full flex-col items-center justify-center space-y-1 border-b-2 px-2 pt-1 text-sm font-medium transition-colors',
                item.current
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
            aria-current={item.current ? 'page' : undefined}
        >
            <item.icon className="h-6 w-6" />
            <span className="text-xs">{item.name}</span>
            {item.badgeCount > 0 && (
                <span className="absolute top-1 right-2 sm:right-auto sm:left-1/2 sm:ml-4 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold ring-2 ring-background">
                    {item.badgeCount > 9 ? '9+' : item.badgeCount}
                </span>
            )}
        </Link>
    </div>
  );

  return (
    <nav className="sticky top-14 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-2xl items-center justify-around px-0 sm:px-2">
          {navItems.map(renderNavItem)}

          {user && (
            <>
                <div className="flex h-full flex-col items-center justify-center flex-1">
                    <SosButton />
                </div>
                {authNavItems.map(renderNavItem)}
            </>
          )}

          {!user && (
            <div className="flex-1 flex h-full">
                <Link
                    href="/login"
                    className={cn(
                        'relative flex h-full w-full flex-col items-center justify-center space-y-1 border-b-2 px-2 pt-1 text-sm font-medium transition-colors',
                        pathname.startsWith('/login') || pathname.startsWith('/signup')
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                >
                    <UserIcon className="h-6 w-6" />
                    <span className="text-xs">Profile</span>
                </Link>
            </div>
          )}
      </div>
    </nav>
  );
};

export default StickyNav;
