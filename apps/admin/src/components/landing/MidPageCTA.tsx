'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { VARIANTS, LANDING_COLORS } from './config/animations';

export function MidPageCTA() {
  return (
    <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(0, 255, 163, 0.04) 0%, transparent 60%)',
          }}
        />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={VARIANTS.fadeInUp}
          className="relative"
        >
          <h3
            className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-3xl"
            style={{ letterSpacing: '-0.03em' }}
          >
            Ready to try it?
          </h3>
          <p
            className="mx-auto mb-8 max-w-lg text-sm sm:text-base"
            style={{ color: LANDING_COLORS.textSecondary }}
          >
            See your games&apos; data come to life with AI-powered analytics.
          </p>
          <Link
            href="/waitlist"
            className="landing-cta-glow inline-block rounded-lg px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 sm:text-base"
            style={{
              background: `linear-gradient(135deg, ${LANDING_COLORS.neonGreen} 0%, ${LANDING_COLORS.neonBlue} 100%)`,
              color: '#0a0a0f',
              boxShadow: '0 0 20px rgba(0, 255, 163, 0.2)',
            }}
          >
            Get Early Access
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
