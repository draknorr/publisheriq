'use client';

import { motion } from 'framer-motion';
import {
  MessageSquareText,
  BarChart3,
  GitCompareArrows,
  TrendingUp,
} from 'lucide-react';
import { VARIANTS, LANDING_COLORS, GLASS_TIERS } from './config/animations';
import { FEATURES } from './config/content';

const ICON_MAP = {
  MessageSquareText,
  BarChart3,
  GitCompareArrows,
  TrendingUp,
} as const;

export function FeaturesSection() {
  return (
    <section className="relative z-10 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={VARIANTS.fadeInUp}
          className="mb-16 text-center"
        >
          <h2
            className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl"
            style={{ letterSpacing: '-0.03em' }}
          >
            Ask a question. Get the answer. With real data.
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg" style={{ color: LANDING_COLORS.textSecondary }}>
            From real-time player counts to market analysis — powered by AI.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={VARIANTS.staggerContainer}
        >
          {/* Hero feature card - AI Chat */}
          <motion.div variants={VARIANTS.fadeInUp}>
            {(() => {
              const feature = FEATURES[0];
              const Icon = ICON_MAP[feature.icon];
              return (
                <motion.div
                  className="group mb-6 rounded-xl border p-8"
                  style={{
                    background: GLASS_TIERS.medium.bg,
                    borderColor: GLASS_TIERS.medium.border,
                    backdropFilter: GLASS_TIERS.medium.blur,
                    boxShadow: `0 0 40px ${feature.accent}10`,
                  }}
                  whileHover={{
                    borderColor: `${feature.accent}40`,
                    boxShadow: `0 0 30px ${feature.accent}15`,
                    transition: { duration: 0.2 },
                  }}
                >
                  <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
                    <div
                      className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                      style={{ background: `${feature.accent}15` }}
                    >
                      <Icon size={28} style={{ color: feature.accent }} />
                    </div>
                    <div>
                      <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                      <p className="text-sm leading-relaxed sm:text-base" style={{ color: LANDING_COLORS.textSecondary }}>
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </motion.div>

          {/* Remaining 3 feature cards */}
          <motion.div
            variants={VARIANTS.staggerContainer}
            className="grid gap-4 sm:grid-cols-3"
          >
            {FEATURES.slice(1).map((feature) => {
              const Icon = ICON_MAP[feature.icon];
              return (
                <motion.div
                  key={feature.title}
                  variants={VARIANTS.fadeInUp}
                  className="group rounded-xl border p-6 transition-colors"
                  style={{
                    background: GLASS_TIERS.subtle.bg,
                    borderColor: GLASS_TIERS.subtle.border,
                    backdropFilter: GLASS_TIERS.subtle.blur,
                  }}
                  whileHover={{
                    borderColor: `${feature.accent}40`,
                    boxShadow: `0 0 30px ${feature.accent}15`,
                    transition: { duration: 0.2 },
                  }}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${feature.accent}15` }}
                  >
                    <Icon size={20} style={{ color: feature.accent }} />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: LANDING_COLORS.textSecondary }}>
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
