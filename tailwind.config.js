/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#001F3F', // 60% Navy Blue (trust/authority)
        secondary: '#A5D8FF', // 30% Light Blue (calm backgrounds)
        accent: '#0A9396', // 10% Teal (actions/alerts)
      },
      boxShadow: {
        clay: 'inset 0 2px 5px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};