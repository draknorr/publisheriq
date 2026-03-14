'use client';

import { type RefObject } from 'react';
import { motion } from 'framer-motion';
import { LANDING_COLORS, VARIANTS } from './config/animations';
import {
  CHART_DATA,
  COMPARISON_DATA,
  SENTIMENT_DATA,
  SENTIMENT_TAGS,
  MOMENTUM_GAMES,
} from './config/content';

interface LogoState {
  id: string;
  color: string;
  size: number;
  glowIntensity: number;
  disabled: boolean;
}

interface ChatDemoProps {
  logoContainerRef: RefObject<HTMLDivElement | null>;
  chatBoxRef: RefObject<HTMLDivElement | null>;
  typedText: string;
  isTyping: boolean;
  showViz: boolean[];
}

const INITIAL_LOGOS: LogoState[] = [
  { id: 'twitch', color: '#9146ff', size: 38, glowIntensity: 1, disabled: false },
  { id: 'steam', color: '#66c0f4', size: 42, glowIntensity: 1, disabled: false },
  { id: 'epic', color: '#ffffff', size: 38, glowIntensity: 1, disabled: false },
  { id: 'youtube', color: '#ff0000', size: 38, glowIntensity: 1, disabled: false },
];

const LOGO_FLOAT_DELAYS = [0, 0.4, 0.8, 1.2];
const LOGO_GLOW_DELAYS = [0, 0.6, 1.2, 1.8];

function DataSourceLogos({
  logoContainerRef,
}: {
  logoContainerRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={logoContainerRef}
      className="relative z-10 mx-auto mb-5 flex w-full max-w-[800px] items-center justify-center"
      style={{ gap: 'clamp(2rem, 8vw, 5rem)' }}
    >
      {INITIAL_LOGOS.map((logo, index) => (
        <div
          key={logo.id}
          className="flex items-center justify-center rounded-full"
          style={{
            width: logo.size,
            height: logo.size,
            background: 'rgba(18, 18, 24, 0.95)',
            border: `1.5px solid ${logo.disabled ? 'rgba(128,128,128,0.3)' : `${logo.color}80`}`,
            boxShadow: logo.disabled
              ? 'none'
              : `0 0 20px ${logo.color}40, 0 0 40px ${logo.color}20`,
            opacity: logo.disabled ? 0.4 : 1,
            animation: `landing-logo-float 3s ease-in-out ${LOGO_FLOAT_DELAYS[index]}s infinite, landing-logo-glow 4s ease-in-out ${LOGO_GLOW_DELAYS[index]}s infinite`,
          }}
        >
          <LogoIcon id={logo.id} size={logo.size} color={logo.disabled ? '#888' : logo.color} />
        </div>
      ))}
    </div>
  );
}

