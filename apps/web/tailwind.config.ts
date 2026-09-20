import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chrome: {
          950: "#070b12",
          900: "#0b111c",
          850: "#111827",
          800: "#172033",
          700: "#24324a"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
