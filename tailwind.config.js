/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9f7',
          100: '#d5f0eb',
          200: '#aee2da',
          300: '#79cbbf',
          400: '#3ba99b',
          500: '#138676',
          600: '#0d7064',
          700: '#0d5a51',
          800: '#104942',
          900: '#0c3733',
        },
        ink: '#17233b',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.03), 0 10px 28px rgba(15, 23, 42, 0.045)',
        lift: '0 14px 38px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
}
