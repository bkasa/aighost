/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#f0f2f5',
          100: '#d8dde6',
          200: '#b0bccb',
          300: '#8497ad',
          400: '#5d7490',
          500: '#3d566f',
          600: '#2a3d52',
          700: '#1e2d3d',
          800: '#141f2b',
          900: '#0d1520',
          950: '#080e16',
        },
        gold: {
          100: '#fdf3d8',
          200: '#f9e3a3',
          300: '#f3cc6b',
          400: '#e8b53a',
          500: '#c9941c',
          600: '#a47214',
          700: '#7d540e',
          800: '#5a3c0a',
          900: '#3a2606',
        },
        parchment: {
          50:  '#fdfaf5',
          100: '#faf4e8',
          200: '#f4e8d0',
          300: '#ead6b0',
          400: '#dabb88',
          500: '#c99c5e',
          600: '#aa7c3d',
          700: '#8a5f2d',
          800: '#6a4621',
          900: '#4d3118',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'cursor-blink': 'cursorBlink 1.2s step-end infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        cursorBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      boxShadow: {
        'gold': '0 0 0 1px rgba(201, 148, 28, 0.3), 0 4px 24px rgba(201, 148, 28, 0.1)',
        'ink': '0 4px 32px rgba(8, 14, 22, 0.5)',
        'manuscript': '0 2px 16px rgba(8, 14, 22, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
}
