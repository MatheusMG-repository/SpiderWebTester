import { WebScraperService } from './scraper';
import { formatContextForLLM } from './formatter';
import { buildPageObjectPrompt, buildTestPrompt, callAI } from './generator';
import { selectAI, ParsedAIArgs } from './ai-selector';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

function runGeneratedTests(testPaths: string[], artifactsDir: string): Promise<number> {
  const playwrightCli = require.resolve('@playwright/test/cli');
  const testArgs = testPaths.map((testPath) =>
    path.resolve(testPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const args = [playwrightCli, 'test', '--config=playwright.config.ts', ...testArgs];

  fs.mkdirSync(artifactsDir, { recursive: true });

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, SPIDERTESTER_ARTIFACTS_DIR: artifactsDir },
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      console.error('Failed to start Playwright:', error.message);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const args = process.argv.slice(2);
  let targetUrl = '';

  // AI args (populated by CLI parsing below)
  const aiArgs: ParsedAIArgs = {
    modelName: 'qwen2.5-coder:7b',
  };

  let limit = 3;

  // -------------------------------------------------------------------------
  // CLI argument parsing
  // -------------------------------------------------------------------------
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];

    if (flag === '--model' || flag === '-m') {
      if (i + 1 < args.length) {
        aiArgs.modelName = args[++i];
      } else {
        console.error('Error: --model flag requires a value.');
        process.exit(1);
      }
    } else if (flag === '--limit' || flag === '-l') {
      if (i + 1 < args.length) {
        const parsedLimit = parseInt(args[++i], 10);
        if (isNaN(parsedLimit) || parsedLimit < 0) {
          console.error(`Error: --limit requires a non-negative integer.`);
          process.exit(1);
        }
        limit = parsedLimit;
      } else {
        console.error('Error: --limit flag requires a value.');
        process.exit(1);
      }
    } else if (flag === '--api-key' || flag === '-k') {
      if (i + 1 < args.length) {
        aiArgs.apiKey = args[++i];
      } else {
        console.error('Error: --api-key flag requires a value.');
        process.exit(1);
      }
    } else if (flag === '--provider' || flag === '-p') {
      if (i + 1 < args.length) {
        aiArgs.provider = args[++i];
      } else {
        console.error('Error: --provider flag requires a value.');
        process.exit(1);
      }
    } else if (flag === '--cloud-model') {
      if (i + 1 < args.length) {
        aiArgs.cloudModel = args[++i];
      } else {
        console.error('Error: --cloud-model flag requires a value.');
        process.exit(1);
      }
    } else if (!flag.startsWith('-')) {
      targetUrl = flag;
    }
  }

  // -------------------------------------------------------------------------
  // Usage / validation
  // -------------------------------------------------------------------------
  if (!targetUrl) {
    console.log('\n--- SpiderTester CLI ---');
    console.log('Usage: npx tsx backend/main.ts <url> [options]\n');
    console.log('Options:');
    console.log('  -m, --model <name>      Ollama model to use in local mode (default: qwen2.5-coder:7b)');
    console.log('  -l, --limit <num>       Max linked pages to test (default: 3)');
    console.log('  -k, --api-key <key>     Cloud provider API key — enables cloud AI mode');
    console.log('  -p, --provider <name>   Cloud provider: openai | gemini | anthropic  (default: openai)');
    console.log('      --cloud-model <m>   Override cloud model (uses provider default if omitted)');
    console.log('\nCloud model defaults:');
    console.log('  openai    → gpt-4o-mini');
    console.log('  gemini    → gemini-1.5-flash');
    console.log('  anthropic → claude-3-5-haiku-latest');
    console.log('\nExamples:');
    console.log('  npx tsx backend/main.ts https://example.com --limit 2');
    console.log('  npx tsx backend/main.ts https://example.com -k sk-... -p openai\n');
    process.exit(1);
  }

  try {
    new URL(targetUrl);
  } catch {
    console.error(`Error: Invalid URL format "${targetUrl}"`);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Resolve AI configuration
  // -------------------------------------------------------------------------
  console.log('\n--- SpiderTester ---');
  const aiConfig = selectAI(aiArgs);

  // -------------------------------------------------------------------------
  // Scrape the initial landing page
  // -------------------------------------------------------------------------
  const scraper = new WebScraperService();
  console.log(`\n[1/4] Scraping initial landing page: ${targetUrl}...`);

  let landingPageData;
  try {
    landingPageData = await scraper.extract(targetUrl);
  } catch (err: any) {
    console.error(`Failed to scrape landing page "${targetUrl}":`, err.message || err);
    process.exit(1);
  }

  // Compile the list of pages to test: landing page + linked pages up to limit
  const linkedPages = landingPageData.discoveredLinks.slice(0, limit);
  const allPagesToTest = [
    { url: targetUrl, data: landingPageData },
    ...linkedPages.map(url => ({ url, data: null as any })),
  ];

  console.log(`\nDiscovered ${landingPageData.discoveredLinks.length} internal link(s) on the landing page.`);
  if (linkedPages.length > 0) {
    console.log(`Selected the first ${linkedPages.length} linked page(s) based on --limit.`);
  }
  console.log(`Will generate test files for ${allPagesToTest.length} page(s):`);
  allPagesToTest.forEach((p, idx) => console.log(`  ${idx + 1}. ${p.url}`));

  // -------------------------------------------------------------------------
  // Process each page
  // -------------------------------------------------------------------------
  console.log(`\n[2/4] Processing pages & generating tests...`);
  const generatedTestPaths: string[] = [];

  for (let i = 0; i < allPagesToTest.length; i++) {
    const pageItem = allPagesToTest[i];
    console.log(`\n---------------------------------------------`);
    console.log(`[Page ${i + 1}/${allPagesToTest.length}] Target: ${pageItem.url}`);
    console.log(`---------------------------------------------`);

    // Scrape if we don't already have data (the landing page already has data)
    let pageData = pageItem.data;
    if (!pageData) {
      console.log(`Scraping context...`);
      try {
        pageData = await scraper.extract(pageItem.url);
      } catch (err: any) {
        console.error(`Failed to scrape page context:`, err.message || err);
        console.log(`Skipping this page.`);
        continue;
      }
    }

    const pageUrlObj = new URL(pageItem.url);
    const hostname = pageUrlObj.hostname.replace(/[^a-zA-Z0-9.-]/g, '_') || 'unknown';
    const testsDir = path.join(process.cwd(), 'tests');
    const targetDir = path.join(testsDir, hostname);
    let pageName = pageUrlObj.pathname.trim().replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9.-]/g, '_');
    if (!pageName) pageName = 'index';

    const pageObjectPath = path.join(targetDir, `${pageName}.page.ts`);
    const testPath = path.join(targetDir, `${pageName}.spec.ts`);

    // Generate the page object from the scraped page context first.
    const promptContext = formatContextForLLM(pageData);
    console.log(`Generating page object...`);
    let pageObjectCode = '';
    try {
      pageObjectCode = await callAI(buildPageObjectPrompt(promptContext, pageItem.url), aiConfig);
    } catch (err: any) {
      console.error(`Failed to generate page object for ${pageItem.url}:`, err.message || err);
      if (aiConfig.mode === 'local') {
        console.error('Tip: verify Ollama is running (`ollama serve`) and the model is pulled.');
      }
      console.log(`Skipping this page.`);
      continue;
    }

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`Created directory: ${targetDir}`);
      }

      fs.writeFileSync(pageObjectPath, pageObjectCode, 'utf8');
      console.log(`Saved page object: ${pageObjectPath}`);
    } catch (err: any) {
      console.error(`Failed to save page object for ${pageItem.url}:`, err.message || err);
      continue;
    }

    console.log(`Generating tests from page object...`);
    let testCode = '';
    try {
      testCode = await callAI(buildTestPrompt(pageObjectCode, `./${pageName}.page`), aiConfig);
    } catch (err: any) {
      console.error(`Failed to generate tests for ${pageItem.url}:`, err.message || err);
      if (aiConfig.mode === 'local') {
        console.error('Tip: verify Ollama is running (`ollama serve`) and the model is pulled.');
      }
      console.log(`Page object saved; skipping test generation for this page.`);
      continue;
    }

    console.log(`[3/4] Saving generated test suite...`);
    try {
      fs.writeFileSync(testPath, testCode, 'utf8');
      console.log(`Saved test suite: ${testPath}`);
      generatedTestPaths.push(testPath);
    } catch (err: any) {
      console.error(`Failed to save test file for ${pageItem.url}:`, err.message || err);
    }
  }

  if (generatedTestPaths.length > 0) {
    console.log(`\n[4/4] Running ${generatedTestPaths.length} generated test suite(s) with Playwright...`);
    const runId = new Date().toISOString().replace(/[:.]/g, '-') + `-${process.pid}`;
    const artifactsDir = path.join(path.dirname(generatedTestPaths[0]), 'artifacts', `run-${runId}`);
    const testExitCode = await runGeneratedTests(generatedTestPaths, artifactsDir);
    if (testExitCode !== 0) {
      console.error(`Playwright test run failed with exit code ${testExitCode}.`);
      process.exitCode = testExitCode;
    }
    console.log(`JUnit report: ${path.join(artifactsDir, 'junit.xml')}`);
    console.log(`Playwright traces: ${path.join(artifactsDir, 'playwright')}`);
  } else {
    console.log('\nNo generated test suites to run.');
  }

  console.log('\n=============================================');
  if (process.exitCode === undefined || process.exitCode === 0) {
    console.log(`🎉 ALL PROCESSES COMPLETED.`);
  } else {
    console.log('Generation completed with Playwright failures.');
  }
  console.log('=============================================\n');
}

main();