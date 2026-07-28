<?php

declare(strict_types=1);

/**
 * CLI parity harness entry: reads a nest case as JSON on stdin, writes the
 * PHP engine's result as JSON on stdout. Used by the JS-vs-PHP parity gate so
 * it needn't go through HTTP/auth.
 *
 *   echo '{"sheet":{...},"grainLock":false,"items":[...]}' | php scripts/engine_nest.php
 */

use Standscale\Products\WallView\Engine\Nester;

require dirname(__DIR__) . '/vendor/autoload.php';

$in = json_decode(stream_get_contents(STDIN) ?: 'null', true);
if (!is_array($in) || !isset($in['sheet'], $in['items'])) {
    fwrite(STDERR, "bad input\n");
    exit(1);
}

$result = Nester::nest($in['sheet'], (bool) ($in['grainLock'] ?? false), $in['items']);
echo json_encode($result, JSON_UNESCAPED_SLASHES);
