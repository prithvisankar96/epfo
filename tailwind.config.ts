import type { Config } from 'tailwindcss';

// Design tokens from DESIGN.md (Wise-inspired system).
// Radius scale maps onto Tailwind's built-ins: sm 8px → rounded-lg,
// md 12px → rounded-xl, lg 16px → rounded-2xl, xl 24px → rounded-3xl
// (the canonical card/button radius), pill → rounded-full.

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#9fe870', // Wise green — sole CTA/brand accent
          active: '#cdffad',
          neutral: '#c5edab',
          pale: '#e2f6d5',
        },
        ink: {
          DEFAULT: '#0e0f0c',
          deep: '#163300',
        },
        bodytext: '#454745',
        mute: '#868685',
        canvas: {
          DEFAULT: '#ffffff',
          soft: '#e8ebe6', // sage-tinted page canvas
        },
        positive: {
          DEFAULT: '#2ead4b',
          deep: '#054d28',
        },
        warning: {
          DEFAULT: '#ffd11a',
          deep: '#b86700',
          content: '#4a3b1c',
        },
        negative: {
          DEFAULT: '#d03238',
          deep: '#a72027',
          darkest: '#a7000d',
          bg: '#320707',
        },
        accent: {
          orange: '#ffc091',
          cyan: '#38c8ff',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
