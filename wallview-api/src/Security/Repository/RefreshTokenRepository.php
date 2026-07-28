<?php

declare(strict_types=1);

namespace Standscale\Security\Repository;

use Standscale\Security\Db\Connection;

/**
 * Refresh-token store with rotation. Not tenant-scoped (a token is keyed by
 * user), so it uses the raw Connection rather than the scoped base. Tokens are
 * stored hashed (sha256) so a DB read cannot replay them.
 */
final class RefreshTokenRepository
{
    private Connection $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    private function fingerprint(string $token): string
    {
        return hash('sha256', $token);
    }

    public function store(string $token, string $userId, int $ttlDays): void
    {
        $this->db->run(
            'INSERT INTO refresh_tokens (token_hash, user_id, expires_at, created_at, revoked)
             VALUES (:h, :u, :e, UTC_TIMESTAMP(), 0)',
            [
                'h' => $this->fingerprint($token),
                'u' => $userId,
                'e' => gmdate('Y-m-d H:i:s', time() + $ttlDays * 86400),
            ]
        );
    }

    /** @return array<string,mixed>|null the active row for this token, if any */
    public function findActive(string $token): ?array
    {
        return $this->db->first(
            'SELECT * FROM refresh_tokens
             WHERE token_hash = :h AND revoked = 0 AND expires_at > UTC_TIMESTAMP()
             LIMIT 1',
            ['h' => $this->fingerprint($token)]
        );
    }

    public function revoke(string $token): void
    {
        $this->db->run(
            'UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = :h',
            ['h' => $this->fingerprint($token)]
        );
    }

    public function revokeAllForUser(string $userId): void
    {
        $this->db->run('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = :u', ['u' => $userId]);
    }
}
