import { defineConfig } from '@playwright/test'

const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT ?? 4173)
const baseURL = `http://127.0.0.1:${previewPort}`

export default defineConfig({
  testDir: './tests/web/playwright',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: 'artifacts/playwright/test-results',
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/playwright/results.json' }],
    ['html', { outputFolder: 'artifacts/playwright/report', open: 'never' }],
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    deviceScaleFactor: 1,
    launchOptions: {
      args: ['--font-render-hinting=none', '--disable-lcd-text'],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 768, height: 1024 },
        isMobile: false,
        hasTouch: true,
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      VITE_FF_DISABLE_SSE: 'true',
      VITE_FF_GUIDANCE_V1: 'false',
      VITE_FF_GUIDANCE_BELL_V1: 'false',
      VITE_FF_GLOBAL_HIGHLIGHTS_V1: 'false',
      VITE_FF_AGENT_STATS_UI: 'false',
      VITE_FF_MULTIMODAL_AGENT_INCLINATION_V1: 'false',
      VITE_FF_HUMAN_PARTICIPATION_V1: 'true',
    },
  },
})
