import Link from "next/link";
import { ThemeToggle } from "@/components/ui";

const actionLinkStyles =
  "inline-flex h-11 min-w-36 items-center justify-center rounded-md border border-border-muted bg-surface-raised px-5 text-body-sm font-medium text-text-primary transition-colors hover:border-border-prominent hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const disabledButtonStyles =
  "inline-flex h-11 min-w-36 cursor-not-allowed items-center justify-center rounded-md border border-border-subtle bg-surface-elevated px-5 text-body-sm font-medium text-text-muted opacity-70";

export function LandingPage() {
  return (
    <main className="relative flex min-h-screen-safe items-center justify-center bg-surface px-6 py-16 text-text-primary">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-[32rem] flex-col items-stretch justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
        <Link href="/login" className={actionLinkStyles}>
          Sign In
        </Link>
        <Link href="/waitlist" className={actionLinkStyles}>
          Request Access
        </Link>
        <button type="button" className={disabledButtonStyles} disabled>
          About
        </button>
      </div>
    </main>
  );
}
