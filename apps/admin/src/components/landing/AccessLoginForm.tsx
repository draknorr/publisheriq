"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AccessInput,
  AccessPrimaryButton,
  AccessSheetMessage,
  AccessTextButton,
  accessSmallText,
} from "@/components/landing/AccessShell";
import { waitForAuthenticatedBrowserUser } from "@/lib/auth/browser-session";
import { sanitizeAuthNextPath } from "@/lib/auth/redirects";
import { createBrowserClientNoRefresh } from "@/lib/supabase/client";

const AUTH_DEBUG = process.env.NEXT_PUBLIC_AUTH_DEBUG === "true";
const AUTH_SESSION_READY_TIMEOUT_MS = 5000;
const VERIFY_OTP_TIMEOUT_MS = 15000;
const SESSION_CHECK_TIMEOUT_MS = 3000;

type LoginSupabaseClient = ReturnType<typeof createBrowserClientNoRefresh>;

interface AccessLoginFormProps {
  requestAccessTarget?: "home" | "route";
}

function mapAuthError(
  error: { status?: number; message?: string } | null,
): string {
  if (!error) return "We could not complete sign-in. Please try again.";
  const msg = error.message?.toLowerCase() ?? "";
  if (error.status === 429 || msg.includes("rate limit")) {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }
  if (msg.includes("expired")) {
    return "Your code has expired. Please request a new one.";
  }
  if (msg.includes("invalid")) {
    return "That code did not work. Check the 8-digit code and try again.";
  }
  return "We could not complete sign-in. Please try again.";
}

function logAuthDebug(
  message: string,
  details: Record<string, unknown> = {},
): void {
  if (!AUTH_DEBUG || typeof window === "undefined") {
    return;
  }

  console.info("[auth][login]", {
    message,
    hostname: window.location.hostname,
    ...details,
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]);
}

function getOrCreateLoginSupabaseClient(ref: {
  current: Promise<LoginSupabaseClient> | null;
}): Promise<LoginSupabaseClient> {
  if (!ref.current) {
    const client = createBrowserClientNoRefresh();
    ref.current = client.auth
      .stopAutoRefresh()
      .catch((err) => {
        logAuthDebug("stop-auto-refresh-failed", { error: String(err) });
      })
      .then(() => client);
  }

  return ref.current;
}

