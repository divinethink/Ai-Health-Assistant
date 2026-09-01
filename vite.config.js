import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Walking Skeleton — Hello World scaffold only.
// sw.js/manifest/icons/PWA intentionally NOT wired yet (deferred, DailyTask pattern reused).
export default defineConfig({
  plugins: [react()],
});
