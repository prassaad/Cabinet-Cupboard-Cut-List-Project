<?php

declare(strict_types=1);

/**
 * Application bootstrap: load env, enforce the JWT_KEY gate, and wire the
 * container (Security Core -> SaaS Core). Returns [Container, Config].
 * Dependency direction is one-way: SaaS Core depends on Security Core, never
 * the reverse.
 */

use Dotenv\Dotenv;
use Standscale\Http\Container;
use Standscale\Security\Contracts\IRateLimiter;
use Standscale\Security\Contracts\ITokenService;
use Standscale\Security\Db\Connection;
use Standscale\Security\FileRateLimiter;
use Standscale\Security\Middleware\AuthMiddleware;
use Standscale\Security\Middleware\RateLimitMiddleware;
use Standscale\Security\Middleware\RbacMiddleware;
use Standscale\Security\Middleware\TenantMiddleware;
use Standscale\Security\PasswordHasher;
use Standscale\Security\Repository\RefreshTokenRepository;
use Standscale\Security\TenantContext;
use Standscale\Security\TokenService;
use Standscale\Support\Config;
use Standscale\SaasCore\Controller\AuthController;
use Standscale\SaasCore\Controller\ConfigController;
use Standscale\SaasCore\Controller\MetaController;
use Standscale\SaasCore\Controller\OnboardingController;
use Standscale\SaasCore\Repository\CompanyRepository;
use Standscale\SaasCore\Repository\FunnelRepository;
use Standscale\SaasCore\Repository\RoleRepository;
use Standscale\SaasCore\Repository\TenantConfigRepository;
use Standscale\SaasCore\Repository\TenantRepository;
use Standscale\SaasCore\Repository\UserRepository;
use Standscale\SaasCore\Service\AuthService;
use Standscale\SaasCore\Service\OnboardingService;
use Standscale\Products\WallView\Controller\EngineController;
use Standscale\Products\WallView\Controller\ProjectController;
use Standscale\Products\WallView\Engine\EngineClient;
use Standscale\Products\WallView\Repository\ProjectRepository;

require __DIR__ . '/vendor/autoload.php';

Dotenv::createImmutable(__DIR__)->safeLoad();

// Config constructor enforces the JWT_KEY gate — throws here if it is missing.
$config = new Config($_ENV);

$c = new Container();
$c->set(Config::class, fn () => $config);

// ── Security Core ──────────────────────────────────────────────────────────
$c->set(Connection::class, fn (Container $c) => new Connection($c->get(Config::class)));
$c->set(TenantContext::class, fn () => new TenantContext());
$c->set(ITokenService::class, fn (Container $c) => new TokenService($c->get(Config::class)));
$c->set(PasswordHasher::class, fn () => new PasswordHasher());
$c->set(IRateLimiter::class, fn () => new FileRateLimiter());
$c->set(RefreshTokenRepository::class, fn (Container $c) => new RefreshTokenRepository($c->get(Connection::class)));

// ── SaaS Core: repositories ────────────────────────────────────────────────
$c->set(TenantRepository::class, fn (Container $c) => new TenantRepository($c->get(Connection::class)));
$c->set(CompanyRepository::class, fn (Container $c) => new CompanyRepository($c->get(Connection::class)));
$c->set(UserRepository::class, fn (Container $c) => new UserRepository($c->get(Connection::class)));
$c->set(RoleRepository::class, fn (Container $c) => new RoleRepository($c->get(Connection::class)));
$c->set(FunnelRepository::class, fn (Container $c) => new FunnelRepository($c->get(Connection::class)));
$c->set(TenantConfigRepository::class, fn (Container $c) => new TenantConfigRepository(
    $c->get(Connection::class),
    $c->get(TenantContext::class)
));

// ── SaaS Core: services ────────────────────────────────────────────────────
$c->set(AuthService::class, fn (Container $c) => new AuthService(
    $c->get(ITokenService::class),
    $c->get(RefreshTokenRepository::class),
    $c->get(UserRepository::class),
    $c->get(RoleRepository::class),
    $c->get(PasswordHasher::class),
    $c->get(Config::class)
));
$c->set(OnboardingService::class, fn (Container $c) => new OnboardingService(
    $c->get(FunnelRepository::class),
    $c->get(TenantRepository::class),
    $c->get(CompanyRepository::class),
    $c->get(UserRepository::class),
    $c->get(RoleRepository::class),
    $c->get(PasswordHasher::class),
    $c->get(AuthService::class),
    $c->get(Connection::class),
    $c->get(Config::class)->isDev()
));

// ── SaaS Core: controllers ─────────────────────────────────────────────────
$c->set(OnboardingController::class, fn (Container $c) => new OnboardingController($c->get(OnboardingService::class)));
$c->set(AuthController::class, fn (Container $c) => new AuthController($c->get(AuthService::class)));
$c->set(ConfigController::class, fn (Container $c) => new ConfigController($c->get(TenantConfigRepository::class)));
$c->set(MetaController::class, fn (Container $c) => new MetaController($c->get(TenantContext::class)));

// ── Product module: WallView (projects; the engine lands here next slice) ───
$c->set(ProjectRepository::class, fn (Container $c) => new ProjectRepository(
    $c->get(Connection::class),
    $c->get(TenantContext::class)
));
$c->set(ProjectController::class, fn (Container $c) => new ProjectController(
    $c->get(ProjectRepository::class),
    $c->get(TenantContext::class)
));
$c->set(EngineClient::class, fn (Container $c) => new EngineClient($c->get(Config::class)));
$c->set(EngineController::class, fn (Container $c) => new EngineController($c->get(EngineClient::class)));

// ── Middleware ─────────────────────────────────────────────────────────────
$c->set('mw.auth', fn (Container $c) => new AuthMiddleware($c->get(ITokenService::class), $c->get(TenantContext::class)));
$c->set('mw.tenant', fn (Container $c) => new TenantMiddleware($c->get(TenantContext::class)));
$c->set('mw.ratelimit', fn (Container $c) => new RateLimitMiddleware($c->get(IRateLimiter::class), $c->get(TenantContext::class)));
$c->set('mw.rbac.admin', fn (Container $c) => new RbacMiddleware($c->get(TenantContext::class), ['Admin']));

return [$c, $config];
