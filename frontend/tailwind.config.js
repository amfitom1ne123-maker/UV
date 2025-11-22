/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        fg: "#0a0a0a",
        muted: "#6b7280",
        border: "rgba(0,0,0,.08)",
        accent: "#0a0a0a",
        accentFg: "#ffffff",
        hover: "rgba(0,0,0,.06)",
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "20px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,.05)",
        md: "0 8px 24px rgba(0,0,0,.08)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};