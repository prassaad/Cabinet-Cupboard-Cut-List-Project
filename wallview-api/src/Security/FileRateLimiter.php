<?php

declare(strict_types=1);

namespace Standscale\Security;

use Standscale\Security\Contracts\IRateLimiter;

/**
 * A simple fixed-window rate limiter backed by per-key files. Adequate for a
 * single-node dev/small-prod deploy; swap the concretion (Redis) later via the
 * IRateLimiter interface without touching callers.
 */
final class FileRateLimiter implements IRateLimiter
{
    private string $dir;

    public function __construct(?string $dir = null)
    {
        $this->dir = $dir ?? (sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'wallview_ratelimit');
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0700, true);
        }
    }

    public function allow(string $key, int $limit, int $windowSeconds): bool
    {
        $window = (int) floor(time() / $windowSeconds);
        $file = $this->dir . DIRECTORY_SEPARATOR . hash('sha256', $key . '|' . $window);

        $fh = @fopen($file, 'c+');
        if ($fh === false) {
            return true; // fail open — never let the limiter take the API down
        }
        try {
            flock($fh, LOCK_EX);
            $count = (int) stream_get_contents($fh);
            $count++;
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, (string) $count);
            fflush($fh);
            return $count <= $limit;
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}
