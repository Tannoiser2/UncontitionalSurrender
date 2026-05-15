import { app, BrowserWindow, dialog, protocol, net } from "electron";
import { fork, ChildProcess } from "child_process";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";
import { pathToFileURL } from "url";

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

const BACKEND_PORT = 3001;

function waitForPort(port: number, timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
          res.resume();
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(500, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Port ${port} not ready after ${timeout}ms`));
        return;
      }
      setTimeout(check, 250);
    };
    check();
  });
}

function isPortAlreadyUp(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackend(): Promise<void> {
  const alreadyUp = await isPortAlreadyUp(BACKEND_PORT);
  if (alreadyUp) {
    console.log("ℹ️ Backend already running on port", BACKEND_PORT);
    return;
  }

  const backendPath = path.join(__dirname, "backend.js");
  if (!fs.existsSync(backendPath)) {
    throw new Error(`Backend not found at: ${backendPath}`);
  }

  const dataDir = path.join(app.getPath("documents"), "Unconditional Surrender");
  fs.mkdirSync(dataDir, { recursive: true });

  backendProcess = fork(backendPath, [], {
    env: { ...process.env, PORT: String(BACKEND_PORT), USWC_DATA_DIR: dataDir },
    silent: true,
  });

  backendProcess.stdout?.on("data", (d) => console.log("[backend]", d.toString().trim()));
  backendProcess.stderr?.on("data", (d) => console.error("[backend]", d.toString().trim()));
  backendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) console.error(`Backend exited with code ${code}`);
  });

  await waitForPort(BACKEND_PORT);
  console.log("✅ Backend ready");
}

function registerFrontendProtocol(): void {
  const frontendDist = path.join(__dirname, "frontend");

  // Register app:// protocol to serve frontend static files
  protocol.handle("app", (request) => {
    let urlPath = new URL(request.url).pathname;
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

    const filePath = path.join(frontendDist, urlPath);

    // Serve index.html for all non-file routes (SPA fallback)
    const resolved = fs.existsSync(filePath) ? filePath : path.join(frontendDist, "index.html");
    return net.fetch(pathToFileURL(resolved).toString());
  });

  console.log("✅ Frontend protocol registered (app://)");
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Unconditional Surrender",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`Failed to load ${url}: ${code} ${desc}`);
  });

  // Load from app:// protocol — no external HTTP server needed
  mainWindow.loadURL("app://./index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Register protocol before app is ready (required by Electron)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(async () => {
  try {
    registerFrontendProtocol();
    await startBackend();
    createWindow();
  } catch (err) {
    console.error("Startup error:", err);
    dialog.showErrorBox(
      "Errore di avvio",
      `Impossibile avviare il gioco:\n${(err as Error).message}`
    );
    app.quit();
  }
});

function quitClean(): void {
  backendProcess?.kill();
  backendProcess = null;
  app.quit();
}

app.on("window-all-closed", quitClean);

app.on("before-quit", () => {
  backendProcess?.kill();
  backendProcess = null;
});
