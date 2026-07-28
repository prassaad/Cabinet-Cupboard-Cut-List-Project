<?php

declare(strict_types=1);

namespace Standscale\Http;

/**
 * A JSON response. The Kernel calls send() once at the end of the pipeline.
 */
final class Response
{
    public int $status;
    /** @var mixed */
    public $payload;
    /** @var array<string,string> */
    public array $headers;

    public function __construct(int $status, $payload, array $headers = [])
    {
        $this->status = $status;
        $this->payload = $payload;
        $this->headers = $headers;
    }

    public static function json($payload, int $status = 200, array $headers = []): self
    {
        return new self($status, $payload, $headers);
    }

    public static function noContent(): self
    {
        return new self(204, null);
    }

    /** The standard error envelope: { "error": { code, message, field? } }. */
    public static function error(int $status, string $code, string $message, ?string $field = null): self
    {
        $err = ['code' => $code, 'message' => $message];
        if ($field !== null) {
            $err['field'] = $field;
        }
        return new self($status, ['error' => $err]);
    }

    public function send(): void
    {
        http_response_code($this->status);
        // Security headers on every response.
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        foreach ($this->headers as $k => $v) {
            header("{$k}: {$v}");
        }
        if ($this->status === 204 || $this->payload === null) {
            return;
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($this->payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
