const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let backendProcess = null;

// Paths depend on whether we're in development or packaged
const isDev = !app.isPackaged;
const resourcesPath = isDev
  ? path.join(__dirname, '..')
  : process.resourcesPath;

const backendPath = isDev
  ? path.join(resourcesPath, 'backend', 'dist', 'backend')
  : path.join(resourcesPath, 'backend');

const ffmpegPath = isDev
  ? path.join(__dirname, 'bin', 'ffmpeg')
  : path.join(resourcesPath, 'bin', 'ffmpeg');

const frontendPath = isDev
  ? path.join(resourcesPath, 'frontend', 'dist', 'index.html')
  : path.join(resourcesPath, 'dist', 'index.html');

const cacheDir = path.join(
  app.getPath('home'),
  'Library',
  'Caches',
  'vertaalapp'
);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Vertaalapp',
    backgroundColor: '#E0E5EC',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Show loading page while backend starts
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getLoadingHTML())}`);

  // Block navigation to external URLs (XSS protection)
  mainWindow.webContents.on('will-navigate', (e) => { e.preventDefault(); });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  // Ensure cache directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

  const env = {
    ...process.env,
    FFMPEG_PATH: ffmpegPath,
    HF_HOME: cacheDir,
    TRANSFORMERS_CACHE: path.join(cacheDir, 'hub'),
  };

  console.log('[Electron] Starting backend...');
  if (isDev) {
    console.log('[Electron] Backend path:', backendPath);
    console.log('[Electron] FFMPEG_PATH:', ffmpegPath);
    console.log('[Electron] HF_HOME:', cacheDir);
  }

  backendProcess = spawn(backendPath, [], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend] ${data.toString().trim()}`);
  });

  backendProcess.on('error', (err) => {
    console.error('[Electron] Failed to start backend:', err.message);
    if (mainWindow) {
      mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(getErrorHTML(err.message))}`
      );
    }
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`[Electron] Backend exited with code ${code}, signal ${signal}`);
    backendProcess = null;
  });
}

function pollHealth(retries = 90) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;

      // Check if backend process died
      if (!backendProcess) {
        reject(new Error('Backend process crashed tijdens opstarten'));
        return;
      }

      const req = http.get('http://127.0.0.1:8001/health', (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`[Electron] Backend healthy after ${attempts} attempts (${attempts}s)`);
            resolve();
          } else if (attempts < retries) {
            setTimeout(check, 1000);
          } else {
            reject(new Error(`Backend niet gezond na ${retries} seconden`));
          }
        });
      });

      req.on('error', () => {
        if (attempts < retries) {
          setTimeout(check, 1000);
        } else {
          reject(new Error(`Backend niet bereikbaar na ${retries} seconden. Herstart de app.`));
        }
      });

      req.end();
    };

    check();
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[Electron] Stopping backend...');
    backendProcess.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    const killTimer = setTimeout(() => {
      if (backendProcess) {
        console.log('[Electron] Force killing backend...');
        backendProcess.kill('SIGKILL');
      }
    }, 5000);

    backendProcess.on('exit', () => {
      clearTimeout(killTimer);
      backendProcess = null;
    });
  }
}

// Crash handlers
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Electron] Unhandled rejection:', reason);
});

// App lifecycle
app.on('ready', async () => {
  app.setAboutPanelOptions({
    applicationName: 'Vertaalapp',
    applicationVersion: '1.0.0',
    copyright: 'Copyright © 2026 Manava',
    website: 'https://www.manava.nl',
    credits: 'Real-time spraakvertaling voor de gezondheidszorg.\nAlle vertalingen draaien lokaal — geen cloud, geen data-opslag.',
  });

  createWindow();
  startBackend();

  try {
    await pollHealth();
    if (mainWindow) {
      console.log('[Electron] Loading frontend:', frontendPath);
      mainWindow.loadFile(frontendPath);
    }
  } catch (err) {
    console.error('[Electron] Backend failed to start:', err.message);
    if (mainWindow) {
      mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(getErrorHTML(err.message))}`
      );
    }
  }
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Loading HTML — Neumorphism style
function getLoadingHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      background: #E0E5EC;
      color: #3D4852;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      -webkit-app-region: drag;
    }
    .container {
      text-align: center;
      background: #E0E5EC;
      border-radius: 32px;
      box-shadow: 9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5);
      padding: 48px 44px;
    }
    h1 {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #3D4852;
      margin-bottom: 12px;
    }
    p {
      font-size: 14px;
      font-weight: 500;
      color: #6B7280;
      margin-bottom: 28px;
    }
    .progress-track {
      width: 200px;
      height: 6px;
      border-radius: 9999px;
      background: #E0E5EC;
      box-shadow: inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5);
      margin: 0 auto 16px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      width: 0%;
      border-radius: 9999px;
      background: linear-gradient(90deg, #6C63FF, #38B2AC);
      transition: width 1s linear;
    }
    .timer {
      font-size: 12px;
      font-weight: 500;
      color: #9CA3AF;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Vertaalapp</h1>
    <p>Vertaalengine wordt voorbereid...</p>
    <div class="progress-track"><div class="progress-bar" id="bar"></div></div>
    <div class="timer" id="timer"></div>
  </div>
  <script>
    const EXPECTED = 70;
    let elapsed = 0;
    const bar = document.getElementById('bar');
    const timer = document.getElementById('timer');
    setInterval(() => {
      elapsed++;
      const pct = Math.min(95, (elapsed / EXPECTED) * 100);
      bar.style.width = pct + '%';
      if (elapsed < EXPECTED) {
        timer.textContent = 'Nog even geduld — dit duurt ongeveer ' + (EXPECTED - elapsed) + ' seconden';
      } else {
        timer.textContent = 'Bijna klaar...';
      }
    }, 1000);
  </script>
</body>
</html>`;
}

function getErrorHTML(message) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      background: #E0E5EC;
      color: #3D4852;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      -webkit-app-region: drag;
    }
    .container {
      text-align: center;
      max-width: 420px;
      background: #E0E5EC;
      border-radius: 32px;
      box-shadow: 9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5);
      padding: 40px 32px;
    }
    h1 {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #E53E3E;
      margin-bottom: 16px;
      letter-spacing: -0.3px;
    }
    p { font-size: 14px; font-weight: 500; line-height: 1.7; color: #6B7280; }
    code {
      display: block; margin-top: 20px; padding: 16px;
      background: #E0E5EC;
      border-radius: 16px;
      box-shadow: inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5);
      font-size: 12px; font-weight: 500;
      color: #E53E3E; word-break: break-all; text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Fout</h1>
    <p>De backend kon niet worden gestart.</p>
    <code>${message}</code>
  </div>
</body>
</html>`;
}
