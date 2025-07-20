
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogIn, LogOut, User, UserPlus, PlayCircle } from 'lucide-react';
import type { User as UserType } from '@/lib/db-types';
import { logout, getSession } from '@/app/auth/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useTourStore } from '@/hooks/use-tour-store';
import { cn } from '@/lib/utils';

// Add type definition for the Android interface
declare global {
  interface Window {
    Android?: {
      setLoginStatus?: (isLoggedIn: boolean) => void;
      logout?: () => void;
      clearCookies?: () => void;
    };
  }
}

export const UserNav: FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const { startTour } = useTourStore();

  useEffect(() => {
    setLoading(true);
    getSession().then(session => {
      setUser(session.user);
      setLoading(false);
    });
  }, [pathname]); // Refetch session on every route change

  const handleLogout = async () => {
    // --- Communicate with Android App ---
    if (window.Android) {
      if (window.Android.logout) {
        window.Android.logout();
      }
      if (window.Android.clearCookies) {
        // Explicitly clear cookies to handle JWS errors
        window.Android.clearCookies();
      }
    }
    // --- END ---
    await logout();
    router.refresh();
  };
  
  if (loading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }
  
  const isProfileActive = user ? pathname === `/users/${user.id}` : (pathname === '/login' || pathname === '/signup');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
          <button
            id="user-nav-button"
            className={cn(
                'relative flex h-full w-full flex-row items-center justify-center space-x-2 border-b-2 px-2 text-sm font-medium transition-colors sm:flex-col sm:space-x-0 sm:space-y-1 sm:pt-2',
                isProfileActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            )}
            aria-label="User menu"
          >
            {user ? (
                <Avatar className="h-6 w-6 sm:h-5 sm:w-5">
                    <AvatarImage src={user.profilepictureurl ?? undefined} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
            ) : (
                <User className="h-5 w-5" />
            )}
            <span className="hidden sm:inline">{user ? 'Profile' : 'Login'}</span>
          </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        {user ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href={`/users/${user.id}`} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>My Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => startTour()} className="cursor-pointer">
                  <PlayCircle className="mr-2 h-4 w-4" />
                  <span>Feature Tour</span>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/login" className="cursor-pointer">
                  <LogIn className="mr-2 h-4 w-4" />
                  <span>Login</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/signup" className="cursor-pointer">
                  <UserPlus className="mr-2 h-4 w-4" />
                  <span>Sign Up</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => startTour()} className="cursor-pointer">
              <PlayCircle className="mr-2 h-4 w-4" />
              <span>Feature Tour</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
