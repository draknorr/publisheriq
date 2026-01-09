'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Gamepad2, Mail, User, Building2, FileText, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createBrowserClient } from '@/lib/supabase/client';

function WaitlistForm() {
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    organization: '',
    howIPlanToUse: '',
  });

  // Pre-fill email from URL param (e.g., /waitlist?email=user@example.com)
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setFormData((prev) => ({ ...prev, email: emailParam }));
    }
  }, [searchParams]);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createBrowserClient();

      // Check if email already exists and update, or insert new
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (supabase.from('waitlist') as any)
        .upsert(
          {
            email: formData.email,
            full_name: formData.fullName,
            organization: formData.organization || null,
            how_i_plan_to_use: formData.howIPlanToUse || null,
            status: 'pending',
          },
          {
            onConflict: 'email',
            ignoreDuplicates: false,
          }
        );

      if (upsertError) {
        console.error('Waitlist error:', upsertError);
        // Don't reveal specific errors to prevent email enumeration
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
        <Card variant="elevated" padding="lg" className="w-full max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-green mb-4">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-heading text-text-primary">You&apos;re on the list</h1>
            <p className="text-body-sm text-text-secondary mt-2">
              Thanks for your interest in PublisherIQ! We&apos;ll review your application and be in touch soon.
            </p>
            <Link href="/login" className="mt-6">
              <Button variant="ghost" size="sm">
                Already have an account? Sign in
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <Card variant="elevated" padding="lg" className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-blue mb-4">
            <Gamepad2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-heading text-text-primary">Join the Waitlist</h1>
          <p className="text-body-sm text-text-secondary mt-1 text-center">
            PublisherIQ is currently invite-only. Join the waitlist to request access.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            name="email"
            placeholder="Email address"
            value={formData.email}
            onChange={handleChange}
            leftIcon={<Mail className="h-4 w-4" />}
            required
            autoFocus
          />

          <Input
            type="text"
            name="fullName"
            placeholder="Full name"
            value={formData.fullName}
            onChange={handleChange}
            leftIcon={<User className="h-4 w-4" />}
            required
          />

          <Input
            type="text"
            name="organization"
            placeholder="Organization (optional)"
            value={formData.organization}
            onChange={handleChange}
            leftIcon={<Building2 className="h-4 w-4" />}
          />

          <div className="space-y-1.5">
            <label className="text-label text-text-secondary flex items-center gap-2">
              <FileText className="h-4 w-4" />
              How do you plan to use PublisherIQ? (optional)
            </label>
            <textarea
              name="howIPlanToUse"
              value={formData.howIPlanToUse}
              onChange={handleChange}
              placeholder="Tell us about your use case..."
              className="w-full min-h-[100px] px-3 py-2 rounded-lg border border-border-subtle bg-surface text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-shadow resize-none"
            />
          </div>

          {error && (
            <p className="text-body-sm text-accent-red">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full"
            disabled={!formData.email || !formData.fullName}
          >
            {isLoading ? 'Submitting...' : 'Join waitlist'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-body-xs text-text-tertiary">
            Already have an account?{' '}
            <Link href="/login" className="text-accent-blue hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <Card variant="elevated" padding="lg" className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-blue mb-4">
              <Gamepad2 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-heading text-text-primary">Join the Waitlist</h1>
            <p className="text-body-sm text-text-secondary mt-1 text-center">
              Loading...
            </p>
          </div>
        </Card>
      </div>
    }>
      <WaitlistForm />
    </Suspense>
  );
}
