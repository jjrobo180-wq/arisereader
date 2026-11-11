// Arise To Duo for Windows and Linux: the web app (arisetodo.com/app) in its own window, with the
// sign-in kept between launches, links to other sites opened in the browser, a page when offline,
// and updates from GitHub Releases (.github/workflows/desktop-app.yml builds and publishes them).
const { app, BrowserWindow, Menu, shell, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");

const START = "https://arisetodo.com/app";
const HOME = /^https:\/\/(www\.)?arisetodo\.com(\/|$)/i;
// Sign-in and checkout pages the app sends you to stay in the window, so you come back signed in.
const ALSO_INSIDE = /^https:\/\/(accounts\.google\.com|appleid\.apple\.com|checkout\.stripe\.com|billing\.stripe\.com|[a-z0-9-]+\.supabase\.co)(\/|$)/i;
const STATE = path.join(app.getPath("userData"), "window.json");

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { width: 1280, height: 820 }; } };
const saveState = () => {
  if (!win || win.isDestroyed()) return;
  try { fs.writeFileSync(STATE, JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch { /* not kept */ }
};

function createWindow() {
  const s = readState();
  win = new BrowserWindow({
    x: s.x, y: s.y, width: s.width || 1280, height: s.height || 820, minWidth: 380, minHeight: 560,
    title: "Arise To Duo", icon: path.join(__dirname, "build", "icon.png"), show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#15131f" : "#ffffff", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  if (s.max) win.maximize();
  win.once("ready-to-show", () => win.show());
  ["resize", "move", "close"].forEach((e) => win.on(e, saveState));

  // Only Arise To Duo opens inside the app; everything else opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (HOME.test(url)) { win.loadURL(url); return { action: "deny" }; }
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!HOME.test(url) && !ALSO_INSIDE.test(url) && !url.startsWith("file:")) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMain) => {
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, "offline.html"), { query: { retry: url || START } });
  });
  win.loadURL(START);
}

const menu = Menu.buildFromTemplate([
  { label: "Arise To Duo", submenu: [
    { label: "Home", accelerator: "CmdOrCtrl+H", click: () => win && win.loadURL(START) },
    { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => win && win.reload() },
    { type: "separator" },
    { label: "Check for updates", click: () => checkUpdates(true) },
    { type: "separator" },
    { role: "quit" },
  ] },
  { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
  { label: "View", submenu: [{ role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }, { type: "separator" }, { role: "togglefullscreen" }] },
  { label: "Help", submenu: [{ label: "Support", click: () => shell.openExternal("https://arisetodo.com/support") }] },
]);

function checkUpdates(manual) {
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    (manual ? autoUpdater.checkForUpdatesAndNotify() : autoUpdater.checkForUpdatesAndNotify()).catch(() => {});
  } catch { /* updates aren't set up in a dev run */ }
}

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(menu);
  createWindow();
  if (app.isPackaged) setTimeout(() => checkUpdates(false), 5000);
});
app.on("window-all-closed", () => app.quit());
