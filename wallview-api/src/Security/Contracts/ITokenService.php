<?php

declare(strict_types=1);

namespace Standscale\Security\Contracts;

/**
 * Issue + validate access tokens. Concretion is swappable (Security Core rule).
 */
interface ITokenService
{
    /**
     * @param array<string,mixed> $claims  must include 'sub' and 'TenantWorkspaceId'
     */
    public function issueAccessToken(array $claims): string;

    /** @return array<string,mixed>|null decoded claims, or null if invalid/expired */
    public function validateAccessToken(string $token): ?array;

    /** A fresh opaque refresh-token string (stored hashed / rotated by the repo). */
    public function newRefreshToken(): string;
}
