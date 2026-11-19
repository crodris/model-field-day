import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The page has one route and no internal links, so prerender "/" and skip link crawling.
export default defineConfig({
  plugins: [tanstackStart({ prerender: { enabled: true, crawlLinks: false } }), viteReact(), tailwindcss()],
});
