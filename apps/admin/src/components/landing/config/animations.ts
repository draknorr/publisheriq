// Central animation configuration - tweak values here, see results everywhere

// ============ TIMING ============
export const TIMING = {
  banner: {
    typeSpeed: 25,
    deleteSpeed: 18,
    holdDuration: 1000,
    anythingHoldBeforeLogo: 600,
    logoDisplayDuration: 1800,
    logoRevealDuration: 700,
    logoHideDuration: 600,
    scrollStep: 0.12,
    particleFadeInterval: 25,
    particleLifetime: 1200,
    particleDecay: 0.015,
  },
  chat: {
    typingDuration: 1400,
    vizDelay: 350,
    vizDuration: 2100,
    pauseBetween: 700,
    resetPause: 1400,
    fadeOutPause: 700,
    restartPause: 500,
  },
  canvas: {
    starCount: 150,
    starCountMobile: 80,
    emitIntervalMultiplierTyping: 0.6,
    particleCountTyping: 2,
    particleCountIdle: 1,
  },
  logoFloat: {
    interval: 50,
    amplitude: 6,
  },
} as const;

// ============ EASING ============
export const EASING = {
  spring: [0.16, 1, 0.3, 1] as [number, number, number, number],
  smooth: [0.4, 0, 0.2, 1] as [number, number, number, number],
  decel: [0, 0, 0.2, 1] as [number, number, number, number],
  accel: [0.4, 0, 1, 1] as [number, number, number, number],
};

// ============ FRAMER MOTION VARIANTS ============
export const VARIANTS = {
  fadeInUp: {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: EASING.decel },
    },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, ease: EASING.smooth },
    },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.56, ease: EASING.spring },
    },
  },
  staggerContainer: {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.1 },
    },
  },
  staggerContainerFast: {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.07 },
    },
  },
  slideInLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: EASING.decel },
    },
  },
  countUp: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: EASING.decel },
    },
  },
  fadeInRight: {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: EASING.decel },
    },
  },
  scaleInSubtle: {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, ease: EASING.smooth },
    },
  },
} as const;

// ============ COLORS ============
export const LANDING_COLORS = {
  bg: '#08090c',
  bgGradient: 'linear-gradient(180deg, #08090c 0%, #0a0a0f 30%, #0d1117 60%, #0a0f14 100%)',
  neonGreen: '#00ffa3',
  neonBlue: '#00b4ff',
  neonPurple: '#a855f7',
  neonPink: '#ff6b9d',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textDim: 'rgba(255, 255, 255, 0.5)',
  cardBg: 'rgba(13, 17, 23, 0.6)',
  cardBgSolid: 'rgba(13, 17, 23, 0.8)',
  borderSubtle: 'rgba(255, 255, 255, 0.1)',
  borderGreen: 'rgba(0, 255, 163, 0.2)',
  borderBlue: 'rgba(0, 180, 255, 0.2)',
  borderPurple: 'rgba(168, 85, 247, 0.2)',
  borderPink: 'rgba(255, 107, 157, 0.2)',
} as const;

// ============ GLASS TIERS ============
export const GLASS_TIERS = {
  subtle: { blur: 'blur(4px)', bg: 'rgba(13,17,23,0.4)', border: 'rgba(255,255,255,0.06)' },
  medium: { blur: 'blur(12px)', bg: 'rgba(13,17,23,0.6)', border: 'rgba(255,255,255,0.08)' },
  heavy: { blur: 'blur(24px)', bg: 'rgba(13,17,23,0.8)', border: 'rgba(255,255,255,0.1)' },
} as const;

// ============ DATA SOURCE CONFIG ============
export const DATA_SOURCES = [
  {
    id: 'twitch' as const,
    color: '#9146ff',
    glowColor: 'rgba(145, 70, 255, 0.5)',
    x: 0.22,
    y: 0.36,
    floatOffset: 0,
    floatSpeedX: 0.5,
    floatSpeedY: 0.4,
    floatAmplitudeX: 12,
    floatAmplitudeY: 8,
    floatDirectionX: -1,
    emitInterval: 800,
    baseSize: 38,
  },
  {
    id: 'steam' as const,
    color: '#66c0f4',
    glowColor: 'rgba(102, 192, 244, 0.5)',
    x: 0.40,
    y: 0.34,
    floatOffset: Math.PI / 2,
    floatSpeedX: 0.4,
    floatSpeedY: 0.46,
    floatAmplitudeX: 10,
    floatAmplitudeY: 8,
    floatDirectionX: -1,
    emitInterval: 700,
    baseSize: 42,
  },
  {
    id: 'epic' as const,
    color: '#ffffff',
    glowColor: 'rgba(255, 255, 255, 0.4)',
    x: 0.60,
    y: 0.34,
    floatOffset: Math.PI,
    floatSpeedX: 0.44,
    floatSpeedY: 0.36,
    floatAmplitudeX: 10,
    floatAmplitudeY: 8,
    floatDirectionX: 1,
    emitInterval: 900,
    baseSize: 38,
  },
  {
    id: 'youtube' as const,
    color: '#ff0000',
    glowColor: 'rgba(255, 0, 0, 0.5)',
    x: 0.78,
    y: 0.36,
    floatOffset: Math.PI * 1.5,
    floatSpeedX: 0.46,
    floatSpeedY: 0.42,
    floatAmplitudeX: 12,
    floatAmplitudeY: 8,
    floatDirectionX: 1,
    emitInterval: 850,
    baseSize: 38,
  },
] as const;

export type DataSourceId = (typeof DATA_SOURCES)[number]['id'];
