
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { adminLogout } from '@/app/admin/actions';
import { LayoutDashboard, FileText, Users, LogOut, Settings, ShieldCheck, Bell, BadgeCheck, DatabaseZap, UserCheck as UserCheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/posts', label: 'Manage Posts', icon: FileText },
  { href: '/admin/users', label: 'Manage Users', icon: Users },
  { href: '/admin/approvals', label: 'Manual Approvals', icon: UserCheckIcon },
  { href: '/admin/verification', label: 'Business Verification', icon: BadgeCheck },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export const AdminNav: FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await adminLogout();
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
      router.refresh(); 
    } catch (error) {
      console.error('Logout failed:', error);
      toast({
        title: 'Logout Failed',
        description: 'An error occurred during logout. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col text-card-foreground">
      <div className="p-4 border-b border-border">
        <Link href="/admin" className="flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-semibold text-primary">Admin Panel</h1>
        </Link>
      </div>
      <nav className="flex-grow p-4 space-y-2">
        {navItems.map((item) => (
          <Button
            key={item.href}
            variant={pathname.startsWith(item.href) && item.href !== '/admin' || pathname === '/admin' && item.href === '/admin' ? 'default' : 'ghost'}
            className={cn(
              "w-full justify-start text-base",
               (pathname.startsWith(item.href) && item.href !== '/admin' || pathname === '/admin' && item.href === '/admin') ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
            asChild
          >
            <Link href={item.href}>
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
      <div className="p-4 mt-auto border-t border-border">
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
};

export default AdminNav;
