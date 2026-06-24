# Design Copilot — backend

A ~70-line Node server (no dependencies) that does two jobs:

1. Serves the prototype app at `http://localhost:3000`
2. Proxies `POST /api/chat` to the OpenAI API, attaching your secret key **server-side** so it never reaches the browser.

## One-time setup

1. Get an API key: https://platform.openai.com/ → **API keys**
2. Copy `.env.example` to `.env` in this folder and paste your key:

   ```
   OPENAI_API_KEY=sk-...
   ```

## Run

From the project root:

```bash
node server/server.js
```

Then open **http://localhost:3000** and click the **✦ Assistant** button (bottom-right).

## How it fits together

```
Browser (prototype/ai.js)
   │  builds the conversation + tool definitions
   │  POST /api/chat  ────────────────►  server.js  ──►  api.openai.com
   │                                       (adds Bearer key)      /v1/chat/completions
   ◄── reply (content / tool_calls) ───────┘
   │  runs the tool against window.Cabinet.*  (edits the live design)
   └─ sends tool result back, loops until the model returns a final answer
```

The agent's tools are defined in `prototype/ai.js`; each maps to a function exposed on
`window.Cabinet` in `prototype/app.js`. To add a new "skill", add a tool there and a matching
`window.Cabinet` method — no server change needed.

## Model

Defaults to `o3-mini` (OpenAI reasoning model — strong multi-step tool routing, low cost).
Change `AI_MODEL` at the top of `prototype/ai.js` to use another model
(e.g. `gpt-4o` for vision/cheaper chat, or `o3` for the hardest reasoning).
