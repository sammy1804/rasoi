/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        sand: 'rgb(var(--sand) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          mute: 'rgb(var(--ink-mute) / <alpha-value>)',
        },
        clay: {
          DEFAULT: 'rgb(var(--clay) / <alpha-value>)',
          soft: 'rgb(var(--clay-soft) / <alpha-value>)',
          deep: 'rgb(var(--clay-deep) / <alpha-value>)',
        },
        meal: {
          breakfast: 'rgb(var(--m-breakfast) / <alpha-value>)',
          lunch: 'rgb(var(--m-lunch) / <alpha-value>)',
          snack: 'rgb(var(--m-snack) / <alpha-value>)',
          dinner: 'rgb(var(--m-dinner) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px' },
      boxShadow: {
        soft: '0 1px 2px rgb(31 29 26 / 0.04), 0 4px 16px -8px rgb(31 29 26 / 0.10)',
        lift: '0 2px 4px rgb(31 29 26 / 0.05), 0 12px 32px -12px rgb(31 29 26 / 0.22)',
      },
      keyframes: {
        pulseDot: { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.35, transform: 'scale(0.8)' } },
      },
      animation: { pulseDot: 'pulseDot 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
}
