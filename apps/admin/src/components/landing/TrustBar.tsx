'use client';

import { motion } from 'framer-motion';
import { VARIANTS, LANDING_COLORS } from './config/animations';

const TRUST_ITEMS = [
  { value: '200K+', label: 'Games' },
  { value: '15M+', label: 'Data Points' },
  { value: '4', label: 'Data Sources' },
  { value: '15min', label: 'Update Cycle' },
];

export function TrustBar() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={VARIANTS.fadeIn}
      className="relative z-10 px-4 py-8 sm:py-12"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 sm:gap-10">
        {TRUST_ITEMS.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2">
            {i > 0 && (
              <div className="mr-4 hidden h-4 w-px sm:block" style={{ background: 'rgba(255,255,255,0.1)' }} />
            )}
            <span className="font-mono text-sm font-semibold text-white sm:text-base" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {item.value}
            </span>
            <span className="text-xs sm:text-sm" style={{ color: LANDING_COLORS.textMuted }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
