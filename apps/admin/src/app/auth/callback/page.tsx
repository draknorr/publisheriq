'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * Client-side auth callback handler for implicit flow.
 *
 * Magic links redirect here with tokens in the URL hash fragment (#access_token=...).
 * This avoids the PKCE localStorage issue where email clients (Gmail, Outlook, etc.)
 * open links in different browser contexts that don't have access to localStorage.
 *
 * The Supabase client automatically detects and processes hash fragments when initialized.
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = createBrowserClient();

        // Check if there's a hash fragment with auth tokens
        // Supabase client auto-detects this on initialization
        const hash = window.location.hash;

        if (hash && hash.includes('access_token')) {
          // Implicit flow - Supabase handles hash parsing automatically
          // Wait a moment for the session to be established
          await new Promise(resolve => setTimeout(resolve, 100));

          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('Session error:', sessionError);
            setError('Failed to establish session. Please try again.');
            return;
          }

          if (session) {
            // Clear the hash from URL for cleanliness
            window.history.replaceState(null, '', window.location.pathname);

            // Success - redirect to intended destination
            const next = searchParams.get('next') || '/dashboard';
            router.replace(next);
            return;
          }
        }

        // Check for error in URL
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        if (errorParam) {
          setError(errorDescription || errorParam);
          return;
        }

        // No auth tokens found - might be direct navigation
        // Try to get existing session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Already logged in
          router.replace('/dashboard');
          return;
        }

        // No session, no tokens - redirect to login
        setError('No authentication data found. Redirecting to login...');
        setTimeout(() => router.replace('/login'), 2000);

      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="bg-surface-raised rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
          <div className="text-accent-red mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-heading text-text-primary mb-2">Authentication Error</h2>
          <p className="text-body-sm text-text-secondary mb-4">{error}</p>
          <button
            onClick={() => router.replace('/login')}
            className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-surface-raised rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
        <Loader2 className="w-12 h-12 mx-auto text-accent-blue animate-spin mb-4" />
        <h2 className="text-heading text-text-primary mb-2">Signing you in...</h2>
        <p className="text-body-sm text-text-secondary">
          {isProcessing ? 'Processing authentication...' : 'Redirecting to dashboard...'}
        </p>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-surface-raised rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
        <Loader2 className="w-12 h-12 mx-auto text-accent-blue animate-spin mb-4" />
        <h2 className="text-heading text-text-primary mb-2">Loading...</h2>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
