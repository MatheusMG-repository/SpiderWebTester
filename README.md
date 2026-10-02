# SpiderTester

SpiderTester is a browser-based test generation tool that scrapes a website, gathers page context, and uses AI to generate Playwright test files for that site.

The project has two main ways to work with it:

- An Electron desktop app for a guided UI workflow
- A TypeScript CLI for generating tests directly from a command line

## What it does

1. Takes a target URL
2. Scrapes the landing page and related linked pages
3. Builds a prompt from the scraped page context
4. Sends that context to a selected AI provider or local Ollama model
5. Generates a page object from the scraped context, then generates Playwright tests from that page object
6. Saves the page object and spec together under the hostname-based `tests/` folder

## Project structure

- `backend/` — scraping, AI selection, formatting, and CLI generation logic
- `frontend/` — Electron UI files
- `electron-main.js` — Electron app entry point
- `tests/` — generated Playwright test files
- `package.json` — project scripts and dependencies

## Getting started

### 1. Install dependencies

```sh
npm install
```

### 2. Run the Electron app

```sh
npm start
```

This opens the desktop UI where you can enter a URL and run the workflow from the application.

## Command-line usage

If you want to generate tests without the UI, run the CLI directly:

```sh
npx tsx backend/main.ts <url> [options]
```

### Supported options

- `-m, --model <name>`: Ollama model to use in local mode. Default: `qwen2.5-coder:7b`
- `-l, --limit <num>`: Maximum number of linked pages to test. Default: `3`
- `-k, --api-key <key>`: Cloud provider API key; enables cloud AI mode
- `-p, --provider <name>`: Cloud provider. Supported values: `openai | gemini | anthropic`. Default: `openai`
- `--cloud-model <model>`: Override the default cloud model for the chosen provider

### Provider defaults

- `openai` → `gpt-4o-mini`
- `gemini` → `gemini-1.5-flash`
- `anthropic` → `claude-3-5-haiku-latest`

## Running generated tests

After generating specs, SpiderTester automatically runs those specs with Playwright. To rerun all generated specs later, use:

```sh
npm run test:generated
```

Each automatic run gets a unique artifact directory beside its generated specs: `tests/<hostname>/artifacts/run-<timestamp>/`. It contains `junit.xml` and a `playwright/` directory with test output and failure traces. Manual reruns also use a unique artifact directory.

## GitHub Actions

The `Generated Playwright Tests` workflow runs all committed specs on pushes and pull requests that change tests. To run a specific website folder, start the workflow manually and set `test_folder` to a path such as `tests/example.com`. Generated `*.spec.ts` and `*.page.ts` files can be committed; run artifacts remain ignored. JUnit reports and traces are uploaded as a workflow artifact for 14 days.

### Examples

```sh
npx tsx backend/main.ts https://example.com
npx tsx backend/main.ts https://example.com --limit 2
npx tsx backend/main.ts https://example.com -k sk-... -p openai
npx tsx backend/main.ts https://example.com --model qwen2.5-coder:7b
```

## Notes

- The app works in local mode using Ollama and a model such as `qwen2.5-coder:7b`.
- Cloud mode is enabled when an API key is provided.
- Generated page objects (`*.page.ts`) and test files (`*.spec.ts`) are saved together under a hostname-based folder inside `tests/`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the relevant checks
5. Open a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.