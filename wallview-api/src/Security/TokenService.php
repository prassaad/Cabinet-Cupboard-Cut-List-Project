<?php

declare(strict_types=1);

namespace Standscale\Security;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Standscale\Security\Contracts\ITokenService;
use Standscale\Support\Config;

/**
 * JWT issue/validate on firebase/php-jwt, HS256 with a required key.
 *
 * Two Tier-0 fixes vs the legacy hand-rolled service:
 *  - the signing key is REQUIRED (enforced in Config) — no default fallback;
 *  - decoding pins the algorithm to HS256 (an alg allow-list of one), so a
 *    forged "alg: none" / RS256 header is rejected.
 */
final class TokenService implements ITokenService
{
    private const ALGO = 'HS256';

    private string $key;
    private string $issuer;
    private string $audience;
    private int $accessTtlSeconds;

    public function __construct(Config $config)
    {
        $this->key = $config->require('JWT_KEY');
        $this->issuer = $config->get('JWT_ISSUER', 'wallview-api');
        $this->audience = $config->get('JWT_AUDIENCE', 'wallview-api');
        $this->accessTtlSeconds = $config->int('JWT_EXPIRY_MINUTES', 60) * 60;
    }

    /** @param array<string,mixed> $claims */
    public function issueAccessToken(array $claims): string
    {
        $now = time();
        $payload = array_merge($claims, [
            'iss' => $this->issuer,
            'aud' => $this->audience,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + $this->accessTtlSeconds,
        ]);
        return JWT::encode($payload, $this->key, self::ALGO);
    }

    /** @return array<string,mixed>|null */
    public function validateAccessToken(string $token): ?array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->key, self::ALGO));
        } catch (\Throwable $e) {
            return null; // expired, bad signature, wrong alg, malformed — all invalid
        }
        $claims = (array) $decoded;
        if (($claims['iss'] ?? null) !== $this->issuer || ($claims['aud'] ?? null) !== $this->audience) {
            return null;
        }
        // Normalize roles back to a plain array.
        if (isset($claims['roles'])) {
            $claims['roles'] = array_values((array) $claims['roles']);
        }
        return $claims;
    }

    public function newRefreshToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    }
}
