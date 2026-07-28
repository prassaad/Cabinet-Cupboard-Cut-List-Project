<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Controller;

use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\Security\TenantContext;

final class MetaController
{
    private TenantContext $context;

    public function __construct(TenantContext $context)
    {
        $this->context = $context;
    }

    public function health(Request $r): Response
    {
        return Response::json(['status' => 'ok', 'service' => 'wallview-api', 'time' => gmdate('c')]);
    }

    /** Landing/index for the API base — lists what's available (this is a JSON API, not a web page). */
    public function index(Request $r): Response
    {
        return Response::json([
            'service' => 'wallview-api',
            'status' => 'ok',
            'docs' => 'see README.md',
            'endpoints' => [
                'GET  /api/v1/health',
                'POST /api/v1/register',
                'POST /api/v1/verify',
                'POST /api/v1/workspace/setup',
                'POST /api/v1/login',
                'POST /api/v1/refresh',
                'POST /api/v1/logout',
                'GET  /api/v1/me            (Bearer)',
                'GET  /api/v1/{tenant}/config (Bearer)',
            ],
        ]);
    }

    /** Echoes the authenticated identity — handy for confirming token/tenant resolution. */
    public function me(Request $r): Response
    {
        return Response::json([
            'userId' => $this->context->userId(),
            'tenantWorkspaceId' => $this->context->tenantWorkspaceId(),
            'roles' => $this->context->roles(),
            'subdomain' => $this->context->claims()['Subdomain'] ?? null,
        ]);
    }
}
