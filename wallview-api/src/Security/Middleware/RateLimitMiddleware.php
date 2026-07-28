<?php

declare(strict_types=1);

namespace Standscale\Security\Middleware;

use Standscale\Http\HttpException;
use Standscale\Http\Middleware;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\Security\Contracts\IRateLimiter;
use Standscale\Security\TenantContext;

/**
 * Rate limit keyed by tenant when authenticated, else by client IP (for the
 * unauthenticated auth endpoints — brute-force protection).
 */
final class RateLimitMiddleware implements Middleware
{
    private IRateLimiter $limiter;
    private TenantContext $context;
    private int $limit;
    private int $window;

    public function __construct(IRateLimiter $limiter, TenantContext $context, int $limit = 120, int $windowSeconds = 60)
    {
        $this->limiter = $limiter;
        $this->context = $context;
        $this->limit = $limit;
        $this->window = $windowSeconds;
    }

    public function handle(Request $request, callable $next): Response
    {
        $tenant = $this->context->tenantWorkspaceId();
        $key = $tenant !== null
            ? 'tenant:' . $tenant
            : 'ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');

        if (!$this->limiter->allow($key, $this->limit, $this->window)) {
            throw HttpException::tooManyRequests();
        }
        return $next($request);
    }
}
