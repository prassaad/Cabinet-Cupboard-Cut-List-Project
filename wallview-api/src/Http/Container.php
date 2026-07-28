<?php

declare(strict_types=1);

namespace Standscale\Http;

/**
 * A tiny lazy service container. Factories are registered by id and resolved
 * once (singletons). Keeps wiring explicit without pulling a framework.
 */
final class Container
{
    /** @var array<string,callable> */
    private array $factories = [];
    /** @var array<string,mixed> */
    private array $instances = [];

    public function set(string $id, callable $factory): void
    {
        $this->factories[$id] = $factory;
    }

    public function get(string $id)
    {
        if (array_key_exists($id, $this->instances)) {
            return $this->instances[$id];
        }
        if (!isset($this->factories[$id])) {
            throw new \RuntimeException("Service '{$id}' is not registered.");
        }
        return $this->instances[$id] = ($this->factories[$id])($this);
    }

    public function has(string $id): bool
    {
        return isset($this->factories[$id]) || array_key_exists($id, $this->instances);
    }
}
