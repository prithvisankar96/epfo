import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f2',
          100: '#d7ecdf',
          500: '#1a7f4e',
          600: '#156641',
          700: '#114f34',
          900: '#0a2f20',
        },
      },
    },
  },
  plugins: [],
};

export default config;
