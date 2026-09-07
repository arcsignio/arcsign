/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Pointers, not copies. The values live in index.css :root — duplicating
      // them here would create a second source of truth with nothing enforcing
      // that the two agree.
      colors: {
        brand: {
          DEFAULT: "var(--brand)",
          press: "var(--brand-press)",
          accent: "var(--brand-accent)",
          pale: "var(--brand-pale)",
          faint: "var(--brand-faint)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          pale: "var(--danger-pale)",
          border: "var(--danger-border)",
          text: "var(--danger-text)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          pale: "var(--warning-pale)",
          border: "var(--warning-border)",
          text: "var(--warning-text)",
        },
        success: {
          DEFAULT: "var(--success)",
          pale: "var(--success-pale)",
          border: "var(--success-border)",
          text: "var(--success-text)",
        },
        ink: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        surface: {
          DEFAULT: "var(--surface-base)",
          sunken: "var(--surface-sunken)",
          strong: "var(--surface-strong)",
        },
      },
      fontFamily: {
        mono: "var(--font-mono)",
      },
      boxShadow: {
        raised: "var(--shadow-raised)",
      },
    },
  },
  plugins: [],
}
