import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0A",
        foreground: "#ffffff",
        primary: {
          DEFAULT: "#6366F1", // Electric Indigo
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#10B981", // Emerald
          foreground: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
