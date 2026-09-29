import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 深夜蓝：整站底色
        dusk: {
          950: "#05070f",
          900: "#0a0e1c",
          800: "#11162a",
        },
        // 火烧云橙红：整站强调色
        ember: {
          300: "#ffb37a",
          400: "#ff8a5c",
          500: "#ff6b4a",
          600: "#f04e2f",
        },
      },
      keyframes: {
        fadeInOut: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.7' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        driftA: {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '100%': { transform: 'translate(120px, 60px) scale(1.15)' },
        },
        driftB: {
          '0%': { transform: 'translate(0, 0) scale(1.1)' },
          '100%': { transform: 'translate(-100px, -50px) scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.15' },
          '50%': { opacity: '0.9' },
        },
        scanline: {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '6%': { opacity: '1' },
          '94%': { opacity: '1' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' },
        },
        auroraHue: {
          '0%, 100%': { filter: 'hue-rotate(0deg)', opacity: '0.5' },
          '50%': { filter: 'hue-rotate(50deg)', opacity: '0.9' },
        },
      },
      animation: {
        'fade-in-out': 'fadeInOut 2s ease-in-out infinite',
        'rise': 'rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        'drift-a': 'driftA 26s ease-in-out infinite alternate',
        'drift-b': 'driftB 32s ease-in-out infinite alternate',
        'glow-pulse': 'glowPulse 2.4s ease-in-out infinite',
        'twinkle': 'twinkle 3.2s ease-in-out infinite',
        'twinkle-slow': 'twinkle 5.5s ease-in-out infinite 1.2s',
        'scanline': 'scanline 9s linear infinite',
        'aurora': 'auroraHue 12s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
