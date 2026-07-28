<?php

declare(strict_types=1);

namespace Standscale\Http;

/**
 * Route table. Replaces the legacy 40-branch if/preg_match router.
 *
 * A route = HTTP method + path pattern (with {param} placeholders) mapped to
 * a handler [serviceId, method] plus an ordered list of middleware service ids.
 * Path segment {tenant} is captured but is NEVER the authorization boundary
 * (see TenantMiddleware) — it is a checked assertion against the JWT claim.
 */
final class Router
{
    /** @var array<int,array{method:string,regex:string,vars:string[],handler:array,middleware:string[]}> */
    private array $routes = [];

    /**
     * @param array{0:string,1:string} $handler [containerServiceId, methodName]
     * @param string[] $middleware ordered container service ids
     */
    public function add(string $method, string $pattern, array $handler, array $middleware = []): void
    {
        $vars = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', function ($m) use (&$vars) {
            $vars[] = $m[1];
            return '(?P<' . $m[1] . '>[^/]+)';
        }, $pattern);

        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '$#',
            'vars' => $vars,
            'handler' => $handler,
            'middleware' => $middleware,
        ];
    }

    public function get(string $p, array $h, array $mw = []): void    { $this->add('GET', $p, $h, $mw); }
    public function post(string $p, array $h, array $mw = []): void   { $this->add('POST', $p, $h, $mw); }
    public function put(string $p, array $h, array $mw = []): void    { $this->add('PUT', $p, $h, $mw); }
    public function delete(string $p, array $h, array $mw = []): void { $this->add('DELETE', $p, $h, $mw); }

    /**
     * @return array{handler:array,middleware:string[],params:array<string,string>}
     * @throws HttpException 404 no path match, 405 path but wrong method
     */
    public function match(string $method, string $path): array
    {
        $pathMatched = false;
        foreach ($this->routes as $r) {
            if (!preg_match($r['regex'], $path, $m)) {
                continue;
            }
            $pathMatched = true;
            if ($r['method'] !== strtoupper($method)) {
                continue;
            }
            $params = [];
            foreach ($r['vars'] as $v) {
                $params[$v] = $m[$v];
            }
            return ['handler' => $r['handler'], 'middleware' => $r['middleware'], 'params' => $params];
        }

        if ($pathMatched) {
            throw new HttpException(405, 'method_not_allowed', "Method {$method} not allowed for {$path}.");
        }
        throw HttpException::notFound("No route for {$method} {$path}.");
    }
}
