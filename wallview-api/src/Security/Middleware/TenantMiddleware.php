<?php

declare(strict_types=1);

namespace Standscale\Security\Middleware;

use Standscale\Http\HttpException;
use Standscale\Http\Middleware;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\Security\TenantContext;

/**
 * IDOR guard (ARCH-004 §7.1). Runs AFTER AuthMiddleware. If the route carries a
 * {tenant} slug in the URL, it must equal the tenant the token was issued for.
 * The URL is a *checked assertion*, never the authorization source — that stays
 * the signed JWT claim. Mismatch => 403 (someone else's slug + a valid token).
 */
final class TenantMiddleware implements Middleware
{
    private TenantContext $context;

    public function __construct(TenantContext $context)
    {
        $this->context = $context;
    }

    public function handle(Request $request, callable $next): Response
    {
        $urlTenant = $request->param('tenant');
        if ($urlTenant !== null && $urlTenant !== '') {
            $claims = $this->context->claims();
            // The signed slug (Subdomain) and the workspace id are both acceptable
            // matches — either proves the URL belongs to this token's tenant.
            $tokenSlug = (string) ($claims['Subdomain'] ?? '');
            $tokenWsId = (string) ($claims['TenantWorkspaceId'] ?? '');
            $match = strcasecmp($urlTenant, $tokenSlug) === 0
                || strcasecmp($urlTenant, $tokenWsId) === 0;
            if (!$match) {
                throw HttpException::forbidden('URL tenant does not match the authenticated tenant.');
            }
        }
        return $next($request);
    }
}
