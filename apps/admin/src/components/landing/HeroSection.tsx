'use client';

import type { BannerPhase, LogoPhase } from '@/hooks/landing/useBannerAnimation';
import type { BANNER_PHRASES } from './config/content';
import { LANDING_COLORS } from './config/animations';

interface HeroSectionProps {
  objectText: string;
  bannerPhase: BannerPhase;
  scrollOffset: number;
  logoPhase: LogoPhase;
  current: (typeof BANNER_PHRASES)[number];
  prevPhrase: (typeof BANNER_PHRASES)[number];
  nextPhrase: (typeof BANNER_PHRASES)[number];
  isAnything: boolean;
}

export function HeroSection({
  objectText,
  bannerPhase,
  scrollOffset,
  logoPhase,
  current,
  prevPhrase,
  nextPhrase,
  isAnything,
}: HeroSectionProps) {
  const hasAction = current.action !== null;
  const showBannerText = logoPhase === 'hidden';
  const showLogo = logoPhase !== 'hidden';
  const logoJoined = logoPhase === 'visible';
  const logoSplit = logoPhase === 'hiding';

  return (
    <div className="relative z-[6]" style={{ height: 'clamp(200px, 35vh, 320px)' }}>
      <div className="flex h-full items-center justify-center">
        <div className="p-4 text-center">
          {/* Action word - Dropdown scroll */}
          <div
            className="relative overflow-hidden"
            style={{
              height: 'clamp(1.8rem, 4vh, 2.5rem)',
              marginBottom: 'clamp(0.15rem, 0.5vh, 0.3rem)',
              maskImage:
                'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
              opacity: hasAction && logoPhase === 'hidden' ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          >
            {/* Brackets */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center opacity-[0.12]" style={{ gap: 'clamp(60px, 12vw, 140px)' }}>
              <span className="text-white" style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)' }}>[</span>
              <span className="text-white" style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)' }}>]</span>
            </div>

            <div
              className="relative flex h-full flex-col items-center justify-center"
              style={{ transform: `translateY(${scrollOffset * 100}%)` }}
            >
              <div
                className="absolute scale-90"
                style={{
                  top: '-100%',
                  fontSize: 'clamp(1.2rem, 3vw, 2rem)',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.35)',
                }}
              >
                {prevPhrase.action || ''}
              </div>

              <div
                style={{
                  fontSize: 'clamp(1.2rem, 3vw, 2rem)',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.6)',
                  letterSpacing: '0.02em',
                }}
              >
                {current.action || ''}
              </div>

              <div
                className="absolute scale-90"
                style={{
                  top: '100%',
                  fontSize: 'clamp(1.2rem, 3vw, 2rem)',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.35)',
                }}
              >
                {nextPhrase.action || ''}
              </div>
            </div>
          </div>

          {/* Main typed content */}
          <div
            className="relative flex items-center justify-center"
            style={{ minHeight: 'clamp(3.5rem, 12vw, 7rem)' }}
            aria-live="polite"
          >
            {(showBannerText || logoPhase === 'revealing') && (
              <div
                className="flex items-center justify-center"
                style={{
                  opacity: logoPhase === 'revealing' ? 0 : 1,
                  transition: 'opacity 0.5s ease',
                }}
              >
                <span
                  style={{
                    fontSize: 'clamp(2.5rem, 10vw, 6rem)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    color: isAnything ? '#00ffa3' : '#ffffff',
                    textShadow: isAnything ? '0 0 30px rgba(0, 255, 163, 0.3)' : 'none',
                  }}
                >
                  {objectText}
                </span>

                <span
                  className="landing-cursor-blink ml-1 inline-block rounded-sm"
                  style={{
                    width: 'clamp(2px, 0.4vw, 4px)',
                    height: 'clamp(2.5rem, 9vw, 5rem)',
                    background: isAnything ? '#00ffa3' : 'rgba(255,255,255,0.8)',
                    animation: bannerPhase === 'holding' ? 'landingBlink 1s step-end infinite' : 'none',
                    boxShadow: isAnything ? '0 0 15px rgba(0, 255, 163, 0.5)' : 'none',
                  }}
                />
              </div>
            )}

            {/* Logo reveal */}
            {showLogo && (
              <div className="absolute flex items-center justify-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 'clamp(36px, 7vw, 56px)',
                    height: 'clamp(36px, 7vw, 56px)',
                    background: 'linear-gradient(135deg, #00ffa3 0%, #00b4ff 100%)',
                    borderRadius: 'clamp(8px, 1.5vw, 12px)',
                    boxShadow: logoJoined
                      ? '0 0 40px rgba(0, 255, 163, 0.4), 0 0 80px rgba(0, 180, 255, 0.2)'
                      : '0 0 20px rgba(0, 255, 163, 0.2)',
                    transform: logoSplit
                      ? 'translateX(-60px)'
                      : logoJoined
                        ? 'translateX(0)'
                        : 'translateX(-60px)',
                    opacity: logoSplit ? 0 : 1,
                    transition:
                      'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease, box-shadow 0.4s ease',
                  }}
                >
                  <svg
                    width="clamp(20px, 4vw, 32px)"
                    height="clamp(20px, 4vw, 32px)"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0a0a0f"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>

                <span
                  style={{
                    color: '#ffffff',
                    fontSize: 'clamp(1.5rem, 5vw, 3rem)',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    transform: logoSplit
                      ? 'translateX(60px)'
                      : logoJoined
                        ? 'translateX(0)'
                        : 'translateX(60px)',
                    opacity: logoSplit ? 0 : 1,
                    transition:
                      'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease',
                    textShadow: logoJoined ? '0 0 40px rgba(255, 255, 255, 0.1)' : 'none',
                  }}
                >
                  PublisherIQ
                </span>
              </div>
            )}
          </div>

          <h1
            className="mt-4 text-lg font-medium tracking-tight sm:text-xl"
            style={{ color: LANDING_COLORS.textSecondary, letterSpacing: '-0.01em' }}
          >
            AI-Powered Gaming Intelligence
          </h1>
          <p
            className="mt-2 max-w-lg text-sm sm:text-base"
            style={{ color: LANDING_COLORS.textMuted, lineHeight: 1.6 }}
          >
            Real-time analytics for 200K+ games across Steam, Twitch, YouTube, and Epic
          </p>
        </div>
      </div>
    </div>
  );
}
