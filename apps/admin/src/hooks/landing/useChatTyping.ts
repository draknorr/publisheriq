'use client';

import { useState, useEffect, useRef } from 'react';
import { TIMING } from '@/components/landing/config/animations';
import { CHAT_PROMPTS } from '@/components/landing/config/content';

export function useChatTyping() {
  const [currentPromptPhase, setCurrentPromptPhase] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showViz, setShowViz] = useState([false, false, false, false]);
  const isTypingRef = useRef(false);

  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  useEffect(() => {
    let cancelled = false;

    const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => {
          pendingTimeouts.delete(id);
          resolve();
        }, ms);
        pendingTimeouts.add(id);
      });

    const runSequence = async () => {
      while (!cancelled) {
        for (let i = 0; i < CHAT_PROMPTS.length; i++) {
          if (cancelled) return;

          setCurrentPromptPhase(i);
          setIsTyping(true);

          const prompt = CHAT_PROMPTS[i];
          for (let j = 0; j <= prompt.length; j++) {
            if (cancelled) return;
            setTypedText(prompt.slice(0, j));
            await delay(TIMING.chat.typingDuration / prompt.length);
          }

          if (cancelled) return;
          setIsTyping(false);
          await delay(TIMING.chat.vizDelay);

          if (cancelled) return;
          setShowViz((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });

          await delay(TIMING.chat.vizDuration);

          if (i < CHAT_PROMPTS.length - 1) {
            await delay(TIMING.chat.pauseBetween);
          }
        }

        if (cancelled) return;
        await delay(TIMING.chat.resetPause);

        if (cancelled) return;
        setShowViz([false, false, false, false]);
        await delay(TIMING.chat.fadeOutPause);

        if (cancelled) return;
        setTypedText('');
        setCurrentPromptPhase(0);
        await delay(TIMING.chat.restartPause);
      }
    };

    runSequence();

    return () => {
      cancelled = true;
      for (const id of pendingTimeouts) clearTimeout(id);
      pendingTimeouts.clear();
    };
  }, []);

  return {
    typedText,
    isTyping,
    isTypingRef,
    currentPromptPhase,
    showViz,
  };
}
