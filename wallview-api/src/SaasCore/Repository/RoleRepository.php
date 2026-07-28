<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Repository;

use Ramsey\Uuid\Uuid;
use Standscale\Security\Db\Connection;

final class RoleRepository
{
    private Connection $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    public function create(string $tenantWorkspaceId, string $name): string
    {
        $id = Uuid::uuid4()->toString();
        $this->db->run(
            'INSERT INTO roles (id, tenant_workspace_id, name, normalized_name) VALUES (:id, :ws, :n, :nn)',
            ['id' => $id, 'ws' => $tenantWorkspaceId, 'n' => $name, 'nn' => strtoupper($name)]
        );
        return $id;
    }

    public function assign(string $userId, string $roleId, string $tenantWorkspaceId): void
    {
        $this->db->run(
            'INSERT INTO user_roles (user_id, role_id, tenant_workspace_id) VALUES (:u, :r, :ws)',
            ['u' => $userId, 'r' => $roleId, 'ws' => $tenantWorkspaceId]
        );
    }

    /** @return string[] role names for a user */
    public function namesForUser(string $userId): array
    {
        $rows = $this->db->all(
            'SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = :u',
            ['u' => $userId]
        );
        return array_map(fn ($r) => (string) $r['name'], $rows);
    }
}
