import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

function publicContentSnapshots() {
  return {
    name: "infohub-public-content-snapshots",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "generated-feed.json",
        source: readFileSync(new URL("./app/generated-feed.json", import.meta.url), "utf8"),
      });
      this.emitFile({
        type: "asset",
        fileName: "generated-section-summaries.json",
        source: readFileSync(new URL("./app/generated-section-summaries.json", import.meta.url), "utf8"),
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), publicContentSnapshots()],
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
  },
});
