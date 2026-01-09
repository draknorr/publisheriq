'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Gamepad2,
  Building2,
  Users,
  Menu,
  X,
  MessageSquare,
  Shield,
  User,
  ClipboardList,
  BarChart3,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useSidebar } from '@/contexts';
import { ThemeToggle } from '@/components/ui';
import { createBrowserClient } from '@/lib/supabase/client';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children?: NavItem[];
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/apps', label: 'Apps', icon: Gamepad2 },
  { href: '/publishers', label: 'Publishers', icon: Building2 },
  { href: '/developers', label: 'Developers', icon: Users },
];

const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'System Status', icon: Shield },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/waitlist', label: 'Waitlist', icon: ClipboardList },
  { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, toggle, close } = useSidebar();
  const [userProfile, setUserProfile] = useState<{
    email: string;
    role: 'user' | 'admin';
  } | null>(null);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    // For admin routes, only match exact or child paths
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const isAdminSection = pathname.startsWith('/admin');

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('email, role')
            .eq('id', user.id)
            .single();

          if (profile) {
            setUserProfile(profile);
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };

    fetchProfile();

    // Subscribe to auth changes
    const supabase = createBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-expand admin section when on admin pages
  useEffect(() => {
    if (isAdminSection) {
      setAdminExpanded(true);
    }
  }, [isAdminSection]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isAdmin = userProfile?.role === 'admin';

  return (
    <>
      {/* Mobile header controls */}
      <div className="fixed left-4 right-4 top-safe z-50 flex items-center justify-between md:hidden">
        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised border border-border-subtle"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? (
            <X className="h-5 w-5 text-text-primary" />
          ) : (
            <Menu className="h-5 w-5 text-text-primary" />
          )}
        </button>
        <ThemeToggle />
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-40 h-screen-safe w-64 border-r border-border-subtle bg-surface-raised
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center border-b border-border-subtle px-5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 text-text-primary transition-opacity hover:opacity-80"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-primary">
                <Gamepad2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-subheading tracking-tight">PublisherIQ</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
            {/* Main nav items */}
            <div className="space-y-1">
              {mainNavItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      group relative flex items-center gap-3 rounded-lg px-3 py-2
                      text-body font-medium transition-all duration-150
                      ${
                        active
                          ? 'bg-surface-elevated text-text-primary'
                          : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                      }
                    `}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent-primary" />
                    )}
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 ${
                        active ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary'
                      }`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Account link */}
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <Link
                href="/account"
                className={`
                  group relative flex items-center gap-3 rounded-lg px-3 py-2
                  text-body font-medium transition-all duration-150
                  ${
                    isActive('/account')
                      ? 'bg-surface-elevated text-text-primary'
                      : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                  }
                `}
              >
                {isActive('/account') && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent-primary" />
                )}
                <User
                  className={`h-4 w-4 flex-shrink-0 ${
                    isActive('/account') ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary'
                  }`}
                />
                Account
              </Link>
            </div>

            {/* Admin section */}
            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <button
                  onClick={() => setAdminExpanded(!adminExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 text-body-sm font-medium text-text-secondary"
                >
                  <span>Admin</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${adminExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {adminExpanded && (
                  <div className="space-y-1 mt-1">
                    {adminNavItems.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`
                            group relative flex items-center gap-3 rounded-lg px-3 py-2 ml-2
                            text-body font-medium transition-all duration-150
                            ${
                              active
                                ? 'bg-surface-elevated text-text-primary'
                                : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                            }
                          `}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent-primary" />
                          )}
                          <Icon
                            className={`h-4 w-4 flex-shrink-0 ${
                              active ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary'
                            }`}
                          />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t border-border-subtle p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent-green animate-pulse-subtle" />
                <p className="text-caption text-text-muted">
                  Made by{' '}
                  <a
                    href="https://www.ryanbohmann.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Ryan
                  </a>
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
