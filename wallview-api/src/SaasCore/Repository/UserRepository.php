<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Repository;

use Ramsey\Uuid\Uuid;
use Standscale\Security\Db\Connection;

/**
 * Users are looked up during login (pre-auth) and created during setup, so this
 * repo uses the raw Connection. Every lookup still pins the tenant explicitly
 * (tenant_workspace_id / subdomain), so it is never cross-tenant.
 */
final class UserRepository
{
    private Connection $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    public function create(
        string $tenantWorkspaceId,
        string $subdomain,
        string $userName,
        string $email,
        string $passwordHash,
        bool $isBusinessUser
    ): string {
        $id = Uuid::uuid4()->toString();
        $this->db->run(
            'INSERT INTO users
               (id, tenant_workspace_id, user_name, normalized_user_name, email, normalized_email,
                email_confirmed, password_hash, security_stamp, subdomain, is_business_user, is_verified, verified_at)
             VALUES
               (:id, :ws, :un, :nun, :em, :nem, 1, :ph, :ss, :sd, :ib, 1, UTC_TIMESTAMP())',
            [
                'id' => $id, 'ws' => $tenantWorkspaceId, 'un' => $userName,
                'nun' => strtoupper($userName), 'em' => $email, 'nem' => strtoupper($email),
                'ph' => $passwordHash, 'ss' => Uuid::uuid4()->toString(), 'sd' => $subdomain,
                'ib' => $isBusinessUser ? 1 : 0,
            ]
        );
        return $id;
    }

    /** Login lookup: email within a specific tenant (by subdomain). */
    public function findByEmailAndSubdomain(string $email, string $subdomain): ?array
    {
        return $this->db->first(
            'SELECT * FROM users WHERE normalized_email = :em AND subdomain = :sd LIMIT 1',
            ['em' => strtoupper($email), 'sd' => $subdomain]
        );
    }

    public function findById(string $id): ?array
    {
        return $this->db->first('SELECT * FROM users WHERE id = :id LIMIT 1', ['id' => $id]);
    }
}
