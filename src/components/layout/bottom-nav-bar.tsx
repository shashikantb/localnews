
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/reels', label: 'Reels', icon: Film },
];

const BottomNavBar: FC = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border/40 bg-background/95 shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.1)] backdrop-blur-md sm:hidden">
      {navItems.map((item) => {
        const isActive = (pathname === item.href) || (pathname === '/' && item.href === '/'); // Ensure home matches exactly or is the root
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex h-full flex-col items-center justify-center px-4 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <item.icon className={cn('mb-0.5 h-6 w-6 flex-shrink-0', isActive ? 'fill-primary/20' : '')} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
