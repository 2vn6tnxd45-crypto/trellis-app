// tailwind.config.js
/** @type {import('tailwindcss').Config} */
import themeExtension from './tailwind.config.extend.js';

export default {
  darkMode: 'class', // ← THIS IS THE NEW LINE - enables dark mode via class
  content: [
    "./index.html",
    "./home/index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Merge the custom extension here
      ...themeExtension.extend,
    },
  },
  plugins: [],
}
