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
        brand: {
          DEFAULT: '#1d4ed8', // blue-700
          dark: '#1e3a8a',    // blue-900
          light: '#3b82f6',   // blue-500
        },
        surface: {
          DEFAULT: '#0f172a', // slate-900
          card: '#1e293b',    // slate-800
          border: '#334155',  // slate-700
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
