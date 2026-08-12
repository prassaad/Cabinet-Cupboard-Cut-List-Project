<?php

declare(strict_types=1);

/**
 * Front controller. Defines the route table and dispatches through the Kernel.
 * Every route lists its middleware explicitly (order matters: auth -> tenant).
 */

use Standscale\Http\Kernel;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\Http\Router;
use Standscale\SaasCore\Controller\AuthController;
use Standscale\SaasCore\Controller\ConfigController;
use Standscale\SaasCore\Controller\MetaController;
use Standscale\SaasCore\Controller\OnboardingController;
use Standscale\Products\WallView\Controller\EngineController;
use Standscale\Products\WallView\Controller\ProjectController;

// ── Static UI (bundled SPA under public/app/) ──────────────────────────────
// Served here so the `php -S` dev server works; Apache serves these files
// directly via .htaccess. Runs before bootstrap so the UI loads regardless of
// API config state. Restricted to public/app to prevent path traversal.
(static function (): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        return;
    }
    $reqPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = preg_replace('#^/wallview-api/public#', '', $reqPath);
    $path = preg_replace('#^/public#', '', $path) ?: '/';
    // The mount prefix that was stripped ('' | '/wallview-api/public'), so redirects below can be
    // absolute instead of relative — see the landing redirect.
    $mount = rtrim(substr($reqPath, 0, max(0, strlen($reqPath) - strlen($path))), '/');

    // Collapse a doubled /app/app/… back to /app/… . The landing redirect below used to be the bare
    // relative `Location: app/`; a browser already sitting inside /app/ resolves that against the
    // CURRENT directory and lands on /app/app/, which exists nowhere and fell through to the JSON API
    // as "No route for GET /app/app.". Old links, bookmarks and history entries still point there.
    // REDIRECT rather than quietly serve the right file: both pages derive their API base from
    // location.pathname, so a doubled address would have them call /app/api/v1 instead of /api/v1.
    if (preg_match('#^/app(/app(?:/|$).*)$#', $path, $m)) {
        header('Location: ' . $mount . $m[1]);
        exit;
    }

    // Friendly landing: send the bare base to the app (app/index.html = the sign-in page). Absolute,
    // built from the URL the browser actually used, so it can never compound the way the old one did.
    if ($path === '/') {
        header('Location: ' . $mount . '/app/');
        exit;
    }
    if (strpos($path, '/app') !== 0) {
        return; // fall through to the JSON API
    }
    $candidate = __DIR__ . '/' . ltrim($path, '/');
    if (is_dir($candidate)) {
        $candidate = rtrim($candidate, '/') . '/index.html'; // directory index
    }
    $base = realpath(__DIR__ . '/app');
    $file = realpath($candidate);
    if ($base === false || $file === false || strpos($file, $base) !== 0 || !is_file($file)) {
        return;
    }
    $mimes = ['html' => 'text/html', 'js' => 'text/javascript', 'css' => 'text/css',
              'svg' => 'image/svg+xml', 'ico' => 'image/x-icon', 'png' => 'image/png', 'json' => 'application/json'];
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    header('Cache-Control: no-cache');
    readfile($file);
    exit;
})();

/** @var array{0:\Standscale\Http\Container,1:\Standscale\Support\Config} $boot */
try {
    // Locate the app code. Normally one level above public/ (XAMPP, or code kept
    // above the web root). On shared hosting where nothing can live above the
    // document root, the code sits in a web-protected "_core/" subfolder instead.
    $bootstrapFile = is_file(__DIR__ . '/../bootstrap.php')
        ? __DIR__ . '/../bootstrap.php'
        : __DIR__ . '/_core/bootstrap.php';
    $boot = require $bootstrapFile;
} catch (\Throwable $e) {
    // Boot failures (e.g. missing JWT_KEY) must fail loud and safe.
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => ['code' => 'boot_error', 'message' => $e->getMessage()]]);
    exit;
}
[$container, $config] = $boot;

$router = new Router();

// Index / landing (JSON — this is an API, not a web page).
$router->get('/', [MetaController::class, 'index']);
$router->get('/api/v1', [MetaController::class, 'index']);

// Public (unauthenticated) — rate-limited by IP.
$router->get('/api/v1/health', [MetaController::class, 'health']);
$router->post('/api/v1/register', [OnboardingController::class, 'register'], ['mw.ratelimit']);
$router->post('/api/v1/verify', [OnboardingController::class, 'verify'], ['mw.ratelimit']);
$router->post('/api/v1/workspace/setup', [OnboardingController::class, 'setupWorkspace'], ['mw.ratelimit']);
$router->post('/api/v1/login', [AuthController::class, 'login'], ['mw.ratelimit']);
$router->post('/api/v1/refresh', [AuthController::class, 'refresh'], ['mw.ratelimit']);
$router->post('/api/v1/logout', [AuthController::class, 'logout'], ['mw.ratelimit']);

// Authenticated. Pipeline: auth (verify JWT) -> tenant (IDOR guard) -> rate limit.
$router->get('/api/v1/me', [MetaController::class, 'me'], ['mw.auth', 'mw.ratelimit']);
$router->get('/api/v1/{tenant}/config', [ConfigController::class, 'show'], ['mw.auth', 'mw.tenant', 'mw.ratelimit']);

// Projects (per-tenant design documents). auth -> tenant (IDOR guard) -> rate limit.
$projMw = ['mw.auth', 'mw.tenant', 'mw.ratelimit'];
$router->get('/api/v1/{tenant}/projects', [ProjectController::class, 'index'], $projMw);
$router->post('/api/v1/{tenant}/projects', [ProjectController::class, 'create'], $projMw);
$router->get('/api/v1/{tenant}/projects/{id}', [ProjectController::class, 'show'], $projMw);
$router->put('/api/v1/{tenant}/projects/{id}', [ProjectController::class, 'update'], $projMw);
$router->delete('/api/v1/{tenant}/projects/{id}', [ProjectController::class, 'destroy'], $projMw);

// Engine (ARCH-004 E1). Server-side compute (real engine, via Node) + pure nester.
$router->post('/api/v1/{tenant}/engine/compute', [EngineController::class, 'compute'], $projMw);
$router->post('/api/v1/{tenant}/engine/edit', [EngineController::class, 'edit'], $projMw);
$router->post('/api/v1/{tenant}/engine/nest', [EngineController::class, 'nest'], $projMw);

$kernel = new Kernel($container, $router, $config);
$response = $kernel->handle(Request::fromGlobals());
$response->send();
