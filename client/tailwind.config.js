/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#fdf8f0', 100: '#faf0dd', 200: '#f5deb8', 300: '#edc78a', 400: '#e3aa57', 500: '#db9235', 600: '#ce7d2a', 700: '#ab6323', 800: '#894f22', 900: '#6f421f' },
        surface: { 50: '#fefcf8', 100: '#fcf8f0', 200: '#f7f0e0', 300: '#efe5cc', 400: '#e2d4b3' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] }
    }
  },
  plugins: []
}
