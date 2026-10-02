import { defineConfig } from '@playwright/test';
import * as path from 'path';

const runId = new Date().toISOString().replace(/[:.]/g, '-') + `-${process.pid}`;
const artifactsDir = path.resolve(
  process.env.SPIDERTESTER_ARTIFACTS_DIR || path.join('tests', 'artifacts', `run-${runId}`),
);

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  outputDir: path.join(artifactsDir, 'playwright'),
  reporter: [
    ['list'],
    ['junit', { outputFile: path.join(artifactsDir, 'junit.xml') }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});