export function AccessLoginForm({
  requestAccessTarget = "route",
}: AccessLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeAuthNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showWaitlistPrompt, setShowWaitlistPrompt] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [resendCooldown, setResendCooldown] = useState(0);
  const loginSupabasePromiseRef = useRef<Promise<LoginSupabaseClient> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      if (searchParams.get("error") === "profile_recovery_failed") {
        return;
      }

      try {
        const supabase = await getOrCreateLoginSupabaseClient(
          loginSupabasePromiseRef,
        );
        const {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_CHECK_TIMEOUT_MS,
          "existing-session-check",
        );

        logAuthDebug("existing-session-check", { hasSession: !!session });
        if (!session) {
          return;
        }

        const authReadyResult = await waitForAuthenticatedBrowserUser({
          client: supabase,
          timeoutMs: AUTH_SESSION_READY_TIMEOUT_MS,
        });

        logAuthDebug("existing-session-authoritative-check", {
          ok: authReadyResult.ok,
          sourceOrReason: authReadyResult.ok
            ? authReadyResult.source
            : authReadyResult.reason,
        });

        if (!cancelled && authReadyResult.ok) {
          router.replace(nextPath);
        }
      } catch (err) {
        logAuthDebug("existing-session-check-failed", { error: String(err) });
      }
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [nextPath, router, searchParams]);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError === "auth_failed" || urlError === "invalid_token") {
      setError("Sign-in code expired or invalid. Please request a new one.");
    } else if (urlError === "missing_token") {
      setError("Invalid sign-in link. Please request a new one.");
    } else if (urlError === "profile_recovery_failed") {
      setError(
        "Your sign-in succeeded, but we could not restore your account profile. Please try again.",
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (otpSent && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpSent]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown > 0]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setShowWaitlistPrompt(false);
    setIsLoading(true);

    try {
      const validateResponse = await fetch("/api/auth/validate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!validateResponse.ok) {
        setError(
          "We could not check whether this email has access. Please try again.",
        );
        setIsLoading(false);
        return;
      }

      const validation = await validateResponse.json();

      if (!validation.valid) {
        if (validation.reason === "not_approved") {
          setShowWaitlistPrompt(true);
        } else {
          setError(
            validation.message ||
              "This email is not approved for PublisherIQ yet.",
          );
        }
        setIsLoading(false);
        return;
      }

      const supabase = await getOrCreateLoginSupabaseClient(
        loginSupabasePromiseRef,
      );

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (authError) {
        console.error("Auth error:", authError);
        setError(mapAuthError(authError));
        setIsLoading(false);
        return;
      }

      setOtpSent(true);
      setOtp("");
      setResendCooldown(60);
    } catch {
      setError("We could not send a sign-in code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsVerifying(true);

    try {
      const supabase = await getOrCreateLoginSupabaseClient(
        loginSupabasePromiseRef,
      );

      const { data, error: verifyError } = await withTimeout(
        supabase.auth.verifyOtp({
          email,
          token: otp,
          type: "email",
        }),
        VERIFY_OTP_TIMEOUT_MS,
        "verify-otp",
      );

      if (verifyError) {
        console.error("OTP verification error:", verifyError);
        setError(mapAuthError(verifyError));
        setIsVerifying(false);
        return;
      }

      logAuthDebug("verify-otp-success", { hasDataSession: !!data.session });

      let hasSession = !!data.session;
      if (!hasSession) {
        const {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_CHECK_TIMEOUT_MS,
          "session-check-after-verify",
        );
        hasSession = !!session;
      }

      if (!hasSession) {
        setError(
          "The code worked, but we could not finish signing you in. Please try again.",
        );
        setIsVerifying(false);
        return;
      }

      const authReadyResult = await waitForAuthenticatedBrowserUser({
        client: supabase,
        timeoutMs: AUTH_SESSION_READY_TIMEOUT_MS,
      });

      logAuthDebug("post-verify-authoritative-check", {
        ok: authReadyResult.ok,
        sourceOrReason: authReadyResult.ok
          ? authReadyResult.source
          : authReadyResult.reason,
        error: authReadyResult.ok ? null : (authReadyResult.error ?? null),
      });

      if (!authReadyResult.ok) {
        try {
          const { error: signOutError } = await supabase.auth.signOut({
            scope: "local",
          });
          if (signOutError) {
            logAuthDebug("post-verify-session-cleanup-failed", {
              error: signOutError.message,
            });
          }
        } catch (cleanupError) {
          logAuthDebug("post-verify-session-cleanup-threw", {
            error: String(cleanupError),
          });
        }

        setError(
          "The code worked, but we could not finish signing you in. Please try again.",
        );
        setIsVerifying(false);
        return;
      }

      router.replace(nextPath);
    } catch (err) {
      logAuthDebug("verify-flow-failed", { error: String(err) });
      setError("We could not verify that code in time. Please try again.");
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setIsLoading(true);
    setOtp("");

    try {
      const supabase = await getOrCreateLoginSupabaseClient(
        loginSupabasePromiseRef,
      );

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (authError) {
        setError(mapAuthError(authError));
      } else {
        setResendCooldown(60);
      }
    } catch {
      setError("We could not send a new code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const requestAccessHref =
    requestAccessTarget === "home"
      ? `/?access=request&email=${encodeURIComponent(email)}`
      : `/waitlist?email=${encodeURIComponent(email)}`;

  if (showWaitlistPrompt) {
    return (
      <div className="space-y-8">
        <AccessSheetMessage title="Not approved">
          <p>
            <strong className="font-medium text-[#171814]">{email}</strong> is
            not approved yet.
          </p>
        </AccessSheetMessage>
        <div className="space-y-5">
          <Link
            href={requestAccessHref}
            className={`${accessSmallText} group inline-flex h-14 w-full items-center justify-between bg-[#090b09] px-7 text-[#f7f5ee] transition-colors hover:bg-[#171814] focus-visible:bg-[#171814]`}
          >
            <span>Request access</span>
            <span
              aria-hidden="true"
              className="text-[1rem] transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1"
            >
              {"\u2192"}
            </span>
          </Link>
          <AccessTextButton
            type="button"
            onClick={() => {
              setShowWaitlistPrompt(false);
              setEmail("");
            }}
          >
            Use another email
          </AccessTextButton>
        </div>
      </div>
    );
  }

  if (otpSent) {
    return (
      <div className="space-y-8">
        <AccessSheetMessage title="Check email">
          <p>
            Code sent to{" "}
            <strong className="font-medium text-[#171814]">{email}</strong>.
          </p>
        </AccessSheetMessage>

        <form onSubmit={handleVerifyOtp} className="space-y-7">
          <AccessInput
            ref={otpInputRef}
            type="text"
            label="8-digit code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            placeholder="12345678"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            error={error}
            className="text-center font-mono text-[1.35rem] tracking-[0.36em]"
            autoComplete="one-time-code"
          />

          <AccessPrimaryButton
            type="submit"
            isLoading={isVerifying}
            disabled={otp.length !== 8 || isVerifying}
          >
            {isVerifying ? "Signing in" : "Sign in"}
          </AccessPrimaryButton>
        </form>

        <div className="flex flex-col items-start gap-4">
          <AccessTextButton
            type="button"
            onClick={handleResendOtp}
            disabled={isLoading || resendCooldown > 0}
          >
            {isLoading
              ? "Sending"
              : resendCooldown > 0
                ? `Send new code (${resendCooldown}s)`
                : "Send new code"}
          </AccessTextButton>
          <AccessTextButton
            type="button"
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              setEmail("");
              setError("");
              setResendCooldown(0);
            }}
          >
            Use another email
          </AccessTextButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <AccessInput
        type="email"
        label="Work email"
        placeholder="name@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        autoFocus
        required
      />

      <AccessPrimaryButton
        type="submit"
        isLoading={isLoading}
        disabled={!email}
      >
        {isLoading ? "Sending code" : "Email code"}
      </AccessPrimaryButton>
    </form>
  );
}

export function AccessLoginFallback() {
  return <AccessSheetMessage title="Preparing sign-in" />;
}
