/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // Enable dark mode with class strategy
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        gridTemplateColumns: {
          '9': 'repeat(9, minmax(0, 1fr))',
          '10': 'repeat(10, minmax(0, 1fr))',
        },
        colors: {
          // Theme colors
          theme: {
            primary: 'var(--theme-primary)',
            bg: 'var(--theme-bg)',
            text: 'var(--theme-text)',
            'text-secondary': 'var(--theme-text-secondary)',
          },
        },
      },
    },
    plugins: [],
  }