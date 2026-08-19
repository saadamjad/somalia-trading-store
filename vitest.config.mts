import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.local" });

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // next-auth imports the extensionless specifier "next/server", which Vitest's
      // SSR module resolution can't resolve on its own (Next.js itself handles this
      // via its build-time resolver). Point it at the real file directly.
      "next/server": fileURLToPath(
        new URL("./node_modules/next/server.js", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    server: {
      // Without this, Vitest externalizes next-auth (as a node_modules dep) and lets
      // Node resolve its imports directly, bypassing the alias above entirely.
      // Inlining it routes resolution through Vite, where the alias applies.
      deps: { inline: [/next-auth/] },
    },
  },
});
