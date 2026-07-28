<?php

declare(strict_types=1);

namespace Standscale\Http;

use Standscale\Support\Config;

/**
 * Front-controller kernel: match route -> run middleware pipeline -> controller,
 * with one global exception handler that renders the JSON error envelope.
 */
final class Kernel
{
    private Container $container;
    private Router $router;
    private Config $config;

    public function __construct(Container $container, Router $router, Config $config)
    {
        $this->container = $container;
        $this->router = $router;
        $this->config = $config;
    }

    public function handle(Request $request): Response
    {
        try {
            $matched = $this->router->match($request->method, $request->path);
            $request->params = $matched['params'];

            // Build the pipeline: middleware... -> controller.
            $core = function (Request $req) use ($matched): Response {
                [$serviceId, $method] = $matched['handler'];
                $controller = $this->container->get($serviceId);
                $result = $controller->{$method}($req);
                return $result instanceof Response ? $result : Response::json($result);
            };

            $pipeline = array_reduce(
                array_reverse($matched['middleware']),
                function (callable $next, string $mwId): callable {
                    return function (Request $req) use ($next, $mwId): Response {
                        /** @var Middleware $mw */
                        $mw = $this->container->get($mwId);
                        return $mw->handle($req, $next);
                    };
                },
                $core
            );

            return $pipeline($request);
        } catch (HttpException $e) {
            return Response::error($e->status, $e->errorCode, $e->getMessage(), $e->field);
        } catch (\Throwable $e) {
            error_log('[wallview-api] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            $message = $this->config->isDev()
                ? $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine()
                : 'Internal server error.';
            return Response::error(500, 'internal_error', $message);
        }
    }
}
