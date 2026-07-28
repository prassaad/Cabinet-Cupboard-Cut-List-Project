<?php

declare(strict_types=1);

namespace Standscale\Security\Middleware;

use Standscale\Http\HttpException;
use Standscale\Http\Middleware;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\Security\Contracts\ITokenService;
use Standscale\Security\TenantContext;

/**
 * Verifies the Bearer JWT and populates TenantContext for the request.
 * Bearer only — cookies are never trusted by the API (keeps it CORS-simple and
 * closes the XSS-cookie-exfil path the legacy cookies had).
 */
final class AuthMiddleware implements Middleware
{
    private ITokenService $tokens;
    private TenantContext $context;

    public function __construct(ITokenService $tokens, TenantContext $context)
    {
        $this->tokens = $tokens;
        $this->context = $context;
    }

    public function handle(Request $request, callable $next): Response
    {
        $token = $request->bearerToken();
        if ($token === null) {
            throw HttpException::unauthorized('Missing Bearer token.');
        }
        $claims = $this->tokens->validateAccessToken($token);
        if ($claims === null) {
            throw HttpException::unauthorized('Invalid or expired token.');
        }
        if (empty($claims['TenantWorkspaceId'])) {
            throw HttpException::unauthorized('Token has no tenant claim.');
        }
        $this->context->setClaims($claims);
        return $next($request);
    }
}
