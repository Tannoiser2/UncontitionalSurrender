import { build } from "esbuild";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const ELECTRON_SRC = path.join(root, "node_modules/electron/dist/Electron.app");
const APP_OUT = path.join(__dirname, "release/mac-arm64/Unconditional Surrender.app");

console.log("📦 Building shared package...");
execSync("npx yarn workspace @uswc/shared build", { cwd: root, stdio: "inherit" });

console.log("🎨 Building frontend...");
execSync("npx yarn workspace @uswc/frontend build", { cwd: root, stdio: "inherit" });

console.log("⚡ Bundling Electron main process...");
await build({
  entryPoints: [path.join(__dirname, "src/main.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: path.join(__dirname, "dist/main.js"),
  external: ["electron"],
  define: { "process.env.NODE_ENV": '"production"' },
  sourcemap: true,
});

console.log("🖥️ Bundling backend server...");
await build({
  entryPoints: [path.join(root, "packages/backend/src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: path.join(__dirname, "dist/backend.js"),
  external: ["electron"],
  define: { "process.env.NODE_ENV": '"production"' },
  sourcemap: true,
});

console.log("📁 Copying frontend dist...");
const frontendDist = path.join(root, "packages/frontend/dist");
fs.rmSync(path.join(__dirname, "dist/frontend"), { recursive: true, force: true });
fs.cpSync(frontendDist, path.join(__dirname, "dist/frontend"), { recursive: true });

console.log("📦 Assembling .app bundle...");
fs.rmSync(APP_OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(APP_OUT, "Contents/MacOS"), { recursive: true });
fs.mkdirSync(path.join(APP_OUT, "Contents/Resources/app"), { recursive: true });

// Copy Electron.app dereferencing symlinks (-L) without extended attributes
// rsync -rL follows symlinks and doesn't copy xattrs (unlike cp -LR)
const electronDst = path.join(APP_OUT, "Contents/Resources/Electron.app");
fs.mkdirSync(electronDst, { recursive: true });
execSync(`rsync -rL --no-perms "${ELECTRON_SRC}/" "${electronDst}/"`);

// Copy compiled C launcher binary (clang already adds adhoc linker signature)
const launcherSrc = path.join(__dirname, "launcher");
const launcherDst = path.join(APP_OUT, "Contents/MacOS/Unconditional Surrender");
fs.copyFileSync(launcherSrc, launcherDst);
fs.chmodSync(launcherDst, 0o755);

// Copy compiled app files
fs.cpSync(path.join(__dirname, "dist"), path.join(APP_OUT, "Contents/Resources/app"), { recursive: true });
fs.writeFileSync(
  path.join(APP_OUT, "Contents/Resources/app/package.json"),
  JSON.stringify({ name: "unconditional-surrender", version: "0.1.0", main: "main.js" }, null, 2)
);

// Write Info.plist
const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key><string>Unconditional Surrender</string>
  <key>CFBundleExecutable</key><string>Unconditional Surrender</string>
  <key>CFBundleIdentifier</key><string>com.uswc.unconditional-surrender</string>
  <key>CFBundleName</key><string>Unconditional Surrender</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.games</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
`;
fs.writeFileSync(path.join(APP_OUT, "Contents/Info.plist"), infoPlist);

// Remove quarantine/extended attrs
execSync(`xattr -cr "${APP_OUT}"`);

console.log(`✅ App ready → packages/electron/release/mac-arm64/Unconditional Surrender.app`);
