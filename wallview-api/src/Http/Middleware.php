<?php

declare(strict_types=1);

namespace Standscale\Http;

/**
 * A middleware receives the request and a $next callable that produces the
 * downstream Response. It may short-circuit (throw HttpException / return a
 * Response) or delegate via $next($request).
 */
interface Middleware
{
    public function handle(Request $request, callable $next): Response;
}