function LogoIcon({ id, size, color }: { id: string; size: number; color: string }) {
  const iconSize = size * 0.5;
  switch (id) {
    case 'twitch':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={color}>
          <path d="M2.149 0L.537 4.119v16.836h5.731V24h3.224l3.045-3.045h4.657l6.269-6.269V0H2.149zm19.164 13.612l-3.582 3.582H12l-3.045 3.045v-3.045H4.119V2.149h17.194v11.463zm-3.582-7.343v6.262h-2.149V6.269h2.149zm-5.731 0v6.262H9.851V6.269H12z" />
        </svg>
      );
    case 'steam':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill={color}>
          <path d="M.329 10.333A8.01 8.01 0 0 0 7.99 16C12.414 16 16 12.418 16 8s-3.586-8-8.009-8A8.006 8.006 0 0 0 0 7.468l.003.006 4.304 1.769A2.2 2.2 0 0 1 5.62 8.88l1.96-2.844-.001-.04a3.046 3.046 0 0 1 3.042-3.043 3.046 3.046 0 0 1 3.042 3.043 3.047 3.047 0 0 1-3.111 3.044l-2.804 2a2.223 2.223 0 0 1-3.075 2.11 2.22 2.22 0 0 1-1.312-1.568L.33 10.333Z" />
          <path d="M4.868 12.683a1.715 1.715 0 0 0 1.318-3.165 1.7 1.7 0 0 0-1.263-.02l1.023.424a1.261 1.261 0 1 1-.97 2.33l-.99-.41a1.7 1.7 0 0 0 .882.84Zm3.726-6.687a2.03 2.03 0 0 0 2.027 2.029 2.03 2.03 0 0 0 2.027-2.029 2.03 2.03 0 0 0-2.027-2.027 2.03 2.03 0 0 0-2.027 2.027m2.03-1.527a1.524 1.524 0 1 1-.002 3.048 1.524 1.524 0 0 1 .002-3.048" />
        </svg>
      );
    case 'epic':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={color}>
          <path d="M3.537 0C2.165 0 1.66.506 1.66 1.879v18.121c0 .15.006.263.02.433.031.3.037.59.316.92.027.033.311.245.311.245.153.075.258.13.43.2l8.335 3.491c.433.199.614.276.928.27h.002c.314.006.495-.071.928-.27l8.335-3.492c.172-.07.277-.124.43-.2 0 0 .284-.211.311-.243.28-.33.285-.621.316-.92.014-.17.02-.283.02-.434V1.879C22.34.506 21.834 0 20.463 0H3.537zm13.366 3.11h.68c1.138 0 1.688.553 1.688 1.696v1.88h-1.374v-1.8c0-.369-.17-.54-.523-.54h-.235c-.367 0-.537.17-.537.539v5.81c0 .369.17.54.537.54h.262c.353 0 .523-.171.523-.54V8.619h1.373v2.143c0 1.144-.562 1.71-1.7 1.71h-.694c-1.138 0-1.7-.566-1.7-1.71V4.82c0-1.144.562-1.709 1.7-1.709zm-12.186.08h3.114v1.274H6.117v2.603h1.648v1.275H6.117v2.774h1.74v1.275h-3.14V3.19zm3.816 0h2.198c1.138 0 1.7.564 1.7 1.708v2.445c0 1.144-.562 1.71-1.7 1.71h-.799v3.338h-1.4V3.19zm4.53 0h1.4v9.201h-1.4V3.19zm-3.13 1.235v3.392h.575c.354 0 .523-.171.523-.54V4.965c0-.368-.17-.54-.523-.54h-.575z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill={color}>
          <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z" />
        </svg>
      );
    default:
      return null;
  }
}

