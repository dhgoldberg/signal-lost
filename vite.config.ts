import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves at /<repo>/, so set base from env in CI.
  // Locally, this defaults to "/".
  base: process.env.VITE_BASE ?? "/",
});
