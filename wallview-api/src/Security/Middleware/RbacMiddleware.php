<?php

declare(strict_types=1);

namespace Standscale\Security\Middleware;

use Standscale\Http\HttpException;
use Standscale\Http\Middleware;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\Security\TenantContext;

/**
 * Role gate. Construct with the roles that may reach the route; the request
 * passes if the token carries any of them. Entitlement/plan checks (max
 * modules, pricing enabled) are enforced deeper, in the engine/services.
 */
final class RbacMiddleware implements Middleware
{
    private TenantContext $context;
    /** @var string[] */
    private array $allowed;

    /** @param string[] $allowedRoles */
    public function __construct(TenantContext $context, array $allowedRoles)
    {
        $this->context = $context;
        $this->allowed = array_map('strtolower', $allowedRoles);
    }

    public function handle(Request $request, callable $next): Response
    {
        if ($this->allowed === []) {
            return $next($request);
        }
        $have = array_map('strtolower', $this->context->roles());
        if (array_intersect($this->allowed, $have) === []) {
            throw HttpException::forbidden('Insufficient role for this action.');
        }
        return $next($request);
    }
}
