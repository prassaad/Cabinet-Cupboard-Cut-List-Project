# Cabinet Cut List — Desktop demo (Electron)

A **zero-deployment-dependency** desktop build of the prototype for showing leads. It wraps the existing
`../prototype` **without modifying it**: the design tool, 2D/3D, cut list, sheet nesting, BOM and CSV/PDF
export all run **fully offline**. The AI copilot is **bring-your-own-key (BYOK)**.

## How it works
```
Electron main (main.js)
  ├─ starts an in-process server (proxy-server.js) on 127.0.0.1:<random>
  │     • serves ../prototype  (so the app loads unchanged)
  │     • POST /api/chat → OpenAI, using the locally-stored BYOK key
  └─ opens a window at http://127.0.0.1:<port>/
```
No external server, no cloud, no React build. The only network traffic is to OpenAI **if** the user adds a key
and uses the assistant.

## Run in development
From this `electron/` folder:
```bash
npm install
npm start
```
(Node 18+; `npm install` downloads Electron, ~200 MB the first time.)

## Build a downloadable for leads
```bash
npm run dist            # portable .exe + NSIS installer  → dist/
# or just the portable, no installer:
npm run dist:portable   # dist/CabinetCutList-Demo-0.1.0-portable.exe
```
Hand the **portable `.exe`** to a lead — they double-click it, no install, no admin, no setup.

## AI (optional, BYOK)
In the app menu: **AI → Set API Key…** — paste an OpenAI key. It's stored **encrypted** in the OS user-data
folder (via Electron `safeStorage`) and sent **directly** to OpenAI. It is never bundled into the app.
Without a key, the assistant just says "add your key"; everything else works normally.

## App icon
`build/icon.ico` / `build/icon.png` are generated (gold cabinet glyph). To regenerate after tweaking the design:
```bash
node build/make-icon.js
```
electron-builder picks up `build/icon.ico` automatically for the `.exe`; the runtime window uses `build/icon.png`.

## Menu
**File** (Quit) · **AI** (Set API Key…, Ctrl+K) · **View** (reload / zoom / fullscreen / devtools) ·
**Window** · **Help** (About).

## Notes
- **Unsigned build** triggers Windows SmartScreen ("More info → Run anyway"). Fine for demos; add a
  code-signing certificate later to remove it.
- `../prototype` and `../server` are **untouched** — this folder is a self-contained wrapper.
- The old `../server` (localhost proxy for the browser version) is **not used** by the desktop build.
