import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        kurum: {
          DEFAULT: '#0d5ba5',
          koyu: '#0a4a87',
          acik: '#e8f1fa',
        },
      },
    },
  },
  plugins: [],
};
export default config;
