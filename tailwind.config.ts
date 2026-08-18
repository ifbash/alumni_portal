import type { Config } from 'tailwindcss';

/**
 * Tailwind reads the CSS custom properties emitted per tenant, so utility
 * classes are branding-aware with no rebuild: `bg-brand-600` resolves to
 * whichever colour the college configured, at runtime.
 *
 * Two families of colour utility, and the distinction matters:
 *
 *  - **Semantic** (`bg-surface-raised`, `text-muted`, `border-line`) —
 *    mode-aware. These flip between light and dark. Reach for these
 *    first; almost every screen should be built entirely from them.
 *  - **Ramp stops** (`bg-brand-600`, `text-neutral-400`) — absolute. A
 *    stop is the same colour in both modes. Use only where a specific
 *    step is designed in, and check it against both grounds.
 *
 * There is no third option. A component that hardcodes a hex breaks
 * white-labelling for every customer at once.
 */

const ramp = (name: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, `var(--${name}-${s})`]),
  );

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: { ...ramp('brand'), DEFAULT: 'var(--brand-600)', fg: 'var(--brand-fg)', soft: 'var(--brand-soft)', 'soft-fg': 'var(--brand-soft-fg)' },
        accent: { ...ramp('accent'), DEFAULT: 'var(--accent-600)', fg: 'var(--accent-fg)', soft: 'var(--accent-soft)', 'soft-fg': 'var(--accent-soft-fg)' },
        neutral: ramp('neutral'),

        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
          inverse: 'var(--surface-inverse)',
        },
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        marker: 'var(--marker)',

        success: { DEFAULT: 'var(--success)', fg: 'var(--success-fg)', soft: 'var(--success-soft)', on: 'var(--success-on)' },
        warning: { DEFAULT: 'var(--warning)', fg: 'var(--warning-fg)', soft: 'var(--warning-soft)', on: 'var(--warning-on)' },
        danger: { DEFAULT: 'var(--danger)', fg: 'var(--danger-fg)', soft: 'var(--danger-soft)', on: 'var(--danger-on)' },
        info: { DEFAULT: 'var(--info)', fg: 'var(--info-fg)', soft: 'var(--info-soft)', on: 'var(--info-on)' },
      },

      textColor: {
        DEFAULT: 'var(--text-primary)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        'on-brand': 'var(--button-primary-fg)',
        'on-inverse': 'var(--text-on-inverse)',
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },

      borderWidth: { DEFAULT: 'var(--border-width)' },

      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
        sans: ['var(--font-body)'],
      },

      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: '1.45' }],
        sm: ['var(--text-sm)', { lineHeight: '1.5' }],
        base: ['var(--text-base)', { lineHeight: '1.6' }],
        md: ['var(--text-md)', { lineHeight: '1.6' }],
        lg: ['var(--text-lg)', { lineHeight: '1.55' }],
        xl: ['var(--text-xl)', { lineHeight: '1.4' }],
        'display-xs': ['var(--display-xs)', { lineHeight: '1.25', letterSpacing: 'var(--tracking-display)' }],
        'display-sm': ['var(--display-sm)', { lineHeight: '1.2', letterSpacing: 'var(--tracking-display)' }],
        'display-md': ['var(--display-md)', { lineHeight: '1.12', letterSpacing: 'var(--tracking-display)' }],
        'display-lg': ['var(--display-lg)', { lineHeight: '1.06', letterSpacing: 'var(--tracking-display)' }],
        'display-xl': ['var(--display-xl)', { lineHeight: '1.02', letterSpacing: 'var(--tracking-display)' }],
      },

      spacing: {
        gutter: 'var(--gutter)',
        section: 'var(--section-y)',
        card: 'var(--card-p)',
        control: 'var(--control-h)',
        'control-sm': 'var(--control-h-sm)',
        'control-lg': 'var(--control-h-lg)',
        row: 'var(--row-h)',
      },

      maxWidth: {
        page: 'var(--page-max)',
        prose: 'var(--prose-max)',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow)',
        none: 'none',
      },

      ringColor: { DEFAULT: 'var(--focus-ring)', brand: 'var(--focus-ring)' },
      outlineColor: { DEFAULT: 'var(--focus-ring)' },

      transitionTimingFunction: { DEFAULT: 'var(--ease)', brand: 'var(--ease)' },
      transitionDuration: { DEFAULT: 'var(--dur)', fast: 'var(--dur-fast)', slow: 'var(--dur-slow)' },

      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'draw-stroke': { from: { strokeDashoffset: '480' }, to: { strokeDashoffset: '0' } },
      },

      animation: {
        'fade-up': 'fade-up var(--dur) var(--ease) both',
        'fade-in': 'fade-in var(--dur) var(--ease) both',
        'scale-in': 'scale-in var(--dur-fast) var(--ease) both',
        'slide-down': 'slide-down var(--dur-fast) var(--ease) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'draw-stroke': 'draw-stroke 900ms var(--ease) both',
      },
    },
  },
  plugins: [],
};

export default config;
