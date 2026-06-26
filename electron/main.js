'use strict';
/* Electron main process — desktop demo for the Cabinet & Cupboard Cut List.
   - Serves the untouched ../prototype over 127.0.0.1 via the in-process proxy-server.
   - AI copilot uses Bring-Your-Own-Key (entered via menu "AI → Set API Key…"), stored encrypted locally.
   - Core (design, cut list, 3D, BOM, export) works fully offline with no key. */
const { app, BrowserWindow, Menu, ipcMain, safeStorage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { start } = require('./proxy-server');

const ICON_PNG = path.join(__dirname, 'build', 'icon.png');

// prototype/ is bundled as an extraResource when packaged; loaded directly in dev.
const PROTOTYPE_DIR = app.isPackaged ? path.join(process.resourcesPath, 'prototype') : path.join(__dirname, '..', 'prototype');
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

let win = null;
let port = 0;

// ---------- Bring-Your-Own-Key storage (encrypted when the OS supports it) ----------
function readKey() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (raw.keyEnc && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(raw.keyEnc, 'base64'));
    return raw.key || '';
  } catch { return ''; }
}
function writeKey(key) {
  const data = {};
  key = String(key || '').trim();
  if (key && safeStorage.isEncryptionAvailable()) data.keyEnc = safeStorage.encryptString(key).toString('base64');
  else if (key) data.key = key;
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(data)); } catch { /* ignore */ }
}

// ---------- Windows ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 980, minHeight: 640,
    backgroundColor: '#1e2127',
    title: 'Cabinet & Cupboard Cut List',
    icon: ICON_PNG,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(`http://127.0.0.1:${port}/`);
}

function openKeyDialog() {
  const w = new BrowserWindow({
    width: 480, height: 260, parent: win || undefined, modal: true, resizable: false,
    backgroundColor: '#272b33', title: 'OpenAI API Key',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  w.removeMenu();
  w.loadFile(path.join(__dirname, 'settings.html'));
}

ipcMain.handle('get-key-status', () => (readKey() ? 'set' : ''));
ipcMain.handle('save-key', (_e, key) => { writeKey(key); return true; });

function showAbout() {
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'About Cabinet Cut List',
    message: 'Cabinet & Cupboard Cut List',
    detail: `Desktop demo · v${app.getVersion()}\n\n`
      + 'Offline parametric cabinet design — 2D/3D, cut list, sheet nesting, BOM, CSV/PDF export.\n'
      + 'AI copilot uses your own OpenAI key (menu: AI → Set API Key…). No key is bundled with the app.\n\n'
      + '© Kybernete',
    buttons: ['OK'],
    icon: ICON_PNG,
    noLink: true,
  });
}

function buildMenu() {
  const template = [
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'AI', submenu: [
      { label: 'Set API Key…', accelerator: 'CmdOrCtrl+K', click: openKeyDialog },
    ] },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    { role: 'window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] },
    { label: 'Help', submenu: [
      { label: 'About', click: showAbout },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  ({ port } = await start({ rootDir: PROTOTYPE_DIR, getKey: readKey }));
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
