import Link from "next/link";
import { Badge } from "@/components/ui";
import { CTA_BULLETS } from "./config/content";

const primaryLinkStyles =
  "landing-button inline-flex items-center justify-center rounded-md bg-accent-primary px-5 py-3 text-body font-medium text-white shadow-subtle transition-all duration-150 hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const secondaryLinkStyles =
  "landing-button inline-flex items-center justify-center rounded-md border border-border-muted bg-surface-raised px-5 py-3 text-body text-text-primary transition-colors duration-150 hover:border-border-prominent hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function WaitlistCTA() {
  return (
    <section className="px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="mx-auto max-w-6xl border-t border-border-subtle pt-10">
        <Badge variant="primary">Invite-only beta</Badge>
        <h2 className="mt-4 max-w-3xl text-display-sm text-text-primary">
          Get access to the category leader.
        </h2>
        <p className="mt-4 max-w-3xl text-body-lg text-text-secondary">
          Tell us what you need to track: launches, pricing, competitor moves,
          diligence, or portfolio strategy. We are prioritizing teams that need
          serious monitoring, benchmarking, and evidence-backed research now.
        </p>

        <ul className="mt-8 max-w-3xl space-y-3">
          {CTA_BULLETS.map((bullet) => (
            <li
              key={bullet}
              className="flex gap-2 text-body-sm text-text-secondary"
            >
              <span className="mt-[0.45rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-primary" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/waitlist" className={`${primaryLinkStyles} group`}>
            <span>Request beta access</span>
          </Link>
          <Link href="/login" className={secondaryLinkStyles}>
            <span>Already approved? Sign in</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
