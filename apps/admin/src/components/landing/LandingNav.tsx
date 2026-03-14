'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { LANDING_COLORS } from './config/animations';

export function LandingNav() {
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 100], [0, 0.8]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 0.1]);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 px-4 py-3 sm:px-6"
      aria-label="Main navigation"
      style={{
        backgroundColor: useTransform(bgOpacity, (v) => `rgba(8, 9, 12, ${v})`),
        borderBottom: useTransform(borderOpacity, (v) => `1px solid rgba(255,255,255,${v})`),
        backdropFilter: 'blur(12px)',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
            style={{ background: `linear-gradient(135deg, ${LANDING_COLORS.neonGreen} 0%, ${LANDING_COLORS.neonBlue} 100%)` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-base font-semibold tracking-tight text-white sm:text-lg" style={{ letterSpacing: '-0.02em' }}>
            PublisherIQ
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/waitlist"
            className="landing-cta-glow rounded-lg px-4 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${LANDING_COLORS.neonGreen} 0%, ${LANDING_COLORS.neonBlue} 100%)`,
              color: '#0a0a0f',
              boxShadow: `0 0 20px rgba(0, 255, 163, 0.3)`,
            }}
          >
            Join Waitlist
          </Link>
          <Link
            href="/login"
            className="hidden rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/15 sm:block"
          >
            Sign In
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
