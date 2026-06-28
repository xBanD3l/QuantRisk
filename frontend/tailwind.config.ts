import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#090b0e",
        panel: "#111418",
        panel2: "#171b20",
        line: "#2a3038",
        muted: "#8f98a6",
        text: "#f3f5f7",
        teal: "#39d0b2",
        amber: "#f4b860",
        rose: "#f16d7a"
      },
      boxShadow: {
        workstation: "0 18px 80px rgba(0, 0, 0, 0.34)"
      }
    }
  },
  plugins: []
};

export default config;

