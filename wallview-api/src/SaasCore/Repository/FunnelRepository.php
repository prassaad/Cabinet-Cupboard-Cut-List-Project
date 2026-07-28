<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Repository;

use Ramsey\Uuid\Uuid;
use Standscale\Security\Db\Connection;

/**
 * Onboarding-funnel persistence: contacts, verification tokens, invite codes.
 * All pre-tenant / global, so raw Connection.
 */
final class FunnelRepository
{
    private Connection $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    public function upsertContact(string $email, ?string $mobile): string
    {
        $existing = $this->db->first('SELECT id FROM contacts WHERE email = :e LIMIT 1', ['e' => $email]);
        if ($existing !== null) {
            return (string) $existing['id'];
        }
        $id = Uuid::uuid4()->toString();
        $this->db->run(
            'INSERT INTO contacts (id, email, mobile) VALUES (:id, :e, :m)',
            ['id' => $id, 'e' => $email, 'm' => $mobile]
        );
        return $id;
    }

    public function createVerificationToken(string $email, string $code, int $ttlMinutes): void
    {
        $this->db->run(
            'INSERT INTO verification_tokens (id, code, email, is_used, expires_at)
             VALUES (:id, :c, :e, 0, :exp)',
            [
                'id' => Uuid::uuid4()->toString(), 'c' => $code, 'e' => $email,
                'exp' => gmdate('Y-m-d H:i:s', time() + $ttlMinutes * 60),
            ]
        );
    }

    public function findValidVerification(string $email, string $code): ?array
    {
        return $this->db->first(
            'SELECT * FROM verification_tokens
             WHERE email = :e AND code = :c AND is_used = 0 AND expires_at > UTC_TIMESTAMP()
             ORDER BY created_at DESC LIMIT 1',
            ['e' => $email, 'c' => $code]
        );
    }

    public function markVerificationUsed(string $id): void
    {
        $this->db->run('UPDATE verification_tokens SET is_used = 1 WHERE id = :id', ['id' => $id]);
    }

    public function createInviteCode(string $email, string $code, int $ttlMinutes): void
    {
        $this->db->run(
            'INSERT INTO invite_codes (id, code, email, used, expires_at)
             VALUES (:id, :c, :e, 0, :exp)',
            [
                'id' => Uuid::uuid4()->toString(), 'c' => $code, 'e' => $email,
                'exp' => gmdate('Y-m-d H:i:s', time() + $ttlMinutes * 60),
            ]
        );
    }

    public function findValidInvite(string $code): ?array
    {
        return $this->db->first(
            'SELECT * FROM invite_codes WHERE code = :c AND used = 0 AND expires_at > UTC_TIMESTAMP() LIMIT 1',
            ['c' => $code]
        );
    }

    public function markInviteUsed(string $id): void
    {
        $this->db->run('UPDATE invite_codes SET used = 1 WHERE id = :id', ['id' => $id]);
    }
}
