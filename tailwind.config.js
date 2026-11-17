/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', ':root:not(.light)'],
  theme: {
    extend: {
      colors: {
        bg: c('--bg'),
        surface: c('--surface'),
        elevated: c('--elevated'),
        ink: c('--ink'),
        muted: c('--muted'),
        faint: c('--faint'),
        line: c('--line'),
        accent: c('--accent'),
        accent2: c('--accent-2'),
        'accent-ink': c('--accent-ink'),
        'on-accent': c('--on-accent'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Heebo Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Heebo Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--accent) / 0.25), 0 8px 32px -8px rgb(var(--accent) / 0.45)',
        card: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 12px 40px -16px rgb(0 0 0 / 0.6)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseline: { '0%': { strokeDashoffset: '120' }, '100%': { strokeDashoffset: '0' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        pulseline: 'pulseline 2.4s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
