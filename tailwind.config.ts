
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        glass: 'rgba(24, 26, 38, 0.72)',
        'thread-glass': 'rgba(20, 22, 32, 0.72)',
      },
      backgroundImage: {
        'noise': 'radial-gradient(rgba(255,255,255,0.24) 0.7px, transparent 0.7px)',
      },
      blur: {
        'xl': '34px',
        '2xl': '40px',
        '3xl': '70px',
        '4xl': '90px',
      },
      animation: {
        'pulse-slow': 'pulse 1.3s ease-in-out infinite',
      }
    }
  },
  plugins: []
};

export default config;
