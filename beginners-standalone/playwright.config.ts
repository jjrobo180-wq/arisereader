import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: ["browser-smoke.spec.ts"],
  timeout: 45_000,
  expect: { timeout: 12_000 },
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173", ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: {
    command: "npx vite preview --config beginners-standalone/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 45_000
  }
});