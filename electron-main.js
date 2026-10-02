const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('run-spidertester', async (_event, payload) => {
  const url = String(payload?.url || '').trim();
  const flags = Array.isArray(payload?.flags) ? payload.flags : [];

  if (!url) {
    return {
      ok: false,
      message: 'Please provide a valid URL before starting the test generation.',
      logs: '',
    };
  }

  const args = [
    path.join(app.getAppPath(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'backend/main.ts',
    url,
  ];

  flags.forEach(({ flag, value }) => {
    if (!flag) {
      return;
    }

    const cleanedFlag = String(flag).trim();
    if (!cleanedFlag) {
      return;
    }

    args.push(cleanedFlag);

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      args.push(String(value).trim());
    }
  });

  const command = process.env.npm_node_execpath || 'node';

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: app.getAppPath(),
      shell: false,
      env: process.env,
    });

    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        message: `Failed to start SpiderTester: ${error.message}`,
        logs: output || error.message,
      });
    });

    child.on('close', (code) => {
      const trimmedOutput = output.trim();

      if (code === 0) {
        resolve({
          ok: true,
          message: 'SpiderTester completed successfully.',
          logs: trimmedOutput || 'Backend finished without additional output.',
        });
      } else {
        resolve({
          ok: false,
          message: `SpiderTester failed with exit code ${code}.`,
          logs: trimmedOutput || 'Backend reported an error without additional output.',
        });
      }
    });
  });
});
