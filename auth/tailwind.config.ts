import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import tailwindcssAnimate from "tailwindcss-animate";

const shadcnDataVariants = plugin(({ addVariant }) => {
  addVariant("data-open", '&[data-state="open"], &[data-open]:not([data-open="false"])');
  addVariant("data-closed", '&[data-state="closed"], &[data-closed]:not([data-closed="false"])');
  addVariant("data-checked", '&[data-state="checked"], &[data-checked]:not([data-checked="false"])');
  addVariant("data-unchecked", '&[data-state="unchecked"], &[data-unchecked]:not([data-unchecked="false"])');
  addVariant("data-selected", '&[data-selected="true"]');
  addVariant("data-disabled", '&[data-disabled="true"], &[data-disabled]:not([data-disabled="false"])');
  addVariant("data-active", '&[data-state="active"], &[data-active]:not([data-active="false"])');
  addVariant("data-horizontal", '&[data-orientation="horizontal"]');
  addVariant("data-vertical", '&[data-orientation="vertical"]');
  addVariant("data-inset", '&[data-inset="true"]');
});

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border: "var(--border)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        "on-primary": "var(--on-primary)",
        money: "var(--money)",
        "on-money": "var(--on-money)",
        cream: "var(--cream)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        input: "var(--input)",
        ring: "var(--ring)",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        heading: ["Plus Jakarta Sans", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "18px",
        "4xl": "2rem",
      },
      ringWidth: {
        3: "3px",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionDuration: {
        fast: "140ms",
      },
    },
  },
  plugins: [tailwindcssAnimate, shadcnDataVariants],
};

export default config;
