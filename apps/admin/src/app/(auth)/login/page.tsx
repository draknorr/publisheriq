'use client';

import { Suspense, useState, useEffect, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Gamepad2, Mail, UserPlus, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createBrowserClient } from '@/lib/supabase/client';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showWaitlistPrompt, setShowWaitlistPrompt] = useState(false);

  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Handle error from failed auth callback
  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError === 'auth_failed' || urlError === 'invalid_token') {
      setError('Sign-in code expired or invalid. Please request a new one.');
    } else if (urlError === 'missing_token') {
      setError('Invalid sign-in link. Please request a new one.');
    }
  }, [searchParams]);

  // Focus OTP input when shown
  useEffect(() => {
    if (otpSent && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpSent]);

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

      // SECURITY FIX (AUTH-11): Check response status before parsing JSON
      if (!validateResponse.ok) {
        setError('Unable to validate email. Please try again.');
        setIsLoading(false);
        return;
      }

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

      // Step 2: Send OTP code (only for approved emails)
      const supabase = createBrowserClient();

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (authError) {
        console.error('Auth error:', authError);
        setError('Unable to send verification code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Show OTP entry form
      setOtpSent(true);
      setOtp('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    try {
      const supabase = createBrowserClient();

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (verifyError) {
        console.error('OTP verification error:', verifyError);
        setError('Invalid or expired code. Please try again.');
        setIsVerifying(false);
        return;
      }

      // Success - redirect to dashboard
      router.replace('/');
    } catch {
      setError('Something went wrong. Please try again.');
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setIsLoading(true);
    setOtp('');

    try {
      const supabase = createBrowserClient();

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (authError) {
        setError('Unable to resend code. Please try again.');
      }
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

  // OTP entry form (shown after email submitted)
  if (otpSent) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <Card variant="elevated" padding="lg" className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-blue mb-4">
              <KeyRound className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-heading text-text-primary">Enter verification code</h1>
            <p className="text-body-sm text-text-secondary mt-2">
              We sent a verification code to <strong className="text-text-primary">{email}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <Input
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="00000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              error={error}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoComplete="one-time-code"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isVerifying}
              className="w-full"
              disabled={otp.length !== 8 || isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Verify Code'}
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendOtp}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Resend code'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOtpSent(false);
                setOtp('');
                setEmail('');
                setError('');
              }}
            >
              Use a different email
            </Button>
          </div>

          <p className="text-body-xs text-text-tertiary mt-4 text-center">
            The code expires in 1 hour.
          </p>
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
          <p className="text-body-sm text-text-secondary mt-1">Sign in with email</p>
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
            {isLoading ? 'Sending code...' : 'Continue'}
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
