// tailwind.config.js - Optional: Add if you want to use Tailwind CSS styling
// This is pre-configured for future use with the color palette extracted from Figma

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Add extracted Figma colors here
        // Example:
        // "brand-purple": "#7c3aed",
        // "brand-pink": "#a78bfa",
      },
      fontFamily: {
        // Add extracted Figma fonts here
        // Example:
        // sans: ["Inter", "system-ui"],
      },
    },
  },
  plugins: [],
};
