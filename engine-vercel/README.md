# WallView Engine — Vercel deployment

The cut-list engine as **serverless functions**. It runs the real designer `app.js`
headless (via `lib/load.js`) behind three endpoints. The PHP API is the only caller;
browsers never touch this service.

| Route      | Method | Purpose                                  |
|------------|--------|------------------------------------------|
| `/health`  | GET    | boot + engine-load check                 |
| `/compute` | POST   | `{design, scope?, currency?, prices?, render?, room?}` → render model |
| `/edit`    | POST   | `{design, op, args?, scope?}` → `{design, model}` |

All calls require header `X-Engine-Key: <ENGINE_KEY>`.

## Why serverless (not the `engine/server.js` long-running server)
Vercel does not run a persistent `http.listen()` process. Each file in `api/` becomes
a function; `vercel.json` rewrites `/compute`→`/api/compute` etc. so the PHP client's
paths stay unchanged. `app.js` (~2900 lines) is parsed on cold start and cached on
the warm instance (`lib/engine.js`).

## Deploy

1. Install the CLI and log in:
   ```
   npm i -g vercel
   vercel login
   ```
2. From this folder, link + deploy a preview:
   ```
   cd engine-vercel
   vercel
   ```
   Accept the prompts (new project name e.g. `wallview-engine`, root = this dir).
3. Set the shared secret (must equal the PHP app's `ENGINE_KEY`):
   ```
   vercel env add ENGINE_KEY production
   # paste a long random value; repeat for `preview` if you test previews
   ```
4. Ship to production:
   ```
   vercel --prod
   ```
   Note the URL, e.g. `https://wallview-engine.vercel.app`.

> Git alternative: push this folder as a repo and "Import Project" in the Vercel
> dashboard; set `ENGINE_KEY` under Settings → Environment Variables. Every push
> auto-deploys.

## Point the PHP API at it
In `D:\xampp\htdocs\wallview-api\.env` (and prod):
```
ENGINE_URL=https://wallview-engine.vercel.app
ENGINE_KEY=<the same long random value>
ENGINE_TIMEOUT_MS=10000
```

## Smoke test
```
curl https://wallview-engine.vercel.app/health
curl -X POST https://wallview-engine.vercel.app/compute \
  -H "X-Engine-Key: <ENGINE_KEY>" -H "Content-Type: application/json" \
  -d '{"design":{"active":0,"modules":[{"cab":{"w":800,"h":720,"d":560,"t":18,"back":true,"top":{"mount":"inset","on":true},"bottom":{"mount":"inset","on":true}},"comps":[]}]},"render":true}'
```

## Keeping the engine in sync
`app.js` here is a **copy** of `public/app/designer/app.js`. When the engine changes,
re-copy and redeploy:
```
cp ../<wallview-api>/public/app/designer/app.js ./app.js && vercel --prod
```

## Notes / caveats
- **Node runtime only.** These functions rely on `new Function` (engine eval), which
  is blocked on Vercel's *Edge* runtime — do not add `export const config = {runtime:'edge'}`.
- **Cold starts** re-parse `app.js` (~100–300 ms occasionally); warm calls are fast.
- **Secret is the only gate.** The URL is public; anyone with `ENGINE_KEY` can call it
  and bypass the PHP entitlement checks. Keep it server-side only, make it long, and
  rotate it (update both Vercel and the PHP `.env`) if it ever leaks. Optionally enable
  Vercel Deployment Protection for defense in depth.
- **Body limit** ~4.5 MB (designs are < 1 MB — fine).
