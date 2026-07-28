<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Repository;

use Ramsey\Uuid\Uuid;
use Standscale\Security\Db\Connection;

final class CompanyRepository
{
    private Connection $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    public function create(string $tenantWorkspaceId, string $name, ?string $country): string
    {
        $id = Uuid::uuid4()->toString();
        $this->db->run(
            'INSERT INTO companies (id, tenant_workspace_id, name, country) VALUES (:id, :ws, :n, :c)',
            ['id' => $id, 'ws' => $tenantWorkspaceId, 'n' => $name, 'c' => $country]
        );
        return $id;
    }
}
