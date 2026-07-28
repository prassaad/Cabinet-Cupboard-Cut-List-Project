<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Service;

use Standscale\Http\HttpException;
use Standscale\Security\Contracts\ITokenService;
use Standscale\Security\PasswordHasher;
use Standscale\Security\Repository\RefreshTokenRepository;
use Standscale\Security\TenantContext;
use Standscale\Support\Config;
use Standscale\SaasCore\Repository\RoleRepository;
use Standscale\SaasCore\Repository\UserRepository;

/**
 * Login / refresh-rotation / logout, and the shared token-issuing routine used
 * by both login and the onboarding auto-login.
 */
final class AuthService
{
    private ITokenService $tokens;
    private RefreshTokenRepository $refreshTokens;
    private UserRepository $users;
    private RoleRepository $roles;
    private PasswordHasher $hasher;
    private int $refreshTtlDays;

    public function __construct(
        ITokenService $tokens,
        RefreshTokenRepository $refreshTokens,
        UserRepository $users,
        RoleRepository $roles,
        PasswordHasher $hasher,
        Config $config
    ) {
        $this->tokens = $tokens;
        $this->refreshTokens = $refreshTokens;
        $this->users = $users;
        $this->roles = $roles;
        $this->hasher = $hasher;
        $this->refreshTtlDays = $config->int('REFRESH_EXPIRY_DAYS', 7);
    }

    /** @return array{accessToken:string,refreshToken:string,user:array<string,mixed>} */
    public function login(string $email, string $subdomain, string $password): array
    {
        $user = $this->users->findByEmailAndSubdomain($email, $subdomain);
        // Uniform failure — don't reveal whether the email or the tenant exists.
        if ($user === null || !$this->hasher->verify($password, (string) $user['password_hash'])) {
            throw HttpException::unauthorized('Invalid credentials.');
        }
        return $this->issueFor($user);
    }

    /** @param array<string,mixed> $user @return array{accessToken:string,refreshToken:string,user:array<string,mixed>} */
    public function issueFor(array $user): array
    {
        $roleNames = $this->roles->namesForUser((string) $user['id']);
        $claims = [
            'sub' => (string) $user['id'],
            'nameid' => (string) $user['id'],
            'name' => (string) $user['user_name'],
            'email' => (string) $user['email'],
            'TenantWorkspaceId' => (string) $user['tenant_workspace_id'],
            'Subdomain' => (string) $user['subdomain'],
            'roles' => $roleNames,
        ];
        $access = $this->tokens->issueAccessToken($claims);
        $refresh = $this->tokens->newRefreshToken();
        $this->refreshTokens->store($refresh, (string) $user['id'], $this->refreshTtlDays);

        return [
            'accessToken' => $access,
            'refreshToken' => $refresh,
            'user' => [
                'id' => (string) $user['id'],
                'email' => (string) $user['email'],
                'name' => (string) $user['user_name'],
                'tenant' => (string) $user['subdomain'],
                'roles' => $roleNames,
            ],
        ];
    }

    /** Rotate: the presented refresh token is revoked and a new pair is issued. */
    public function refresh(string $refreshToken): array
    {
        $row = $this->refreshTokens->findActive($refreshToken);
        if ($row === null) {
            throw HttpException::unauthorized('Invalid or expired refresh token.');
        }
        $user = $this->users->findById((string) $row['user_id']);
        if ($user === null) {
            throw HttpException::unauthorized('User no longer exists.');
        }
        $this->refreshTokens->revoke($refreshToken); // one-time use
        return $this->issueFor($user);
    }

    public function logout(string $refreshToken): void
    {
        $this->refreshTokens->revoke($refreshToken);
    }
}
