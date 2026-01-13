'use client';

import { Suspense, useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Gamepad2, Mail, CheckCircle, UserPlus, ArrowRight, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createBrowserClient } from '@/lib/supabase/client';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showWaitlistPrompt, setShowWaitlistPrompt] = useState(false);

  // Handle error from failed auth callback
  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError === 'auth_failed' || urlError === 'invalid_token') {
      setError('Sign-in link expired or invalid. Please request a new one.');
    } else if (urlError === 'missing_token') {
      setError('Invalid sign-in link. Please request a new one.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setShowWaitlistPrompt(false);
    setIsLoading(true);

    try {
      // Step 1: Validate email is approved
      const validateResponse = await fetch('/api/auth/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const validation = await validateResponse.json();

      if (!validation.valid) {
        if (validation.reason === 'not_approved') {
          // Show friendly waitlist prompt instead of error
          setShowWaitlistPrompt(true);
        } else {
          setError(validation.message || 'This email does not have access.');
        }
        setIsLoading(false);
        return;
      }

      // Step 2: Send magic link (only for approved emails)
      // The email template controls the redirect URL using {{ .TokenHash }}
      const supabase = createBrowserClient();

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (authError) {
        console.error('Auth error:', authError);
        setError('Unable to send sign-in link. Please try again.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showWaitlistPrompt) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <Card variant="elevated" padding="lg" className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-orange/15 mb-4">
              <UserPlus className="h-6 w-6 text-accent-orange" />
            </div>
            <h1 className="text-heading text-text-primary">Request Access</h1>
            <p className="text-body-sm text-text-secondary mt-2">
              <strong className="text-text-primary">{email}</strong> doesn&apos;t have access yet.
            </p>
            <p className="text-body-xs text-text-tertiary mt-2">
              Join the waitlist to request access to PublisherIQ.
            </p>
            <div className="flex flex-col gap-3 mt-6 w-full">
              <Link href={`/waitlist?email=${encodeURIComponent(email)}`}>
                <Button variant="primary" size="lg" className="w-full">
                  Join Waitlist
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowWaitlistPrompt(false);
                  setEmail('');
                }}
              >
                Try a different email
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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

function LoginLoadingFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <Card variant="elevated" padding="lg" className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-accent-blue animate-spin mb-4" />
          <p className="text-body-sm text-text-secondary">Loading...</p>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
