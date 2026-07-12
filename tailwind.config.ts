import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Muted green — the single brand accent
        brand: {
          DEFAULT: '#2e6b3e',
          dark: '#245331',
          light: '#5aa971',
        },
        accent: {
          DEFAULT: '#2e6b3e',
          light: '#5aa971',
        },
        // Grey/black surfaces
        surface: {
          DEFAULT: '#131315',
          card: '#1e1e21',
          raised: '#26262a',
          border: '#323238',
        },
        // Category colours — reserved for later features (per-discipline tiles, etc.)
        category: {
          red: '#e5484d',
          blue: '#3b82f6',
          orange: '#f97316',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
