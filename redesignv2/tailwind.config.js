/**
 * PublisherIQ Design System
 * Tailwind CSS Configuration
 * 
 * Theme: Warm Stone + Coral
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ============================================================
         COLORS
         ============================================================ */
      colors: {
        // Surface colors (use CSS variables for theme switching)
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          elevated: 'var(--surface-elevated)',
          sunken: 'var(--surface-sunken)',
          overlay: 'var(--surface-overlay)',
          backdrop: 'var(--surface-backdrop)',
        },

        // Border colors
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
          interactive: 'var(--border-interactive)',
        },

        // Text colors
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
          placeholder: 'var(--text-placeholder)',
          inverse: 'var(--text-inverse)',
          'on-accent': 'var(--text-on-accent)',
        },

        // Accent colors
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-primary-hover)',
          active: 'var(--accent-primary-active)',
          subtle: 'var(--accent-primary-subtle)',
          muted: 'var(--accent-primary-muted)',
          secondary: 'var(--accent-secondary)',
          'secondary-hover': 'var(--accent-secondary-hover)',
        },

        // Semantic colors
        success: {
          DEFAULT: 'var(--semantic-success)',
          subtle: 'var(--semantic-success-subtle)',
          hover: 'var(--semantic-success-hover)',
          text: 'var(--semantic-success-text)',
        },
        error: {
          DEFAULT: 'var(--semantic-error)',
          subtle: 'var(--semantic-error-subtle)',
          hover: 'var(--semantic-error-hover)',
          text: 'var(--semantic-error-text)',
        },
        warning: {
          DEFAULT: 'var(--semantic-warning)',
          subtle: 'var(--semantic-warning-subtle)',
          text: 'var(--semantic-warning-text)',
        },
        info: {
          DEFAULT: 'var(--semantic-info)',
          subtle: 'var(--semantic-info-subtle)',
          text: 'var(--semantic-info-text)',
        },

        // Interactive states
        interactive: {
          hover: 'var(--interactive-hover)',
          active: 'var(--interactive-active)',
          selected: 'var(--interactive-selected)',
          disabled: 'var(--interactive-disabled)',
        },

        // Chart colors
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
          grid: 'var(--chart-grid)',
          axis: 'var(--chart-axis)',
        },

        // Component-specific
        table: {
          header: 'var(--table-header-bg)',
          hover: 'var(--table-row-hover)',
          selected: 'var(--table-row-selected)',
          stripe: 'var(--table-row-stripe)',
          border: 'var(--table-border)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          hover: 'var(--sidebar-item-hover)',
          active: 'var(--sidebar-item-active)',
        },
        card: {
          bg: 'var(--card-bg)',
          border: 'var(--card-border)',
          'hover-border': 'var(--card-hover-border)',
        },
        input: {
          bg: 'var(--input-bg)',
          border: 'var(--input-border)',
          'border-hover': 'var(--input-border-hover)',
          'border-focus': 'var(--input-border-focus)',
          placeholder: 'var(--input-placeholder)',
        },
        badge: {
          bg: 'var(--badge-default-bg)',
          text: 'var(--badge-default-text)',
        },

        // Static colors (don't change with theme)
        // Light mode palette
        stone: {
          50: '#FAF9F7',
          100: '#F8F6F3',
          200: '#F0EDE8',
          300: '#E8E4DE',
          400: '#DDD8D0',
          500: '#C9C4BC',
          600: '#9A958D',
          700: '#7A756D',
          800: '#5C5752',
          900: '#2D2A26',
          950: '#1A1816',
        },
        coral: {
          50: '#FBF0EF',
          100: '#F5DCD9',
          200: '#EBBFBA',
          300: '#E07D75',
          400: '#D4716A',
          500: '#C46359',
          600: '#B4564C',
          700: '#9C4338',
          800: '#7A352C',
          900: '#52231D',
        },
      },

      /* ============================================================
         TYPOGRAPHY
         ============================================================ */
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        xs: ['11px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['14px', { lineHeight: '1.5' }],
        md: ['15px', { lineHeight: '1.5' }],
        lg: ['16px', { lineHeight: '1.5' }],
        xl: ['18px', { lineHeight: '1.4' }],
        '2xl': ['20px', { lineHeight: '1.3' }],
        '3xl': ['24px', { lineHeight: '1.3' }],
        '4xl': ['30px', { lineHeight: '1.2' }],
      },

      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        normal: '0',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em',
      },

      /* ============================================================
         SPACING
         ============================================================ */
      spacing: {
        '4.5': '18px',
        '5.5': '22px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
      },

      /* ============================================================
         BORDER RADIUS
         ============================================================ */
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
        '2xl': '16px',
      },

      /* ============================================================
         BOX SHADOW
         ============================================================ */
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'DEFAULT': 'var(--shadow-md)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        'focus': 'var(--shadow-focus)',
        'inset': 'var(--shadow-inset)',
        'none': 'none',
      },

      /* ============================================================
         Z-INDEX
         ============================================================ */
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'toast': '1080',
      },

      /* ============================================================
         TRANSITIONS
         ============================================================ */
      transitionDuration: {
        'fast': '100ms',
        'DEFAULT': '150ms',
        'slow': '250ms',
      },

      /* ============================================================
         ANIMATIONS
         ============================================================ */
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-from-top': {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-left': {
          '0%': { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-in',
        'slide-in-from-top': 'slide-in-from-top 200ms ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 200ms ease-out',
        'slide-in-from-left': 'slide-in-from-left 200ms ease-out',
        'slide-in-from-right': 'slide-in-from-right 200ms ease-out',
        'scale-in': 'scale-in 200ms ease-out',
        'spin-slow': 'spin-slow 2s linear infinite',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },

      /* ============================================================
         BACKDROP BLUR
         ============================================================ */
      backdropBlur: {
        'xs': '2px',
      },
    },
  },

  /* ============================================================
     PLUGINS
     ============================================================ */
  plugins: [
    // Custom plugin for component-specific utilities
    function({ addUtilities, addComponents, theme }) {
      // Data/numeric typography
      addUtilities({
        '.font-data': {
          fontFamily: theme('fontFamily.mono'),
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        },
        '.trend-up': {
          color: 'var(--semantic-success-text)',
        },
        '.trend-down': {
          color: 'var(--semantic-error-text)',
        },
      });

      // Custom scrollbar styles
      addUtilities({
        '.scrollbar-styled': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'var(--scrollbar-track)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--scrollbar-thumb)',
            borderRadius: '4px',
            '&:hover': {
              background: 'var(--scrollbar-thumb-hover)',
            },
          },
        },
        '.scrollbar-thin': {
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
        },
        '.scrollbar-hidden': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      });

      // Focus ring utility
      addUtilities({
        '.focus-ring': {
          '&:focus-visible': {
            outline: 'none',
            boxShadow: 'var(--shadow-focus)',
          },
        },
      });
    },
  ],
};
