---
title: "ARCH-002 — Deployment & Packaging (Electron thick client + thin cloud)"
phase: 06_architecture
created: 2026-06-26
updated: 2026-06-26
version: 1.2
status: D1+D2 IMPLEMENTED — Electron wrapper in /electron (offline core + BYOK AI, app icon, About/menu). Packaging (.exe) pending `npm run dist`.
related:
  - phase 6 06-architecture/ARCH-001_job-module-component-architecture_2026-06-25.md
  - phase 1-2 02-elicitation/session-notes/NOTES-002_Client-Review_2026-06-25.md
  - prototype/app.js
  - prototype/ai.js
  - server/server.js
---

# ARCH-002 — Deployment & Packaging

**Goal:** decide how the product ships. Strategy: **thick client (UI runs locally) + thin cloud (APIs/DB only)**,
packaged with **Electron**. Immediate need: a **downloadable demo for leads with no deployment dependency**.

> Architecture/plan document. No code changes. Build deferred.

---

## 1. TL;DR
- The UI is **zero-dependency vanilla HTML/CSS/JS** → Electron loads `index.html` directly, **no React/bundler/build**. This is the "avoid React deployment cost" win.
- **Demo = feasible and easy.** Everything impressive (design, 2D/3D, cut list, sheet nesting, BOM, CSV/PDF) is **client-side and offline**. Only the AI copilot needs network.
- **Demo AI decision (locked): bring-your-own-key** — the prospect pastes their own OpenAI key (stored locally). No embedded key, no cloud of ours, no deployment dependency.
- Ship the demo as a **portable Windows `.exe`** (double-click, no install/admin). Effort ≈ half a day.

---

## 2. Architecture: thick client + thin cloud

| Layer | Runs where | Demo build | Production |
|---|---|---|---|
| UI — sizes, components, 2D/3D, cut list, nesting, BOM, export | client (Electron renderer) | **100% offline** | offline-capable |
| AI copilot (LLM) | needs a key | **bring-your-own-key** (local) | cloud proxy (key server-side) |
| Jobs/DB, auth, pricing catalogs, licensing, updates | cloud | not used | cloud APIs/DB |

**Why it holds up:** the heavy, valuable compute (parametric design + nesting + BOM) is deterministic JS that never needs a server. The cloud only ever carries **data and the AI key** — cheap to host, nothing to render server-side.

---

## 3. The demo — zero-dependency downloadable
- **Core**: fully offline. Persistence via `localStorage` (or a local JSON file through Electron `fs`). **No DB.**
- **AI = bring-your-own-key (BYOK)**:
  - Add a small **Settings → OpenAI key** field; store locally (Electron `safeStorage`/file, not in the bundle).
  - The AI call goes **renderer → Electron main (IPC) → api.openai.com** with the user's key. No localhost server, no CORS.
  - If no key is entered, the copilot shows a friendly "add your key to enable AI" state; **the rest of the app works normally**.
- **Distribution**: a **portable `.exe`** (no installer) is simplest for leads; an NSIS installer is optional later.

### Security note (critical)
**Never embed a real OpenAI key in a downloadable** — Electron apps are unpacked JS; the key is trivially extractable. BYOK avoids this entirely. (The alternative "hosted proxy" keeps our key server-side but reintroduces a cloud dependency + cost — rejected for the demo.)

---

## 4. What changes from the current code (contained; no design-logic changes)
1. Add `electron/main.js` — a `BrowserWindow` that loads `prototype/index.html`.
2. Add root `package.json` + **electron-builder** config → builds a Windows `.exe` (portable + optional NSIS).
3. Replace the localhost `server.js` proxy with an **IPC handler** in the Electron main process that forwards to OpenAI using the **user-entered** key (BYOK). For a pure-offline build, AI can be omitted.
4. Add a **Settings panel** for the BYOK field.
- The prototype's design/cut-list/3D/BOM code is **untouched** — Electron is a wrapper.

---

## 5. Gotchas / decisions
- **SmartScreen** warns on unsigned Windows apps ("More info → Run anyway"). Fine for a demo; a **code-signing cert** (~$200–400/yr) removes it. macOS needs **notarization**.
- **Bundle size**: Electron ships Chromium → ~80–120 MB. Acceptable for desktop. Lighter alternative: **Tauri** (OS webview, ~5–10 MB) — but adds a Rust toolchain and webview-compat testing.
- **Auto-update** (later): needs a release host (e.g., GitHub Releases) — not required for a one-off demo.
- **Independent of ARCH-001**: the wrapper packages whatever the app is today, so it does not block or conflict with the Job▸Module▸Component refactor.

---

## 6. Effort & roadmap

| Phase | Deliverable | Effort |
|---|---|---|
| D1 | Portable `.exe` of current app, **offline core** + **BYOK AI** via IPC | ~0.5 day |
| D2 | Settings panel polish, app icon, window menu, local-file Save/Open | ~0.5 day |
| D3 | NSIS installer + code signing (remove SmartScreen) | cert lead-time |
| D4 | Auto-update channel (GitHub Releases) | later |
| D5 | Production wiring: cloud APIs/DB for jobs, auth, hosted AI proxy | with ARCH-001 |

---

## 7. Recommendation
Proceed (when ready) with **D1**: a portable Windows `.exe` of the current prototype, **offline core**, **AI via BYOK**.
It gives sales a credible, dependency-free downloadable demo with zero hosting, and it is fully compatible with the
ARCH-001 hierarchy work that follows.

---

## Version history
- **v1.2 (2026-06-26)** — D2 polish: generated app icon (`build/make-icon.js` → `icon.ico`/`icon.png`, pure-Node PNG/ICO
  encoder, validated 256×256), wired window icon, added **About** dialog and tidied the menu (File / AI / View / Window /
  Help). `package.json` references `build/icon.ico` (exe + NSIS installer/uninstaller icons).
- **v1.1 (2026-06-26)** — D1 implemented in `/electron` (separate folder; `prototype/` and `server/` untouched):
  `main.js` (window + menu + BYOK key storage via `safeStorage`), `proxy-server.js` (in-process 127.0.0.1 static
  server + OpenAI proxy, smoke-tested), `preload.js` + `settings.html/js` (BYOK key dialog), `package.json`
  (electron + electron-builder, portable + NSIS targets, bundles `../prototype` as extraResource). Verified: all JS
  syntax-checks; server serves the prototype and returns the no-key message. Pending: `npm install` + `npm run dist`
  to emit the portable `.exe` (cannot run a GUI build in this environment).
- **v1.0 (2026-06-26)** — Initial deployment/packaging plan. Chose Electron thick-client + thin-cloud; demo as portable
  `.exe` with offline core and **bring-your-own-key** AI (no embedded key). Documented gotchas (signing, size, Tauri
  alternative) and a 5-step packaging roadmap. Implementation deferred.
