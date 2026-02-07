/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/client/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // WeChat color palette
        wechat: {
          primary: "#07c160", // WeChat green
          bg: "#ededed", // Background gray
          sidebar: "#2e2e2e", // Sidebar dark
          bubble: {
            self: "#95ec69", // User bubble green
            other: "#ffffff", // Agent bubble white
          },
          border: "#d9d9d9",
          text: {
            primary: "#000000",
            secondary: "#999999",
            tertiary: "#b2b2b2",
          },
        },
        eden: {
          primary: "#6366F1", // Gentle Indigo
          secondary: "#F9FAFB", // Soft background
          border: "#E5E7EB", // Soft border
          text: {
            primary: "#1F2937", // Soft black
            secondary: "#6B7280", // Soft gray
          },
          sidebar: "#F3F4F6", // Gentle sidebar
        },
        // New Premium Palette (Stone & Green)
        // Mocha Mousse Theme
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        popover: {
          DEFAULT: "var(--color-popover)",
          foreground: "var(--color-popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          foreground: "var(--color-destructive-foreground)",
        },
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        sidebar: {
          DEFAULT: "oklch(var(--sidebar) / <alpha-value>)",
          foreground: "oklch(var(--sidebar-foreground) / <alpha-value>)",
          primary: "oklch(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "oklch(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "oklch(var(--sidebar-border) / <alpha-value>)",
          ring: "oklch(var(--sidebar-ring) / <alpha-value>)",
        },
        // Legacy support maps to new theme
        eden: {
          primary: "oklch(var(--primary) / <alpha-value>)",
          secondary: "oklch(var(--muted) / <alpha-value>)",
          border: "oklch(var(--border) / <alpha-value>)",
          text: {
            primary: "oklch(var(--foreground) / <alpha-value>)",
            secondary: "oklch(var(--muted-foreground) / <alpha-value>)",
          },
          sidebar: "oklch(var(--sidebar) / <alpha-value>)", // Gentle sidebar
        },
        premium: {
          bg: {
            main: "var(--color-background)",
            secondary: "var(--color-muted)",
            hover: "var(--color-accent)",
          },
          primary: {
            DEFAULT: "var(--color-primary)",
            foreground: "var(--color-primary-foreground)",
            light: "color-mix(in oklch, var(--color-primary), #fff 20%)",
            dark: "color-mix(in oklch, var(--color-primary), #000 20%)",
          },
          text: {
            primary: "var(--color-foreground)",
            secondary: "var(--color-muted-foreground)",
            tertiary: "color-mix(in oklch, var(--color-muted-foreground), transparent 20%)",
          },
          border: "var(--color-border)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
