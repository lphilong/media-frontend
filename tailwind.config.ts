import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        panel: 'var(--color-panel)',
        border: 'var(--color-border)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        danger: 'var(--color-danger)',
      },
      boxShadow: {
        shell: '0 1px 2px 0 rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
