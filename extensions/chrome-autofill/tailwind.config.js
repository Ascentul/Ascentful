/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Match Ascentul brand colors
        primary: {
          50: '#eef0ff',
          100: '#e0e4ff',
          200: '#c7cdfe',
          300: '#a5acfc',
          400: '#8182f8',
          500: '#5371FF', // Main brand color
          600: '#5548eb',
          700: '#4a3bd0',
          800: '#3d32a8',
          900: '#352f85',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        success: {
          500: '#10b981',
        },
        warning: {
          500: '#f59e0b',
        },
        danger: {
          500: '#ef4444',
        },
      },
      borderRadius: {
        shell: '24px',
        card: '18px',
        control: '999px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
};
