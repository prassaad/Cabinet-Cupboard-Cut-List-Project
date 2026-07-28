<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Repository;

use Standscale\Security\Repository\TenantScopedRepository;

/**
 * Reads the current tenant's config. Extends the scoped base, so the tenant
 * predicate is injected structurally — this is the isolation invariant in
 * action for an authenticated endpoint (GET /api/v1/{tenant}/config).
 */
final class TenantConfigRepository extends TenantScopedRepository
{
    protected function table(): string
    {
        return 'tenant_config';
    }

    /** @return array{brand:mixed,features:mixed,units:string}|null */
    public function current(): ?array
    {
        $row = $this->scopedFirst();
        if ($row === null) {
            return null;
        }
        return [
            'brand' => $row['brand'] !== null ? json_decode((string) $row['brand'], true) : null,
            'features' => $row['features'] !== null ? json_decode((string) $row['features'], true) : null,
            'units' => (string) ($row['units'] ?? 'mm'),
        ];
    }
}
