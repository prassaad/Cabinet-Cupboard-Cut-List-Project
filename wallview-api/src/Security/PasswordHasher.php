<?php

declare(strict_types=1);

namespace Standscale\Security;

/**
 * argon2id password hashing. Replaces the legacy stack's weaker/inconsistent
 * hashing and the plaintext password ever written into `tenants`.
 */
final class PasswordHasher
{
    public function hash(string $plain): string
    {
        return password_hash($plain, PASSWORD_ARGON2ID);
    }

    public function verify(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    public function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_ARGON2ID);
    }
}
