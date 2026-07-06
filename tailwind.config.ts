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
        // Old gold (Raffles-inspired)
        brand: {
          DEFAULT: '#cba135',
          dark: '#9a7b1a',
          light: '#f0d283',
        },
        // Deep green accent
        accent: {
          DEFAULT: '#1c6e4e',
          light: '#2f9e6f',
        },
        // Near-black surfaces
        surface: {
          DEFAULT: '#08080a',
          card: '#141417',
          border: '#2a2a30',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
