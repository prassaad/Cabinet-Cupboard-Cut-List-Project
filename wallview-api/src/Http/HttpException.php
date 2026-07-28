<?php

declare(strict_types=1);

namespace Standscale\Http;

/**
 * An exception that maps directly to the JSON error envelope + an HTTP status.
 * Controllers/middleware throw these; the Kernel renders them.
 */
class HttpException extends \RuntimeException
{
    public int $status;
    public string $errorCode;
    public ?string $field;

    public function __construct(int $status, string $errorCode, string $message, ?string $field = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $errorCode;
        $this->field = $field;
    }

    public static function badRequest(string $message, ?string $field = null): self
    {
        return new self(400, 'bad_request', $message, $field);
    }

    public static function unauthorized(string $message = 'Authentication required.'): self
    {
        return new self(401, 'unauthorized', $message);
    }

    public static function forbidden(string $message = 'Forbidden.'): self
    {
        return new self(403, 'forbidden', $message);
    }

    public static function notFound(string $message = 'Not found.'): self
    {
        return new self(404, 'not_found', $message);
    }

    public static function conflict(string $message): self
    {
        return new self(409, 'conflict', $message);
    }

    public static function unprocessable(string $message, ?string $field = null): self
    {
        return new self(422, 'unprocessable', $message, $field);
    }

    public static function tooManyRequests(string $message = 'Rate limit exceeded.'): self
    {
        return new self(429, 'rate_limited', $message);
    }
}
