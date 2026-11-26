import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				canvas: 'var(--bg)',
				surface: 'var(--surface)',
				raised: 'var(--surface-raised)',
				line: 'var(--border)',
				'line-strong': 'var(--control-border)',
				ink: 'var(--text)',
				muted: {
					DEFAULT: 'var(--text-muted)',
					foreground: 'var(--text-muted)'
				},
				accent: {
					DEFAULT: 'var(--accent-surface)',
					foreground: 'var(--accent-foreground)'
				},
				'on-accent': 'var(--on-accent)',
				ok: 'var(--ok)',
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--on-primary)'
				},
				'primary-hover': 'var(--primary-hover)',
				'primary-active': 'var(--primary-active)',
				'on-primary': 'var(--on-primary)',
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)'
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)'
				},
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)'
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)'
				},
				border: 'var(--border)',
				ring: 'var(--ring)',
				sidebar: {
					DEFAULT: "var(--sidebar-background)",
					foreground: "var(--sidebar-foreground)",
					primary: "var(--sidebar-primary)",
					"primary-foreground": "var(--sidebar-primary-foreground)",
					accent: "var(--sidebar-accent)",
					"accent-foreground": "var(--sidebar-accent-foreground)",
					border: "var(--sidebar-border)",
					ring: "var(--sidebar-ring)",
				},
				money: 'var(--money)',
				'money-text': 'var(--money-text)',
				'money-bg': 'var(--money-bg)',
				'money-border': 'var(--money-border)',
				'on-money': 'var(--on-money)',
				cream: 'var(--cream)',
				success: 'var(--success)',
				'success-bg': 'var(--success-bg)',
				'success-border': 'var(--success-border)',
				warning: 'var(--warning)',
				'warning-bg': 'var(--warning-bg)',
				'warning-border': 'var(--warning-border)',
				danger: 'var(--danger)',
				'danger-bg': 'var(--danger-bg)',
				'danger-border': 'var(--danger-border)',
				'on-danger': 'var(--on-danger)',
				'info-bg': 'var(--info-bg)',
				'info-border': 'var(--info-border)',
				selected: 'var(--selected-bg)',
				input: 'var(--input-bg)',
				overlay: 'var(--overlay)'
			},
			boxShadow: {
				sm: 'var(--shadow-sm)',
				md: 'var(--shadow-md)'
			},
			fontFamily: {
				sans: [
					"Plus Jakarta Sans",
					"Inter",
					"-apple-system",
					"BlinkMacSystemFont",
					"Segoe UI",
					"Roboto",
					"sans-serif",
				],
				mono: [
					"JetBrains Mono",
					"ui-monospace",
					"SFMono-Regular",
					"Menlo",
					"Monaco",
					"Consolas",
					"monospace",
				],
			},
			borderRadius: {
				sm: "6px",
				md: "8px",
				lg: "12px",
				xl: "12px",
				"2xl": "16px",
			},
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
