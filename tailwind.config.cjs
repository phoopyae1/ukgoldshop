/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf7e7',
          100: '#fae9c1',
          200: '#f6d794',
          300: '#f0c262',
          400: '#eaa838',
          500: '#d98d1f',
          600: '#b26e14',
          700: '#8a5313',
          800: '#5a370f',
          900: '#2f1b07'
        }
      }
    }
  },
  plugins: []
};
