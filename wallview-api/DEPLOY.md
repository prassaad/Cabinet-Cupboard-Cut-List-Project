# WallView API — production deployment

Deploys the PHP multi-tenant API (`Standscale\…`) with its MySQL database. The
**engine already runs on Vercel** (see `engine-vercel/`); this app proxies to it,
so there is no Node to host here.

> **Deploying by FTP under an existing domain (no docroot change)?**
> Jump to **[Appendix A — FTP deploy under the main domain](#appendix-a--ftp-deploy-under-the-main-domain-no-docroot-change)**.
> The sections below assume you can set a document root; the appendix does not.

```
Browser (thin client)  →  THIS PHP API (auth + tenancy)  →  Vercel engine (/compute,/edit)
                                     │
                                     └── MySQL (tenants, users, projects, …)
```

## 0. Requirements
- **PHP 8.0+** with extensions: `pdo_mysql`, `mbstring`, `curl`, `json`, and
  **argon2id** support (`password_hash(PASSWORD_ARGON2ID)` must work — most PHP 8
  builds have it; a few shared hosts disable it — verify, see step 6).
- **MySQL 5.7+/8 or MariaDB 10.4+**, `utf8mb4`.
- **Composer** (or upload a locally-built `vendor/`).
- A domain/subdomain whose **document root can point at the app's `public/` folder**.
- HTTPS (Let's Encrypt / AutoSSL).

---

## 1. Upload the code
Upload the whole `wallview-api/` tree **above** the web root, e.g. to
`/home/USER/wallview-api/`. Do **not** put `src/`, `vendor/`, `.env`, or
`migrations/` inside a public folder — only `public/` is web-facing.

Exclude: `.git`, `tests/`, `node_modules` (none here), and any local `.env`.

## 2. Install dependencies (production)
On the server:
```
cd /home/USER/wallview-api
composer install --no-dev --optimize-autoloader
```
No shell/Composer on the host? Run it locally and upload the resulting `vendor/`.

---

## 3. Database (required)

### 3a. Create the database + a dedicated user
In cPanel → **MySQL® Databases** (or via CLI). Create:
- database `USER_wallview`
- user `USER_wvapp` with a strong password
- **grant that user ALL PRIVILEGES on that database** (needed: FKs/cascades are
  used, so the user must own the schema).

CLI equivalent:
```sql
CREATE DATABASE wallview CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wvapp'@'localhost' IDENTIFIED BY '<strong-password>';
GRANT ALL PRIVILEGES ON wallview.* TO 'wvapp'@'localhost';
FLUSH PRIVILEGES;
```

### 3b. Import the schema (two migrations, in order)
```
mysql -u wvapp -p wallview < migrations/001_core_schema.sql
mysql -u wvapp -p wallview < migrations/002_projects.sql
```
In cPanel without CLI: open **phpMyAdmin** → select the DB → **Import** →
run `001_core_schema.sql` first, then `002_projects.sql`.

### 3c. Create the first workspace + admin
Two options:
- **Seed a starter admin** (fastest):
  ```
  php scripts/seed_dev.php
  # login: admin@wallview.local / password  (subdomain: wallview)
  ```
  Then log in and **change that password immediately** (it's a known default).
- **Or use the real onboarding funnel** (register → verify → setup-workspace)
  once email is wired — the production-correct path (no seeded default).

---

## 4. Configure `.env` (production)
Copy `.env.example` → `.env` and set **production** values:
```
APP_ENV=prod
APP_URL=https://api.yourdomain.com

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=wallview            # the DB from 3a (may be USER_wallview on cPanel)
DB_USER=wvapp               # (may be USER_wvapp)
DB_PASS=<strong-password>

# REQUIRED — app refuses to boot if missing/short (>=32 chars). Generate:
#   php -r "echo bin2hex(random_bytes(48));"
JWT_KEY=<paste 96-hex-char secret>
JWT_ISSUER=wallview-api
JWT_AUDIENCE=wallview-api
JWT_EXPIRY_MINUTES=60
REFRESH_EXPIRY_DAYS=7

# Engine = your Vercel deployment; ENGINE_KEY MUST equal Vercel's ENGINE_KEY.
ENGINE_URL=https://wallview-engine.vercel.app
ENGINE_KEY=<same secret as Vercel>
ENGINE_TIMEOUT_MS=10000
```
- `APP_ENV=prod` disables verbose error output.
- Keep `.env` **outside** the web root (it already is, above `public/`) and
  readable only by the app user (`chmod 600 .env`).

---

## 5. Point the web server at `public/`
The document root **must** be `.../wallview-api/public` so only `public/` is served
and the front-controller `.htaccess` (already present) routes everything to
`index.php`.

**cPanel:** create a subdomain (e.g. `api.yourdomain.com`) and set its
**Document Root** to `/home/USER/wallview-api/public`. Ensure `mod_rewrite` +
`AllowOverride All` (default on most cPanel/Apache) so `.htaccess` applies.

**Nginx/VPS** (if not Apache) — no `.htaccess`; use:
```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    root /home/USER/wallview-api/public;
    index index.php;
    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root/index.php;
        # keep the Authorization header for Bearer JWT:
        fastcgi_param HTTP_AUTHORIZATION $http_authorization;
    }
    location ~ /\.(env|git) { deny all; }   # never serve .env
}
```

## 6. HTTPS + verify argon2id
- Enable AutoSSL/Let's Encrypt on the (sub)domain.
- Confirm argon2id is available on the host:
  ```
  php -r "var_dump(defined('PASSWORD_ARGON2ID') && password_hash('x',PASSWORD_ARGON2ID)!==false);"
  ```
  Must print `bool(true)`. If not, the host's PHP lacks argon2 — switch to a PHP
  build that has it (the hasher is argon2id).

---

## 7. Smoke test (in order)
```
# health (boot + DB reachable)
curl https://api.yourdomain.com/api/v1/health

# login → JWT
curl -X POST https://api.yourdomain.com/api/v1/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@wallview.local","subdomain":"wallview","password":"password"}'

# compute through the API → proves PHP → Vercel engine (use the token above)
curl -X POST https://api.yourdomain.com/api/v1/wallview/engine/compute \
  -H "Authorization: Bearer <accessToken>" -H 'Content-Type: application/json' \
  -d '{"design":{"active":0,"modules":[{"cab":{"w":800,"h":720,"d":560,"t":18,"back":true,"top":{"mount":"inset","on":true},"bottom":{"mount":"inset","on":true}},"comps":[]}]}}'
```
Expect: health ok → a JWT → a cut list. Then open
`https://api.yourdomain.com/app/designer-thin/` and design end-to-end.

## 8. Production hardening checklist
- [ ] `APP_ENV=prod` (no verbose errors).
- [ ] `JWT_KEY` = fresh 96-hex secret, **not** the dev one.
- [ ] `ENGINE_KEY` = long random, identical in Vercel + `.env` (rotate off `123456789`).
- [ ] Seeded `admin@wallview.local` password **changed** (or seed skipped).
- [ ] `.env` `chmod 600`, above web root, never served (test: `curl .../.env` → 404/403).
- [ ] DB user scoped to its one database only.
- [ ] Backups: schedule a `mysqldump` of the DB.
- [ ] (Later, ARCH-005) email delivery, entitlement layer, HttpOnly-cookie tokens.

---

## Appendix A — FTP deploy under the main domain (no docroot change)

Use this when you upload with FileZilla to `wallview.standscale.com`, keep the
existing landing page, and **cannot** change the document root. The app is
architected for the web root, and the API's base-path stripping natively
supports a `/wallview-api/public` prefix — so we upload the folder **intact** and
serve it from there, with `.htaccess` hiding everything except `public/`.

**Resulting URLs** (functional immediately; a prettier `/app` is Stage 2 below):
- Designer: `https://wallview.standscale.com/wallview-api/public/app/`
- API health: `https://wallview.standscale.com/wallview-api/public/api/v1/health`

The client figures out its own base automatically (`MOUNT` is derived from the
URL), so these "deep" paths work with **zero code changes**.

### A1. Build `vendor/` locally (shared hosting rarely has Composer)
On your machine, in `wallview-api/`:
```
composer install --no-dev --optimize-autoloader
```
This produces `vendor/` — it gets uploaded with everything else.

### A2. Upload with FileZilla
Connect, then into the domain's web root (usually `public_html/`) upload the
**whole `wallview-api/` folder** so the server has `public_html/wallview-api/…`.

- Include: `public/`, `src/`, `vendor/`, `migrations/`, `bootstrap.php`, `composer.json`.
- **Skip**: `.git/`, `tests/`, `engine/`, `engine-vercel/`, `node_modules/`, any local `.env`.
- Set FileZilla transfer type to **Auto** (it handles text vs binary).
- Tip: `vendor/` has thousands of small files — zip-upload if your host has a
  File Manager "Extract", otherwise let FileZilla grind through it.

Then two special uploads:
1. Upload `deploy/protect.htaccess` **into `public_html/wallview-api/`** and
   **rename it to `.htaccess`** (right-click → Rename in FileZilla).
   → this denies web access to `src/`, `vendor/`, `.env`, etc.
2. Upload `deploy/install_web.php` to `public_html/wallview-api/public/install.php`
   (temporary — used once in A5, deleted after).

`public/.htaccess` (already in the repo) re-grants access to `public/` only, so
the net effect is: **only `public/` is web-visible**.

### A3. Create the database (cPanel → MySQL Databases / phpMyAdmin)
1. Create a database (e.g. `standsca_wallview`) and a user (e.g.
   `standsca_wvapp`) with a strong password; **add the user to the DB with ALL
   PRIVILEGES**.
2. In **phpMyAdmin**, select that database → **Import** and run, in order:
   - `migrations/001_core_schema.sql`
   - `migrations/002_projects.sql`
   (You can import the local files straight from your machine.)

### A4. Configure `.env` on the server
Copy `.env.example` to `.env` (in `public_html/wallview-api/`) — do it in
FileZilla or the cPanel File Manager editor — and set:
```
APP_ENV=prod
APP_URL=https://wallview.standscale.com/wallview-api/public

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=standsca_wallview        # your cPanel DB name
DB_USER=standsca_wvapp           # your cPanel DB user
DB_PASS=<the strong password>

JWT_KEY=<96 hex chars — generate: php -r "echo bin2hex(random_bytes(48));">
JWT_ISSUER=wallview-api
JWT_AUDIENCE=wallview-api
JWT_EXPIRY_MINUTES=60
REFRESH_EXPIRY_DAYS=7

ENGINE_URL=https://wallview-engine.vercel.app
ENGINE_KEY=<the SAME secret set in Vercel>
ENGINE_TIMEOUT_MS=10000
```
`.env` must stay inside `wallview-api/` (the `.htaccess` from A2 hides it). Verify
after: opening `https://wallview.standscale.com/wallview-api/.env` must give
**403/404**, never text.

### A5. Create your admin (one-time web installer)
1. In the uploaded `public/install.php`, set `INSTALL_TOKEN` to a private value
   (edit via File Manager, or edit locally before uploading).
2. Browse once to:
   ```
   https://wallview.standscale.com/wallview-api/public/install.php?token=YOURTOKEN&email=you@company.com&password=YourStrongPass&subdomain=wallview&business=WallView
   ```
   It prints the created workspace.
3. **Delete `install.php`** from the server immediately.

### A6. Verify
```
# health (boots + DB reachable)
https://wallview.standscale.com/wallview-api/public/api/v1/health   → {"status":"ok",...}
```
Then open the designer and log in with the admin you just created:
```
https://wallview.standscale.com/wallview-api/public/app/
```
Design something → it will compute via PHP → Vercel.

### A7. (Optional) Serve it at a clean `/app` URL
Keep the landing page and expose the designer at
`https://wallview.standscale.com/app/`. Add these two rules to the **web root**
`.htaccess` (`public_html/.htaccess`, above the landing page's own rules — don't
remove theirs):
```apache
RewriteEngine On
# Pretty mounts → the app's public/ folder (internal rewrite; URL stays clean).
RewriteRule ^app(/.*)?$   wallview-api/public/app$1   [L]
RewriteRule ^api(/.*)?$   wallview-api/public/api$1    [L]
```
With this, the designer is `https://wallview.standscale.com/app/` and the client
calls `/api/v1/...` at the root (the app strips the internal prefix). Test the
landing page still loads at `/` afterwards. If your host uses Nginx (no
`.htaccess`), ask me for the equivalent `location` blocks.

### Notes
- Any `.env` change is picked up on the next request under Apache/LiteSpeed
  (unlike the local `php -S`), so no restart needed.
- If argon2id is unavailable on the host, logins fail at signup/seed — check with
  `php -r "var_dump(password_hash('x',PASSWORD_ARGON2ID)!==false);"` via a temp
  file, and move to a PHP version that includes it.
