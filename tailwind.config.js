/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#b5dff5',
          box: '#f5f0d0',
          black: '#1a1a1a',
          accent: '#2d8cf0',
        }
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      boxShadow: {
        retro: '4px 4px 0px #1a1a1a',
        'retro-sm': '2px 2px 0px #1a1a1a',
      }
    },
  },
  plugins: [],
}
