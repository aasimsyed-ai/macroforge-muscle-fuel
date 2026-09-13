import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Without this plugin, any test file that transitively imports a "@/..."
// path (most of src/lib does, via supabase/client) fails to resolve under
// plain `vitest run` — the main app's own vite.config.ts gets this for free
// from @lovable.dev/vite-tanstack-config, but this standalone test config
// doesn't share that setup.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
