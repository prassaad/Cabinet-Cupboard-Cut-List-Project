<?php

declare(strict_types=1);

namespace Standscale\Http;

/**
 * Immutable-ish wrapper over the incoming HTTP request.
 * Route params are filled in by the Router once a route matches.
 */
final class Request
{
    public string $method;
    public string $path;
    /** @var array<string,mixed> */
    public array $body;
    /** @var array<string,string> */
    public array $query;
    /** @var array<string,string> */
    public array $headers;
    /** @var array<string,string> route params captured from the path pattern */
    public array $params = [];

    /** Attributes stashed by middleware (e.g. the resolved auth claims / tenant). */
    private array $attributes = [];

    public function __construct(string $method, string $path, array $body, array $query, array $headers)
    {
        $this->method = strtoupper($method);
        $this->path = $path;
        $this->body = $body;
        $this->query = $query;
        $this->headers = $headers;
    }

    public static function fromGlobals(): self
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // The app is mounted under /wallview-api/public on XAMPP; strip that prefix
        // so internal paths are clean ("/api/v1/...").
        $uri = preg_replace('#^/wallview-api/public#', '', $uri) ?? $uri;
        $uri = preg_replace('#^/public#', '', $uri) ?? $uri;
        if ($uri === '' || $uri === false) {
            $uri = '/';
        }
        $uri = rtrim($uri, '/') ?: '/';

        $raw = file_get_contents('php://input') ?: '';
        $body = $raw === '' ? [] : (json_decode($raw, true) ?? []);
        if (!is_array($body)) {
            $body = [];
        }

        return new self(
            $_SERVER['REQUEST_METHOD'] ?? 'GET',
            $uri,
            $body,
            $_GET ?? [],
            self::collectHeaders()
        );
    }

    /** @return array<string,string> */
    private static function collectHeaders(): array
    {
        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with($k, 'HTTP_')) {
                $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($k, 5)))));
                $headers[$name] = (string) $v;
            }
        }
        // Some Apache setups hide Authorization; recover it if present.
        if (!isset($headers['Authorization'])) {
            $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
            if ($auth !== '') {
                $headers['Authorization'] = (string) $auth;
            }
        }
        return $headers;
    }

    public function bearerToken(): ?string
    {
        $auth = $this->headers['Authorization'] ?? '';
        if (preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
            return $m[1];
        }
        return null;
    }

    public function input(string $key, $default = null)
    {
        return $this->body[$key] ?? $default;
    }

    public function param(string $key, ?string $default = null): ?string
    {
        return $this->params[$key] ?? $default;
    }

    public function setAttribute(string $key, $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function attribute(string $key, $default = null)
    {
        return $this->attributes[$key] ?? $default;
    }
}
