import type { Metadata } from 'next';
import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata: Metadata = {
  title: 'PublisherIQ',
  description: 'Gaming Industry Intelligence',
};

function LandingFooter() {
  return (
    <footer className="border-t border-border-subtle py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
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
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <p className="text-caption text-text-muted">
            PublisherIQ
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary">
              <Gamepad2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-display text-text-primary mb-3 tracking-tight">
            PublisherIQ
          </h1>
          <p className="text-body-lg text-text-secondary mb-8">
            Gaming Industry Intelligence
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/waitlist">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Join Waitlist
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
