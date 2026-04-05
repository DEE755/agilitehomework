/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        olive: {
          300: '#a8ba72',
          400: '#8da05a',
          500: '#6b7c3a',
          600: '#526030',
          700: '#3c4724',
        },
        sand: {
          100: '#f5ede0',
          200: '#ebd8c0',
          300: '#d4b896',
          400: '#be9870',
          500: '#a57a4e',
        },
      },
    },
  },
  plugins: [],
};
