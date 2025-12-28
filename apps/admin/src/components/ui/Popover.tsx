'use client';

import { type ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  trigger: ReactNode;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function Popover({
  trigger,
  content,
  position = 'bottom',
  align = 'start',
  className = '',
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(hover: none)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate position when opening
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top = 0;
    let left = 0;

    // Vertical positioning
    if (position === 'top') {
      top = rect.top + scrollY - 8;
    } else if (position === 'bottom') {
      top = rect.bottom + scrollY + 8;
    } else {
      top = rect.top + scrollY + rect.height / 2;
    }

    // Horizontal positioning
    if (position === 'left') {
      left = rect.left + scrollX - 8;
    } else if (position === 'right') {
      left = rect.right + scrollX + 8;
    } else {
      // For top/bottom, use align
      if (align === 'start') {
        left = rect.left + scrollX;
      } else if (align === 'center') {
        left = rect.left + scrollX + rect.width / 2;
      } else {
        left = rect.right + scrollX;
      }
    }

    setCoords({ top, left });
  }, [position, align]);

  // Handle hover for desktop
  const handleMouseEnter = () => {
    if (isMobile) return;
    hoverTimeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOpen(false);
  };

  // Handle click for mobile
  const handleClick = (e: React.MouseEvent) => {
    if (!isMobile) return;
    e.stopPropagation();
    updatePosition();
    setIsOpen(!isOpen);
  };

  // Close on click outside
  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, isMobile]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Position classes for content
  const getTransformStyle = () => {
    if (position === 'top') {
      if (align === 'center') return 'translate(-50%, -100%)';
      if (align === 'end') return 'translate(-100%, -100%)';
      return 'translate(0, -100%)';
    }
    if (position === 'bottom') {
      if (align === 'center') return 'translate(-50%, 0)';
      if (align === 'end') return 'translate(-100%, 0)';
      return 'translate(0, 0)';
    }
    if (position === 'left') {
      return 'translate(-100%, -50%)';
    }
    if (position === 'right') {
      return 'translate(0, -50%)';
    }
    return '';
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="inline-block cursor-pointer"
      >
        {trigger}
      </div>
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={contentRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`fixed z-50 ${className}`}
            style={{
              top: coords.top,
              left: coords.left,
              transform: getTransformStyle(),
            }}
          >
            <div className="bg-surface-elevated border border-border-subtle rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
