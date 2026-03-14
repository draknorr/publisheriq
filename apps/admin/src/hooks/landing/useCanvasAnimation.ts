'use client';

import { useEffect, useRef, type RefObject, type MutableRefObject } from 'react';
import { TIMING, DATA_SOURCES } from '@/components/landing/config/animations';
import type { BannerPhase } from '@/hooks/landing/useBannerAnimation';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  baseOpacity: number;
  speed: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface DataParticle {
  source: string;
  color: string;
  glowColor: string;
  x: number;
  y: number;
  targetY: number;
  speed: number;
  waveAmplitude: number;
  waveSpeed: number;
  waveOffset: number;
  size: number;
  opacity: number;
  maxOpacity: number;
  startY: number;
  isBar: boolean;
  barWidth: number;
}

interface DataSource {
  id: string;
  color: string;
  glowColor: string;
  x: number;
  y: number;
  emitInterval: number;
  lastEmit: number;
  currentX?: number;
  currentY?: number;
  disabled: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface BannerCanvasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

export function useCanvasAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  logoContainerRef: RefObject<HTMLDivElement | null>,
  chatBoxRef: RefObject<HTMLDivElement | null>,
  isTypingRef: MutableRefObject<boolean>,
  bannerPhaseRef?: MutableRefObject<BannerPhase>,
) {
  const starsRef = useRef<Star[]>([]);
  const dataStreamsRef = useRef<DataParticle[]>([]);
  const bannerCanvasParticlesRef = useRef<BannerCanvasParticle[]>([]);
  const shootingStarRef = useRef<ShootingStar | null>(null);
  const nextShootingStarRef = useRef(Date.now() + 8000 + Math.random() * 4000);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const chatTargetRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);
  const dataSourcesRef = useRef<DataSource[]>(
    DATA_SOURCES.map((s, i) => ({
      ...s,
      lastEmit: i * 200,
      disabled: false,
    })),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      chatTargetRef.current = {
        x: canvas.offsetWidth * 0.5,
        y: canvas.offsetHeight * 0.48,
      };
    };
    resize();
    window.addEventListener('resize', resize);

    // Mouse tracking for star interaction
    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    canvas.style.pointerEvents = 'auto';
    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 640;
    const starCount = prefersReducedMotion
      ? 0
      : isMobile
        ? TIMING.canvas.starCountMobile
        : TIMING.canvas.starCount;

    // Initialize stars
    starsRef.current = [];
    for (let i = 0; i < starCount; i++) {
      const depth = Math.random();
      starsRef.current.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        z: depth,
        size: 0.5 + depth * 2,
        baseOpacity: 0.1 + depth * 0.4,
        speed: 0.1 + depth * 0.4,
        twinkleSpeed: Math.random() * 0.3 + 0.1,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    const spawnDataParticle = (source: DataSource, targetX: number, targetY: number) => {
      const sourceX = source.currentX ?? source.x * canvas.offsetWidth;
      const sourceY = source.currentY ?? source.y * canvas.offsetHeight;
      const spreadX = (Math.random() - 0.5) * 30;

      dataStreamsRef.current.push({
        source: source.id,
        color: source.color,
        glowColor: source.glowColor,
        x: sourceX + spreadX,
        y: sourceY,
        targetY,
        speed: 0.4 + Math.random() * 0.3,
        waveAmplitude: 8 + Math.random() * 8,
        waveSpeed: 1.5 + Math.random() * 1,
        waveOffset: Math.random() * Math.PI * 2,
        size: 2 + Math.random() * 2,
        opacity: 0,
        maxOpacity: 0.6 + Math.random() * 0.3,
        startY: sourceY,
        isBar: Math.random() > 0.7,
        barWidth: 3 + Math.random() * 4,
      });
    };

    const animate = () => {
      const time = Date.now() * 0.001;
      const currentTime = Date.now();
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.fillStyle = 'rgba(8, 9, 12, 0.12)';
      ctx.fillRect(0, 0, w, h);

      // Nebula gradients — very low opacity to avoid accumulation with trail effect
      if (!prefersReducedMotion) {
        const nebula1 = ctx.createRadialGradient(
          w * 0.2, h * 0.15, 0,
          w * 0.2, h * 0.15, w * 0.5,
        );
        nebula1.addColorStop(0, 'rgba(100, 60, 150, 0.008)');
        nebula1.addColorStop(0.3, 'rgba(90, 55, 135, 0.005)');
        nebula1.addColorStop(0.6, 'rgba(80, 50, 120, 0.002)');
        nebula1.addColorStop(1, 'rgba(60, 40, 100, 0)');
        ctx.fillStyle = nebula1;
        ctx.fillRect(0, 0, w, h);

        const nebula2 = ctx.createRadialGradient(
          w * 0.8, h * 0.7, 0,
          w * 0.8, h * 0.7, w * 0.4,
        );
        nebula2.addColorStop(0, 'rgba(40, 100, 120, 0.006)');
        nebula2.addColorStop(0.3, 'rgba(35, 90, 110, 0.003)');
        nebula2.addColorStop(0.6, 'rgba(30, 80, 100, 0.001)');
        nebula2.addColorStop(1, 'rgba(20, 60, 80, 0)');
        ctx.fillStyle = nebula2;
        ctx.fillRect(0, 0, w, h);
      }

      // Stars
      const centerX = w / 2;
      const centerY = h / 2;

      for (const star of starsRef.current) {
        const dx = star.x - centerX;
        const dy = star.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          star.x += (dx / dist) * star.speed;
          star.y += (dy / dist) * star.speed;
        }

        const margin = 50;
        if (star.x < -margin || star.x > w + margin || star.y < -margin || star.y > h + margin) {
          const angle = Math.random() * Math.PI * 2;
          const spawnDist = 20 + Math.random() * 50;
          star.x = centerX + Math.cos(angle) * spawnDist;
          star.y = centerY + Math.sin(angle) * spawnDist;
        }

        // Mouse repulsion
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const mdx = star.x - mx;
        const mdy = star.y - my;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 80 && mdist > 0) {
          const force = (80 - mdist) / 80 * 0.3;
          star.x += (mdx / mdist) * force;
          star.y += (mdy / mdist) * force;
        }

        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.5 + 0.5;
        let opacity = star.baseOpacity * (0.7 + twinkle * 0.3);

        // Mouse brightening
        if (mdist < 120) {
          opacity *= 1 + (120 - mdist) / 120 * 0.5;
        }

        const distFromCenter = Math.sqrt((star.x - centerX) ** 2 + (star.y - centerY) ** 2);
        const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
        const distanceBrightness = 0.5 + (distFromCenter / maxDist) * 0.5;

        // Depth blur: reduce alpha for distant stars (z < 0.3)
        const depthAlpha = star.z < 0.3 ? opacity * distanceBrightness * 0.6 : opacity * distanceBrightness;

        ctx.globalAlpha = depthAlpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * distanceBrightness, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, 1)`;
        ctx.fill();

        // Bright star crosses for top ~15% brightest
        if (star.baseOpacity > 0.35) {
          const armLen = star.size * distanceBrightness * 1.5;
          ctx.strokeStyle = `rgba(255, 255, 255, ${depthAlpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(star.x - armLen, star.y);
          ctx.lineTo(star.x + armLen, star.y);
          ctx.moveTo(star.x, star.y - armLen);
          ctx.lineTo(star.x, star.y + armLen);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
      }

      // Shooting star
      if (!prefersReducedMotion) {
        if (!shootingStarRef.current && currentTime > nextShootingStarRef.current) {
          const angle = Math.random() * Math.PI * 0.5 + Math.PI * 0.25;
          const speed = w * 0.3 / 30; // traverse 30% of screen over ~30 frames (0.5s)
          shootingStarRef.current = {
            x: Math.random() * w * 0.8 + w * 0.1,
            y: Math.random() * h * 0.4,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 30,
            size: 1.5,
          };
          nextShootingStarRef.current = currentTime + 8000 + Math.random() * 4000;
        }

        const ss = shootingStarRef.current;
        if (ss) {
          ss.x += ss.vx;
          ss.y += ss.vy;
          ss.life++;
          const progress = ss.life / ss.maxLife;
          const alpha = progress < 0.1 ? progress / 0.1 : 1 - (progress - 0.1) / 0.9;

          // Trail
          const trailLen = 5;
          for (let t = 0; t < trailLen; t++) {
            const trailAlpha = alpha * (1 - t / trailLen) * 0.6;
            const tx = ss.x - ss.vx * t * 0.5;
            const ty = ss.y - ss.vy * t * 0.5;
            ctx.beginPath();
            ctx.arc(tx, ty, ss.size * (1 - t / trailLen * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${trailAlpha})`;
            ctx.fill();
          }

          // Head
          ctx.beginPath();
          ctx.arc(ss.x, ss.y, ss.size * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.fill();

          if (ss.life >= ss.maxLife) {
            shootingStarRef.current = null;
          }
        }
      }

      // Data stream particles
      dataStreamsRef.current = dataStreamsRef.current.filter((particle) => {
        particle.y += particle.speed;
        const waveX =
          Math.sin(time * particle.waveSpeed + particle.waveOffset) * particle.waveAmplitude;
        const currentX = particle.x + waveX;

        const totalDistance = particle.targetY - particle.startY;
        const progress = (particle.y - particle.startY) / totalDistance;

        if (progress < 0.2) {
          particle.opacity = (progress / 0.2) * particle.maxOpacity;
        } else if (progress > 0.8) {
          particle.opacity = ((1 - progress) / 0.2) * particle.maxOpacity;
        } else {
          particle.opacity = particle.maxOpacity;
        }

        const hex = particle.color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        if (particle.isBar) {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${particle.opacity})`;
          ctx.fillRect(currentX - particle.barWidth / 2, particle.y - 1, particle.barWidth, 2);
        } else {
          const dotGradient = ctx.createRadialGradient(
            currentX, particle.y, 0,
            currentX, particle.y, particle.size * 2,
          );
          dotGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${particle.opacity})`);
          dotGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${particle.opacity * 0.3})`);
          dotGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.beginPath();
          ctx.arc(currentX, particle.y, particle.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = dotGradient;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(currentX, particle.y, particle.size * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${Math.min(r + 50, 255)}, ${Math.min(g + 50, 255)}, ${Math.min(b + 50, 255)}, ${particle.opacity})`;
          ctx.fill();
        }

        return progress < 1;
      });

      // Banner canvas particles
      if (bannerPhaseRef?.current === 'typing') {
        // Spawn new particles near banner center
        if (Math.random() > 0.6) {
          bannerCanvasParticlesRef.current.push({
            x: w * 0.5 + (Math.random() - 0.5) * w * 0.3,
            y: h * 0.25 + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -Math.random() * 0.8 - 0.3,
            size: Math.random() * 2 + 1,
            opacity: 0.7,
            life: 0,
            maxLife: 60 + Math.random() * 40,
          });
        }
      }

      bannerCanvasParticlesRef.current = bannerCanvasParticlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const progress = p.life / p.maxLife;
        const alpha = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
        const finalOpacity = p.opacity * alpha;

        if (finalOpacity > 0.01) {
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          gradient.addColorStop(0, `rgba(0, 255, 163, ${finalOpacity})`);
          gradient.addColorStop(0.5, `rgba(0, 255, 163, ${finalOpacity * 0.3})`);
          gradient.addColorStop(1, 'rgba(0, 255, 163, 0)');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        return p.life < p.maxLife;
      });

      // Emit particles from data source logos
      const logoContainer = logoContainerRef.current;
      const chatBox = chatBoxRef.current;

      if (logoContainer && chatBox) {
        const logoElements = logoContainer.children;
        const chatBoxRect = chatBox.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        chatTargetRef.current = {
          x: chatBoxRect.left + chatBoxRect.width / 2 - canvasRect.left,
          y: chatBoxRect.top - canvasRect.top + 20,
        };

        for (let index = 0; index < dataSourcesRef.current.length; index++) {
          const source = dataSourcesRef.current[index];
          if (logoElements[index]) {
            const logoRect = (logoElements[index] as HTMLElement).getBoundingClientRect();
            source.currentX = logoRect.left + logoRect.width / 2 - canvasRect.left;
            source.currentY = logoRect.top + logoRect.height / 2 - canvasRect.top;
          }

          if (!source.disabled) {
            const emitInterval = isTypingRef.current
              ? source.emitInterval * TIMING.canvas.emitIntervalMultiplierTyping
              : source.emitInterval;
            if (currentTime - source.lastEmit > emitInterval) {
              const particleCount = isTypingRef.current
                ? TIMING.canvas.particleCountTyping
                : TIMING.canvas.particleCountIdle;
              for (let i = 0; i < particleCount; i++) {
                spawnDataParticle(
                  source,
                  chatTargetRef.current.x,
                  chatTargetRef.current.y,
                );
              }
              source.lastEmit = currentTime;
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [canvasRef, logoContainerRef, chatBoxRef, isTypingRef, bannerPhaseRef]);
}
