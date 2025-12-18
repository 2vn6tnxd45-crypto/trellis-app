// tailwind.config.js
/** @type {import('tailwindcss').Config} */
import themeExtension from './tailwind.config.extend.js';

export default {
  content: [
    "./index.html",
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
