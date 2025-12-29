'use client';

import { useEffect } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { useSidebar } from '@/contexts';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/apps', label: 'Apps', icon: Gamepad2 },
  { href: '/publishers', label: 'Publishers', icon: Building2 },
  { href: '/developers', label: 'Developers', icon: Users },
  { href: '/admin', label: 'Admin Dashboard', icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, toggle, close } = useSidebar();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

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

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={toggle}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised border border-border-subtle md:hidden"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? (
          <X className="h-5 w-5 text-text-primary" />
        ) : (
          <Menu className="h-5 w-5 text-text-primary" />
        )}
      </button>

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
          fixed left-0 top-0 z-40 h-screen w-64 border-r border-border-subtle bg-surface-raised
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center border-b border-border-subtle px-5">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-text-primary transition-opacity hover:opacity-80"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-blue">
                <Gamepad2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-subheading tracking-tight">PublisherIQ</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4">
            <div className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      group relative flex items-center gap-3 rounded-md px-3 py-2
                      text-body font-medium transition-all duration-150
                      ${
                        active
                          ? 'bg-surface-elevated text-text-primary'
                          : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                      }
                    `}
                  >
                    {/* Active indicator */}
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent-blue" />
                    )}
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 ${
                        active ? 'text-accent-blue' : 'text-text-tertiary group-hover:text-text-secondary'
                      }`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-border-subtle p-4">
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
          </div>
        </div>
      </aside>
    </>
  );
}
