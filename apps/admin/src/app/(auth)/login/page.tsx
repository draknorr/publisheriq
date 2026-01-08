'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Gamepad2, Mail, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createBrowserClient();

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        // Don't reveal if email exists - always show success
        console.error('Auth error:', authError);
      }

      // Always show success to prevent email enumeration
      setIsSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <Card variant="elevated" padding="lg" className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-green mb-4">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-heading text-text-primary">Check your email</h1>
            <p className="text-body-sm text-text-secondary mt-2">
              We sent a sign-in link to <strong className="text-text-primary">{email}</strong>
            </p>
            <p className="text-body-xs text-text-tertiary mt-4">
              Click the link in the email to sign in. The link expires in 1 hour.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-6"
              onClick={() => {
                setIsSuccess(false);
                setEmail('');
              }}
            >
              Use a different email
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <Card variant="elevated" padding="lg" className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-blue mb-4">
            <Gamepad2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-heading text-text-primary">PublisherIQ</h1>
          <p className="text-body-sm text-text-secondary mt-1">Sign in with magic link</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="h-4 w-4" />}
            error={error}
            autoFocus
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full"
            disabled={!email}
          >
            {isLoading ? 'Sending link...' : 'Send magic link'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-body-xs text-text-tertiary">
            Don&apos;t have an account?{' '}
            <Link href="/waitlist" className="text-accent-blue hover:underline">
              Join the waitlist
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
