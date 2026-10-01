/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Theme tokens: the values live in CSS variables (--c-*) defined in
      // src/index.css. :root = retro (default, original values) and
      // [data-theme='modern'] = modern. <alpha-value> keeps the opacity
      // modifiers working (e.g.: text-retro-black/60).
      colors: {
        retro: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          box: 'rgb(var(--c-box) / <alpha-value>)',
          black: 'rgb(var(--c-ink) / <alpha-value>)',
          accent: 'rgb(var(--c-accent) / <alpha-value>)',
        }
      },
      fontFamily: {
        pixel: ['var(--font-ui)'],
      },
      boxShadow: {
        retro: 'var(--shadow-1)',
        'retro-sm': 'var(--shadow-2)',
      }
    },
  },
  plugins: [],
}
