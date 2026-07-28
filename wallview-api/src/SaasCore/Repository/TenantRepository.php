<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Repository;

use Ramsey\Uuid\Uuid;
use Standscale\Security\Db\Connection;

/**
 * Tenants are the isolation root, created during workspace setup BEFORE any
 * auth context exists — so this repo uses the raw Connection, not the
 * tenant-scoped base.
 */
final class TenantRepository
{
    private Connection $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    /** @return array{id:string,tenant_workspace_id:string,subdomain:string} */
    public function create(string $businessName, string $subdomain, ?string $region, ?string $country, bool $isBusiness): array
    {
        $id = Uuid::uuid4()->toString();
        $workspaceId = Uuid::uuid4()->toString();
        $this->db->run(
            'INSERT INTO tenants (id, tenant_workspace_id, business_name, subdomain, region, country, is_business)
             VALUES (:id, :ws, :bn, :sd, :rg, :co, :ib)',
            [
                'id' => $id, 'ws' => $workspaceId, 'bn' => $businessName, 'sd' => $subdomain,
                'rg' => $region, 'co' => $country, 'ib' => $isBusiness ? 1 : 0,
            ]
        );
        return ['id' => $id, 'tenant_workspace_id' => $workspaceId, 'subdomain' => $subdomain];
    }

    public function findBySubdomain(string $subdomain): ?array
    {
        return $this->db->first('SELECT * FROM tenants WHERE subdomain = :s LIMIT 1', ['s' => $subdomain]);
    }

    public function subdomainTaken(string $subdomain): bool
    {
        return $this->findBySubdomain($subdomain) !== null;
    }

    /**
     * Seed the default branding/entitlements row at workspace-creation time.
     * @param array<string,mixed> $brand
     * @param array<string,mixed> $features
     */
    public function createDefaultConfig(string $tenantWorkspaceId, array $brand, array $features, string $units = 'mm'): void
    {
        $this->db->run(
            'INSERT INTO tenant_config (tenant_workspace_id, brand, features, units)
             VALUES (:ws, :b, :f, :u)',
            [
                'ws' => $tenantWorkspaceId,
                'b' => json_encode($brand, JSON_UNESCAPED_SLASHES),
                'f' => json_encode($features, JSON_UNESCAPED_SLASHES),
                'u' => $units,
            ]
        );
    }
}
