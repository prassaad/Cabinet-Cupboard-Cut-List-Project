<?php

declare(strict_types=1);

namespace Standscale\Security\Contracts;

interface IRateLimiter
{
    /** @return bool true if the request is allowed; false if the quota is exhausted. */
    public function allow(string $key, int $limit, int $windowSeconds): bool;
}
