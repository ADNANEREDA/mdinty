/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#0ea5e9',
          DEFAULT: '#0c4a6e', // Bleu de Fès
          dark: '#082f49',
        },
        accent: {
          DEFAULT: '#b45309', // Cuivre
          hover: '#92400e',
        },
        alert: '#dc2626',   // Rouge urgence
        warning: '#eab308', // Jaune Safran 
        success: '#15803d', // Vert Zellige
        surface: '#fafaf9', // Fond sable
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], 
        heading: ['Outfit', 'sans-serif'], 
      }
    }
  },
  plugins: [],
}