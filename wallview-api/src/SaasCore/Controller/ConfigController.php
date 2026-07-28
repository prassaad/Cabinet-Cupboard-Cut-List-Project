<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Controller;

use Standscale\Http\HttpException;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\SaasCore\Repository\TenantConfigRepository;

/**
 * GET /api/v1/{tenant}/config — branding + entitlements for the runtime FE.
 * Reads through the tenant-scoped repository, so the response can only ever be
 * the caller's own tenant config (the {tenant} slug was already asserted to
 * match the token by TenantMiddleware).
 */
final class ConfigController
{
    private TenantConfigRepository $config;

    public function __construct(TenantConfigRepository $config)
    {
        $this->config = $config;
    }

    public function show(Request $r): Response
    {
        $cfg = $this->config->current();
        if ($cfg === null) {
            throw HttpException::notFound('No config for this tenant.');
        }
        return Response::json($cfg);
    }
}
