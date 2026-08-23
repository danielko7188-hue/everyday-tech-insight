import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4321";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.001,
      scale: "css",
    },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1",
    env: { ASTRO_PREVIEW_BACKGROUND: "1" },
    port: 4321,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /visual-regression\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "visual-chromium",
      fullyParallel: false,
      testMatch: /visual-regression\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        contextOptions: { reducedMotion: "reduce" },
        deviceScaleFactor: 1,
        locale: "en-US",
        timezoneId: "America/Los_Angeles",
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
});
