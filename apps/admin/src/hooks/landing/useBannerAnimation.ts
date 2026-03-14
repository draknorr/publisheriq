'use client';

import { useState, useEffect, useRef } from 'react';
import { TIMING } from '@/components/landing/config/animations';
import { BANNER_PHRASES } from '@/components/landing/config/content';

export type BannerPhase =
  | 'scrolling'
  | 'typing'
  | 'holding'
  | 'deleting'
  | 'logo-reveal'
  | 'logo-holding'
  | 'logo-hide';

export type LogoPhase = 'hidden' | 'revealing' | 'visible' | 'hiding';

export interface BannerParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

export function useBannerAnimation() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [objectText, setObjectText] = useState('');
  const [bannerPhase, setBannerPhase] = useState<BannerPhase>('scrolling');
  const [scrollOffset, setScrollOffset] = useState(1);
  const [logoPhase, setLogoPhase] = useState<LogoPhase>('hidden');

  const bannerPhaseRef = useRef(bannerPhase);
  const objectTextRef = useRef(objectText);
  const phraseIndexRef = useRef(phraseIndex);
  const scrollOffsetRef = useRef(scrollOffset);
  const isAnythingRef = useRef(false);

  const current = BANNER_PHRASES[phraseIndex];
  const isAnything = current.object === 'anything';

  // Keep refs in sync
  useEffect(() => {
    bannerPhaseRef.current = bannerPhase;
    objectTextRef.current = objectText;
    phraseIndexRef.current = phraseIndex;
    scrollOffsetRef.current = scrollOffset;
    isAnythingRef.current = isAnything;
  });

  // Banner state machine
  useEffect(() => {
    const {
      typeSpeed,
      deleteSpeed,
      holdDuration,
      anythingHoldBeforeLogo,
      logoDisplayDuration,
      logoRevealDuration,
      logoHideDuration,
      scrollStep,
    } = TIMING.banner;

    let timeout: ReturnType<typeof setTimeout>;
    let animationFrame: number;
    let running = true;

    const tick = () => {
      if (!running) return;

      const phase = bannerPhaseRef.current;
      const text = objectTextRef.current;
      const idx = phraseIndexRef.current;
      const offset = scrollOffsetRef.current;
      const currentPhrase = BANNER_PHRASES[idx];
      const isAnythingNow = currentPhrase.object === 'anything';

      const nextLen = text.length + 1;

      switch (phase) {
        case 'scrolling':
          if (offset > 0) {
            setScrollOffset((prev) => Math.max(0, prev - scrollStep));
            animationFrame = requestAnimationFrame(tick);
          } else {
            setBannerPhase('typing');
          }
          break;

        case 'typing':
          if (text.length < currentPhrase.object.length) {
            timeout = setTimeout(() => {
              const nextText = currentPhrase.object.slice(0, nextLen);
              setObjectText(nextText);
              objectTextRef.current = nextText;
              tick();
            }, typeSpeed);
          } else {
            if (isAnythingNow) {
              timeout = setTimeout(() => {
                setLogoPhase('revealing');
                setBannerPhase('logo-reveal');
              }, anythingHoldBeforeLogo);
            } else {
              setBannerPhase('holding');
            }
          }
          break;

        case 'holding':
          timeout = setTimeout(() => {
            setBannerPhase('deleting');
          }, holdDuration);
          break;

        case 'logo-reveal':
          timeout = setTimeout(() => {
            setLogoPhase('visible');
            setBannerPhase('logo-holding');
          }, logoRevealDuration);
          break;

        case 'logo-holding':
          timeout = setTimeout(() => {
            setLogoPhase('hiding');
            setBannerPhase('logo-hide');
          }, logoDisplayDuration);
          break;

        case 'logo-hide':
          timeout = setTimeout(() => {
            setLogoPhase('hidden');
            setObjectText('');
            setPhraseIndex(0);
            setScrollOffset(1);
            setBannerPhase('scrolling');
          }, logoHideDuration);
          break;

        case 'deleting':
          if (text.length > 0) {
            timeout = setTimeout(() => {
              setObjectText((prev) => prev.slice(0, -1));
              tick();
            }, deleteSpeed);
          } else {
            setPhraseIndex((prev) => (prev + 1) % BANNER_PHRASES.length);
            setScrollOffset(1);
            setBannerPhase('scrolling');
          }
          break;
      }
    };

    tick();

    return () => {
      running = false;
      clearTimeout(timeout);
      cancelAnimationFrame(animationFrame);
    };
  }, [bannerPhase]);

  const prevPhrase =
    BANNER_PHRASES[(phraseIndex - 1 + BANNER_PHRASES.length) % BANNER_PHRASES.length];
  const nextPhrase = BANNER_PHRASES[(phraseIndex + 1) % BANNER_PHRASES.length];

  return {
    phraseIndex,
    objectText,
    bannerPhase,
    scrollOffset,
    bannerPhaseRef,
    bannerParticles: [] as BannerParticle[],
    logoPhase,
    current,
    prevPhrase,
    nextPhrase,
    isAnything,
  };
}
