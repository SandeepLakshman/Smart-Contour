/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#F7F1E8",
        cream: "#EFE4D3",
        brown: "#3A2921",
        deep: "#241914",
        terracotta: "#A65D45",
        copper: "#C98A68",
        charcoal: "#2C241F",
      },
      fontFamily: {
        sans: ["Source Serif 4", "Georgia", "serif"],
        display: ["Cormorant Garamond", "Georgia", "serif"],
        ui: ["Outfit", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 18px 50px rgba(36, 25, 20, 0.08)",
      },
    },
  },
  plugins: [],
};
