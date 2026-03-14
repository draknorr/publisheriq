'use client';

import { useRef } from 'react';
import { useBannerAnimation } from '@/hooks/landing/useBannerAnimation';
import { useChatTyping } from '@/hooks/landing/useChatTyping';
import { useCanvasAnimation } from '@/hooks/landing/useCanvasAnimation';
import { LANDING_COLORS } from './config/animations';
import { LandingNav } from './LandingNav';
import { HeroSection } from './HeroSection';
import { ChatDemo } from './ChatDemo';
import { TrustBar } from './TrustBar';
import { FeaturesSection } from './FeaturesSection';
import { MidPageCTA } from './MidPageCTA';
import { StatsSection } from './StatsSection';
import { WaitlistCTA } from './WaitlistCTA';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  // Shared refs for canvas particle targeting
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  // Animation hooks
  const banner = useBannerAnimation();
  const chat = useChatTyping();

  // Canvas animation (starfield + data particles + banner particles)
  useCanvasAnimation(canvasRef, logoContainerRef, chatBoxRef, chat.isTypingRef, banner.bannerPhaseRef);

  return (
    <div
      id="main-content"
      className="relative min-h-screen overflow-hidden"
      style={{
        background: LANDING_COLORS.bgGradient,
        fontFamily: "var(--font-sans), 'Inter', system-ui, sans-serif",
      }}
    >
      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[5] h-full w-full opacity-90"
        aria-hidden="true"
      />

      {/* Gradient overlays */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at 30% 10%, rgba(100, 60, 150, 0.08) 0%, transparent 50%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at 70% 80%, rgba(40, 100, 120, 0.06) 0%, transparent 50%)',
        }}
      />

      {/* Navigation */}
      <LandingNav />

      {/* Hero viewport — fills first screen, explore pushed to bottom */}
      <div className="relative flex min-h-screen flex-col">
        {/* Spacer for fixed nav */}
        <div className="h-14 flex-shrink-0" />

        {/* Hero: Banner animation */}
        <HeroSection
          objectText={banner.objectText}
          bannerPhase={banner.bannerPhase}
          scrollOffset={banner.scrollOffset}
          logoPhase={banner.logoPhase}
          current={banner.current}
          prevPhrase={banner.prevPhrase}
          nextPhrase={banner.nextPhrase}
          isAnything={banner.isAnything}
        />

        {/* Hero: Chat demo + data sources + viz cards */}
        <ChatDemo
          logoContainerRef={logoContainerRef}
          chatBoxRef={chatBoxRef}
          typedText={chat.typedText}
          isTyping={chat.isTyping}
          showViz={chat.showViz}
        />

        {/* Scroll-down indicator — pushed to bottom of viewport */}
        <div className="relative z-10 mt-auto flex flex-col items-center gap-2 pb-8 pt-6 opacity-70">
          <span
            className="text-[0.7rem] uppercase tracking-[0.15em]"
            style={{ color: LANDING_COLORS.textMuted }}
          >
            Explore
          </span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            className="animate-bounce"
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </div>

      {/* Below-fold sections */}
      <main>
        <TrustBar />

        <FeaturesSection />

        <MidPageCTA />

        {/* Divider */}
        <div className="mx-auto h-px max-w-4xl" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,163,0.2), transparent)' }} />

        <StatsSection />

        {/* Divider */}
        <div className="mx-auto h-px max-w-4xl" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.2), transparent)' }} />

        <WaitlistCTA />
      </main>

      <LandingFooter />

      <div className="landing-noise" aria-hidden="true" />
    </div>
  );
}
