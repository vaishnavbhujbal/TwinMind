/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0b0c",
          elevated: "#111114",
          card: "#16161a",
        },
        border: {
          DEFAULT: "#26262b",
          strong: "#35353c",
        },
        text: {
          DEFAULT: "#e6e6e8",
          muted: "#8a8a93",
          faint: "#5a5a63",
        },
        accent: {
          blue: "#3b82f6",
          purple: "#a855f7",
          green: "#22c55e",
          orange: "#f97316",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};