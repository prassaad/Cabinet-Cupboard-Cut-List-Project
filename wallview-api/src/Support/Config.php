<?php

declare(strict_types=1);

namespace Standscale\Support;

/**
 * Typed access to environment configuration.
 *
 * The constructor enforces the Tier-0 gate: JWT_KEY must be present and
 * non-trivial, otherwise the app refuses to boot. This is the fix for the
 * legacy stack's default-signing-key fallback (anyone could forge tokens).
 */
final class Config
{
    /** @var array<string,string> */
    private array $env;

    /** @param array<string,string> $env */
    public function __construct(array $env)
    {
        $this->env = $env;

        $key = $env['JWT_KEY'] ?? '';
        if ($key === '' || strlen($key) < 32) {
            // Fail loud, before a single request is served.
            throw new \RuntimeException(
                'JWT_KEY is missing or too short (need >= 32 chars). '
                . 'Refusing to boot. Set JWT_KEY in .env — never rely on a default key.'
            );
        }
    }

    public function get(string $key, ?string $default = null): ?string
    {
        $v = $this->env[$key] ?? $default;
        return $v === null ? null : (string) $v;
    }

    public function require(string $key): string
    {
        $v = $this->env[$key] ?? '';
        if ($v === '') {
            throw new \RuntimeException("Required config '{$key}' is not set.");
        }
        return (string) $v;
    }

    public function int(string $key, int $default): int
    {
        $v = $this->env[$key] ?? null;
        return $v === null || $v === '' ? $default : (int) $v;
    }

    public function isDev(): bool
    {
        return ($this->env['APP_ENV'] ?? 'prod') === 'dev';
    }
}
