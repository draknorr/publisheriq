'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { VARIANTS, LANDING_COLORS } from './config/animations';

export function WaitlistCTA() {
  return (
    <section className="relative z-10 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        {/* Glow background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, rgba(0, 255, 163, 0.06) 0%, transparent 60%)`,
          }}
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={VARIANTS.fadeInUp}
          className="relative"
        >
          <h2
            className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
            style={{ letterSpacing: '-0.03em' }}
          >
            Stop guessing. Start knowing.
          </h2>
          <p
            className="mx-auto mb-10 max-w-xl text-base sm:text-lg"
            style={{ color: LANDING_COLORS.textSecondary }}
          >
            Get early access to AI-powered gaming intelligence. Free during beta.
          </p>
          <Link
            href="/waitlist"
            className="landing-cta-glow inline-block rounded-xl px-8 py-4 text-base font-semibold transition-all hover:-translate-y-0.5 sm:text-lg"
            style={{
              background: `linear-gradient(135deg, ${LANDING_COLORS.neonGreen} 0%, ${LANDING_COLORS.neonBlue} 100%)`,
              color: '#0a0a0f',
              boxShadow: `0 0 30px rgba(0, 255, 163, 0.3), 0 0 60px rgba(0, 255, 163, 0.1)`,
            }}
          >
            Get Early Access
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