function ChatTerminal({
  chatBoxRef,
  typedText,
  isTyping,
}: {
  chatBoxRef: RefObject<HTMLDivElement | null>;
  typedText: string;
  isTyping: boolean;
}) {
  return (
    <div ref={chatBoxRef} className="mx-auto mb-6 w-full max-w-[800px] px-2">
      <div
        className="rounded-xl backdrop-blur-xl font-mono"
        style={{
          background: LANDING_COLORS.cardBgSolid,
          border: `1px solid ${LANDING_COLORS.borderSubtle}`,
          padding: 'clamp(1rem, 3vw, 1.5rem)',
          boxShadow: `0 0 0 1px rgba(0, 255, 163, 0.1), 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(0, 255, 163, 0.05)`,
        }}
      >
        {/* Window dots */}
        <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-3">
          <div className="h-2 w-2 rounded-full" style={{ background: '#ff5f56' }} />
          <div className="h-2 w-2 rounded-full" style={{ background: '#ffbd2e' }} />
          <div className="h-2 w-2 rounded-full" style={{ background: '#27ca3f' }} />
          <span
            className="ml-auto text-xs uppercase tracking-widest"
            style={{ color: LANDING_COLORS.textDim }}
          >
            Gaming Intelligence Platform
          </span>
        </div>

        {/* Prompt */}
        <div className="flex items-start gap-3">
          <span
            className="text-lg font-medium opacity-80 sm:text-xl"
            style={{ color: LANDING_COLORS.neonGreen }}
          >
            &rsaquo;
          </span>
          <div className="min-h-[2rem] flex-1">
            <span
              className="break-words text-white"
              style={{ fontSize: 'clamp(0.875rem, 3vw, 1.125rem)', lineHeight: 1.6 }}
            >
              {typedText}
            </span>
            <span
              className="landing-cursor-blink ml-0.5 inline-block align-middle"
              style={{
                width: '2px',
                height: '1.25rem',
                background: LANDING_COLORS.neonGreen,
                animation: 'landingBlink 1s step-end infinite',
                opacity: isTyping ? 1 : 0.5,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ VIZ CARDS ============

function PlayerCountCard({ visible }: { visible: boolean }) {
  return (
    <motion.div
      variants={VARIANTS.scaleIn}
      initial="hidden"
      animate={visible ? 'visible' : 'hidden'}
      className="relative rounded-xl backdrop-blur-md"
      style={{
        background: LANDING_COLORS.cardBg,
        border: `1px solid ${LANDING_COLORS.borderGreen}`,
        padding: 'clamp(0.875rem, 2vw, 1.25rem)',
      }}
    >
      <div className="mb-3 text-[0.75rem] uppercase tracking-widest" style={{ color: LANDING_COLORS.textMuted }}>
        Player Count
      </div>
      <div className="mb-2 text-[1.75rem] font-semibold" style={{ color: LANDING_COLORS.neonGreen }}>
        847K
      </div>
      <svg width="100%" height="50" viewBox="0 0 100 50" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ffa3" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00ffa3" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M0,${50 - CHART_DATA[0] / 2} ${CHART_DATA.map((v, i) => `L${i * 11},${50 - v / 2}`).join(' ')} L99,50 L0,50 Z`}
          fill="url(#chartGrad)"
          style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease-out 0.2s' }}
        />
        <path
          d={`M0,${50 - CHART_DATA[0] / 2} ${CHART_DATA.map((v, i) => `L${i * 11},${50 - v / 2}`).join(' ')}`}
          fill="none"
          stroke="#00ffa3"
          strokeWidth="2"
          style={{
            strokeDasharray: 200,
            strokeDashoffset: visible ? 0 : 200,
            transition: 'stroke-dashoffset 1.05s ease-out',
          }}
        />
      </svg>
    </motion.div>
  );
}

function RankingsCard({ visible }: { visible: boolean }) {
  return (
    <motion.div
      variants={VARIANTS.scaleIn}
      initial="hidden"
      animate={visible ? 'visible' : 'hidden'}
      transition={{ delay: 0.07 }}
      className="relative rounded-xl backdrop-blur-md"
      style={{
        background: LANDING_COLORS.cardBg,
        border: `1px solid ${LANDING_COLORS.borderBlue}`,
        padding: 'clamp(0.875rem, 2vw, 1.25rem)',
      }}
    >
      <div className="mb-3 text-[0.75rem] uppercase tracking-widest" style={{ color: LANDING_COLORS.textMuted }}>
        Roguelike Rankings
      </div>
      {COMPARISON_DATA.map((item, i) => (
        <div key={item.name} className="mb-2">
          <div className="mb-1 flex justify-between">
            <span className="text-[0.75rem]" style={{ color: LANDING_COLORS.textSecondary }}>
              {item.name}
            </span>
            <span className="text-[0.75rem] font-semibold" style={{ color: item.color }}>
              {item.value}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-sm" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div
              className="h-full rounded-sm"
              style={{
                width: visible ? `${item.value}%` : '0%',
                background: item.color,
                transition: `width 0.7s ease-out ${0.14 + i * 0.1}s`,
              }}
            />
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function SentimentCard({ visible }: { visible: boolean }) {
  return (
    <motion.div
      variants={VARIANTS.scaleIn}
      initial="hidden"
      animate={visible ? 'visible' : 'hidden'}
      transition={{ delay: 0.14 }}
      className="relative rounded-xl backdrop-blur-md"
      style={{
        background: LANDING_COLORS.cardBg,
        border: `1px solid ${LANDING_COLORS.borderPurple}`,
        padding: 'clamp(0.875rem, 2vw, 1.25rem)',
      }}
    >
      <div className="mb-3 text-[0.75rem] uppercase tracking-widest" style={{ color: LANDING_COLORS.textMuted }}>
        Sentiment Trend
      </div>
      <div className="mb-2 flex gap-4">
        <span className="text-xl font-semibold" style={{ color: '#22c55e' }}>91%</span>
        <span className="self-end text-sm opacity-70" style={{ color: '#ef4444' }}>9%</span>
      </div>
      <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
        <path
          d={`M0,${40 - SENTIMENT_DATA[0].pos * 0.35} ${SENTIMENT_DATA.map((d, i) => `L${i * 16.6},${40 - d.pos * 0.35}`).join(' ')}`}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          style={{
            strokeDasharray: 150,
            strokeDashoffset: visible ? 0 : 150,
            transition: 'stroke-dashoffset 1.05s ease-out',
          }}
        />
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        {SENTIMENT_TAGS.map((tag, i) => (
          <span
            key={tag}
            className="rounded px-2 py-0.5 text-[0.7rem]"
            style={{
              background: 'rgba(168, 85, 247, 0.2)',
              color: '#a855f7',
              opacity: visible ? 1 : 0,
              transition: `opacity 0.35s ease-out ${0.56 + i * 0.07}s`,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function MomentumCard({ visible }: { visible: boolean }) {
  return (
    <motion.div
      variants={VARIANTS.scaleIn}
      initial="hidden"
      animate={visible ? 'visible' : 'hidden'}
      transition={{ delay: 0.21 }}
      className="relative rounded-xl backdrop-blur-md"
      style={{
        background: LANDING_COLORS.cardBg,
        border: `1px solid ${LANDING_COLORS.borderPink}`,
        padding: 'clamp(0.875rem, 2vw, 1.25rem)',
      }}
    >
      <div className="mb-3 text-[0.75rem] uppercase tracking-widest" style={{ color: LANDING_COLORS.textMuted }}>
        Similar Momentum
      </div>
      {MOMENTUM_GAMES.map((game, i) => (
        <div
          key={game}
          className="flex items-center gap-2 py-1.5"
          style={{
            borderBottom: i < MOMENTUM_GAMES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : 'translateX(-10px)',
            transition: `all 0.35s ease-out ${0.35 + i * 0.1}s`,
          }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: LANDING_COLORS.neonPink,
              boxShadow: '0 0 8px rgba(255, 107, 157, 0.5)',
            }}
          />
          <span className="text-[0.75rem]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {game}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            className="ml-auto"
          >
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </div>
      ))}
    </motion.div>
  );
}

export function ChatDemo({
  logoContainerRef,
  chatBoxRef,
  typedText,
  isTyping,
  showViz,
}: ChatDemoProps) {
  return (
    <div className="relative z-[6] flex flex-col items-center px-4">
      <DataSourceLogos logoContainerRef={logoContainerRef} />

      <ChatTerminal chatBoxRef={chatBoxRef} typedText={typedText} isTyping={isTyping} />

      {/* Viz cards */}
      <div className="grid w-full max-w-[1000px] grid-cols-2 gap-3 px-2 md:grid-cols-4 md:gap-4 md:px-4">
        <PlayerCountCard visible={showViz[0]} />
        <RankingsCard visible={showViz[1]} />
        <SentimentCard visible={showViz[2]} />
        <MomentumCard visible={showViz[3]} />
      </div>
    </div>
  );
}
