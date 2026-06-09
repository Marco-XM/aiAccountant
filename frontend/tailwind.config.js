/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          navy:    "#0A2463",
          blue:    "#3E92CC",
          white:   "#FFFAFF",
          crimson: "#D8315B",
          ink:     "#1E1B18",
        },
      },
    },
  },
  plugins: [],
};
