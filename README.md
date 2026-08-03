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
5. Saves generated Playwright specs in the `tests/` folder

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
- Generated test files are saved under a hostname-based folder inside `tests/`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the relevant checks
5. Open a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.