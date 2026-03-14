'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { VARIANTS, LANDING_COLORS } from './config/animations';
import { STATS } from './config/content';

function AnimatedNumber({ value, inView }: { value: string; inView: boolean }) {
  const [displayed, setDisplayed] = useState('0');
  const numericPart = value.replace(/[^0-9]/g, '');
  const suffix = value.replace(/[0-9]/g, '');

  useEffect(() => {
    if (!inView) return;

    const target = parseInt(numericPart, 10);
    const duration = 1500;
    const steps = 40;
    const stepTime = duration / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(target * eased);

      if (target >= 1000) {
        setDisplayed(`${Math.round(current / 1000)}K`);
      } else {
        setDisplayed(String(current));
      }

      if (step >= steps) {
        clearInterval(interval);
        // Restore original formatted value
        setDisplayed(value.replace(suffix, ''));
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, [inView, numericPart, value, suffix]);

  return (
    <span>
      {displayed}
      {suffix}
    </span>
  );
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="relative z-10 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <motion.div
          ref={ref}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={VARIANTS.staggerContainerFast}
          className="grid grid-cols-2 gap-8 md:grid-cols-4"
        >
          {STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={VARIANTS.countUp}
              className="text-center"
            >
              <div
                className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
                style={{ color: LANDING_COLORS.neonGreen, letterSpacing: '-0.03em' }}
              >
                <AnimatedNumber value={stat.value} inView={inView} />
              </div>
              <div className="text-xs uppercase tracking-widest sm:text-sm" style={{ color: LANDING_COLORS.textMuted }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
