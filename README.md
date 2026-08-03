# SpiderTester Electron UI

## Overview

SpiderTester is an HTML Scraper and Local AI Test Suite Generator. It leverages Electron for a desktop application experience and integrates with various backend services to generate and execute tests based on provided URLs.

## Project Structure

- **Electron-related files:**
  - `electron-main.js`: The main entry point for the Electron application.
  - `frontend/`: Contains all frontend files, including HTML, CSS, and JavaScript.
    - `index.html`: Main HTML file for the UI.
    - `preload.js`: Preload script for Electron context bridge.
    - `renderer.js`: Frontend logic handling user interactions.
    - `style.css`: Stylesheets for the application.

- **Backend-related files:**
  - `backend/`: Contains backend logic, including accessibility checks and AI model interactions.
    - `accessibility.ts`: Handles accessibility tree generation.
    - `ai-selector.ts`, `formatter.ts`, `generator.ts`, `main.ts`, `scraper.ts`: Various backend modules for different functionalities.

- **Configuration and build-related files:**
  - `config.yaml`: Configuration for AI models and context retrieval.
  - `.continueignore`: Ignore rules for the project's build artifacts and dependencies.
  - `package.json`: Project metadata and dependencies.
  - `tsconfig.json`: TypeScript configuration.

## Command Line Functionality

SpiderTester also supports a direct CLI entrypoint in `backend/main.ts` for generating tests from a target URL without the Electron UI.

### Usage

```sh
npx tsx backend/main.ts <url> [options]
```

The positional argument is the target URL to scrape and test. It must be a valid URL.

### Options

- `-m, --model <name>`: Ollama model to use in local mode. Default: `qwen2.5-coder:7b`
- `-l, --limit <num>`: Maximum number of linked pages to test. Default: `3` (must be a non-negative integer)
- `-k, --api-key <key>`: Cloud provider API key; enables cloud AI mode
- `-p, --provider <name>`: Cloud provider to use. Accepted values: `openai | gemini | anthropic`. Default: `openai`
- `--cloud-model <model>`: Override the default cloud model for the selected provider

### Cloud model defaults

- `openai` → `gpt-4o-mini`
- `gemini` → `gemini-1.5-flash`
- `anthropic` → `claude-3-5-haiku-latest`

### Examples

```sh
npx tsx backend/main.ts https://example.com --limit 2
npx tsx backend/main.ts https://example.com -k sk-... -p openai
npx tsx backend/main.ts https://example.com --model qwen2.5-coder:7b
```

## Electron Functionality

### Main Window

The main window is initialized in `electron-main.js`:

```javascript
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 800,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, 'frontend', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));
}
```

### Frontend UI

The frontend is built using HTML and JavaScript:

- **Index Page (`frontend/index.html`):**
  - Contains the main form for entering URLs and flags.
  - Displays the status of the test execution.

- **Preload Script (`frontend/preload.js`):**
  - Exposes IPC (Inter-Process Communication) functions to the renderer process.

- **Renderer Script (`frontend/renderer.js`):**
  - Handles user interactions, such as adding flags and running tests.
  - Sends data to the backend through IPC.

### Backend Integration

The backend logic is handled in TypeScript files under `backend/`. For example:

- **Accessibility Check (`backend/accessibility.ts`):**
  ```typescript
  async function getAccessibilityTree(page: Page): Promise<any> { ... }
  ```
  This function checks the accessibility of a webpage.

## Usage

1. **Clone the Repository:**
   ```sh
   git clone <repository-url>
   cd spidertester
   ```

2. **Install Dependencies:**
   ```sh
   npm install
   ```

3. **Run the Application:**
   ```sh
   npm start
   ```

4. **Use the UI:**
   - Enter a URL in the input field.
   - Add any optional flags if needed.
   - Click "Run SpiderTester" to execute the tests.

## Contributing

To contribute to this project, follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Implement changes and commit them.
4. Push your changes to your fork.
5. Open a pull request to the main repository.

Feel free to open issues if you encounter any bugs or have suggestions for improvements!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.