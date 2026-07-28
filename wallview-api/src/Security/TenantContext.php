<?php

declare(strict_types=1);

namespace Standscale\Security;

use Standscale\Security\Contracts\ITenantContext;

/**
 * Holds the verified claims for the current request. Populated once by
 * AuthMiddleware from the Bearer JWT (the only authoritative source). Repos
 * read tenantWorkspaceId() to scope every query.
 */
final class TenantContext implements ITenantContext
{
    /** @var array<string,mixed> */
    private array $claims = [];
    private bool $authenticated = false;

    /** @param array<string,mixed> $claims */
    public function setClaims(array $claims): void
    {
        $this->claims = $claims;
        $this->authenticated = true;
    }

    public function tenantWorkspaceId(): ?string
    {
        $t = $this->claims['TenantWorkspaceId'] ?? null;
        return ($t === null || $t === '') ? null : (string) $t;
    }

    public function userId(): ?string
    {
        return isset($this->claims['sub']) ? (string) $this->claims['sub'] : null;
    }

    /** @return string[] */
    public function roles(): array
    {
        $roles = $this->claims['roles'] ?? [];
        return is_array($roles) ? array_values(array_map('strval', $roles)) : [];
    }

    /** @return array<string,mixed> */
    public function claims(): array
    {
        return $this->claims;
    }

    public function isAuthenticated(): bool
    {
        return $this->authenticated;
    }

    /** Guard used by repositories: refuse to run unscoped when no tenant is present. */
    public function requireTenant(): string
    {
        $t = $this->tenantWorkspaceId();
        if ($t === null) {
            throw new \RuntimeException('No tenant in context — a tenant-scoped query cannot run.');
        }
        return $t;
    }
}
