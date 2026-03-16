import { FEATURES } from "./config/content";

export function FeaturesSection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl border-t border-border-subtle pt-10">
        <div className="max-w-2xl">
          <p className="text-caption uppercase tracking-[0.16em] text-text-tertiary">
            Why serious teams switch
          </p>
          <h2 className="mt-3 text-display-sm text-text-primary">
            Other platforms show you fragments. PublisherIQ gives you the full
            operating loop.
          </h2>
          <p className="mt-4 text-body-lg text-text-secondary">
            Monitor the move, investigate what changed, benchmark the companies
            behind it, and open the proof without leaving the workflow.
          </p>
        </div>

        <div className="mt-8 border-t border-border-subtle">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="grid gap-4 border-b border-border-subtle py-6 lg:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <p className="text-caption uppercase tracking-[0.16em] text-text-tertiary">
                {feature.eyebrow}
              </p>
              <div>
                <h3 className="text-heading-sm text-text-primary">
                  {feature.title}
                </h3>
                <p className="mt-3 text-body-sm text-text-secondary">
                  {feature.description}
                </p>
              </div>
              <ul className="space-y-2">
                {feature.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2 text-body-sm text-text-secondary"
                  >
                    <span className="mt-[0.45rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
