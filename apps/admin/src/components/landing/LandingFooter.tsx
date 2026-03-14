'use client';

import { LANDING_COLORS } from './config/animations';
import { FOOTER_LINKS } from './config/content';

export function LandingFooter() {
  return (
    <footer className="relative z-10 border-t px-4 py-8 sm:px-6" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: LANDING_COLORS.neonGreen }} />
          <p className="text-xs" style={{ color: LANDING_COLORS.textMuted }}>
            Made by{' '}
            <a
              href={FOOTER_LINKS.author.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 transition-colors hover:text-white"
            >
              {FOOTER_LINKS.author.name}
            </a>
          </p>
        </div>
        <p className="text-xs" style={{ color: LANDING_COLORS.textMuted }}>
          PublisherIQ
        </p>
      </div>
    </footer>
  );
}
