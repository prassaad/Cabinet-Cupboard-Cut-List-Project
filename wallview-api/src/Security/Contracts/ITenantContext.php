<?php

declare(strict_types=1);

namespace Standscale\Security\Contracts;

/**
 * Per-request identity + tenant, resolved from the verified JWT.
 * This is the ONLY authoritative source of the current tenant — never the URL.
 */
interface ITenantContext
{
    public function tenantWorkspaceId(): ?string;

    public function userId(): ?string;

    /** @return string[] */
    public function roles(): array;

    /** @return array<string,mixed> all decoded claims */
    public function claims(): array;

    public function isAuthenticated(): bool;
}
