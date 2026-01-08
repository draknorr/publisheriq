import type { Metadata } from 'next';
import Link from 'next/link';
import { Gamepad2, Sparkles, BarChart3, TrendingUp, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata: Metadata = {
  title: 'PublisherIQ - Game Analytics Platform',
  description: 'AI-powered game analytics covering Steam, Epic Games, and more. Research games, track market trends, and benchmark competitors.',
};

function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border-subtle">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-primary">
            <Gamepad2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-subheading text-text-primary tracking-tight">PublisherIQ</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/waitlist" className="hidden sm:block">
            <Button variant="primary" size="sm">Get Started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-display text-text-primary mb-6 animate-fade-in-up">
          <span className="bg-gradient-to-r from-accent-primary via-accent-purple to-accent-cyan bg-clip-text text-transparent">Game Analytics</span> Platform
        </h1>
        <p className="text-body-lg text-text-secondary mb-8 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          AI-powered intelligence for Steam, Epic Games, and beyond.
          Research games, track market trends, and benchmark competitors with natural language queries.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Link href="/waitlist">
            <Button variant="primary" size="lg" className="w-full sm:w-auto">
              Join Waitlist
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: BarChart3,
      iconBg: 'bg-accent-purple/15',
      iconColor: 'text-accent-purple',
      title: 'Market Analytics',
      description: 'Track player counts, review trends, and pricing across platforms. Comprehensive data for informed decisions.',
    },
    {
      icon: Sparkles,
      iconBg: 'bg-accent-primary/15',
      iconColor: 'text-accent-primary',
      title: 'AI Chat Interface',
      description: 'Ask questions in plain English, get instant data-driven insights. No SQL required.',
    },
    {
      icon: TrendingUp,
      iconBg: 'bg-accent-green/15',
      iconColor: 'text-accent-green',
      title: 'Multi-Platform',
      description: 'Comprehensive coverage of Steam, Epic Games, and expanding. All your game data in one place.',
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 bg-surface-raised">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-heading text-text-primary text-center mb-4">
          Intelligence at Your Fingertips
        </h2>
        <p className="text-body text-text-secondary text-center mb-12 max-w-2xl mx-auto">
          Everything you need to understand the gaming market and make data-driven decisions.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                variant="elevated"
                padding="lg"
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`h-12 w-12 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-subheading text-text-primary mb-2">{feature.title}</h3>
                <p className="text-body text-text-secondary">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-heading text-text-primary mb-4">
          Ready to Get Started?
        </h2>
        <p className="text-body-lg text-text-secondary mb-8">
          Join the waitlist for early access to PublisherIQ.
        </p>
        <Link href="/waitlist">
          <Button variant="primary" size="lg">
            Join the Waitlist
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border-subtle py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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
        <p className="text-caption text-text-muted">
          PublisherIQ
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface">
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
