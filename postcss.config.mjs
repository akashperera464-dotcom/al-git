// Tailwind v4 is already wired through @tailwindcss/vite in vite.config.ts.
// This empty PostCSS config prevents Vite from failing on the legacy string format.
const config = {
  plugins: [],
};

export default config;
