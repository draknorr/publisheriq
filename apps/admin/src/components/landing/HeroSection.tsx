import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui";
import {
  HERO_LOOP,
  HERO_SIGNAL_TILES,
  LANDING_AUDIENCES,
  LANDING_JOBS,
} from "./config/content";

const primaryLinkStyles =
  "landing-button inline-flex items-center justify-center gap-2 rounded-md bg-accent-primary px-5 py-3 text-body font-medium text-white shadow-subtle transition-all duration-150 hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const secondaryLinkStyles =
  "landing-button inline-flex items-center justify-center rounded-md border border-border-muted bg-surface-raised px-5 py-3 text-body text-text-primary transition-colors duration-150 hover:border-border-prominent hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function HeroSection() {
  return (
    <section className="px-4 pb-14 pt-14 sm:px-6 sm:pb-16 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">Invite-only beta</Badge>
            <Badge variant="default">Deepest on Steam today</Badge>
          </div>

          <h1 className="mt-6 max-w-4xl text-display-lg text-text-primary sm:text-[4.25rem]">
            The most advanced market-intelligence workflow in games.
          </h1>

          <p className="mt-5 max-w-3xl text-body-lg text-text-secondary">
            Track launch timing, pricing, store changes, company moves, and
            market signals in one system. Ask questions in plain English,
            compare the titles and companies behind the move, and open the
            supporting evidence fast. Other teams still do this across
            dashboards, spreadsheets, and point tools. PublisherIQ does it in
            one workflow.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {LANDING_AUDIENCES.map((audience) => (
              <Badge key={audience} variant="default">
                {audience}
              </Badge>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/waitlist" className={`${primaryLinkStyles} group`}>
              <span>Request beta access</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link href="/login" className={secondaryLinkStyles}>
              <span>Sign in</span>
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-10 border-t border-border-subtle pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-caption uppercase tracking-[0.16em] text-text-tertiary">
              What it does
            </p>
            <div className="mt-5 space-y-5">
              {LANDING_JOBS.map((job) => (
                <div key={job.title} className="border-b border-border-subtle pb-5 last:border-b-0 last:pb-0">
                  <p className="text-caption uppercase tracking-[0.16em] text-text-tertiary">
                    {job.title}
                  </p>
                  <p className="mt-2 text-body text-text-secondary">
                    {job.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-caption uppercase tracking-[0.16em] text-text-tertiary">
              How the workflow works
            </p>
            <div className="mt-5 space-y-5">
              {HERO_LOOP.map((item) => (
                <div key={item.step} className="grid grid-cols-[auto_1fr] gap-4 border-b border-border-subtle pb-5 last:border-b-0 last:pb-0">
                  <span className="font-data text-caption text-accent-primary">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-body font-medium text-text-primary">
                      {item.title}
                    </p>
                    <p className="mt-2 text-body-sm text-text-secondary">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 border-t border-border-subtle pt-10 sm:grid-cols-2 xl:grid-cols-4">
          {HERO_SIGNAL_TILES.map((tile) => (
            <div key={tile.label}>
              <p className="font-data text-display-sm text-text-primary">
                {tile.value}
              </p>
              <p className="mt-2 text-body-sm text-text-secondary">
                {tile.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
