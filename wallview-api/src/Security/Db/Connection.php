<?php

declare(strict_types=1);

namespace Standscale\Security\Db;

use Standscale\Support\Config;

/**
 * Single PDO access point. Unlike the legacy ProxyPDO/SafeStatement, this
 * FAILS LOUD: exceptions propagate, so a broken query can never masquerade
 * as "no rows". The Kernel's handler turns any uncaught PDOException into a
 * 500 error envelope.
 */
final class Connection
{
    private ?\PDO $pdo = null;
    private Config $config;

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    public function pdo(): \PDO
    {
        if ($this->pdo === null) {
            $host = $this->config->get('DB_HOST', '127.0.0.1');
            $port = $this->config->get('DB_PORT', '3306');
            $name = $this->config->require('DB_NAME');
            $user = $this->config->get('DB_USER', 'root');
            $pass = $this->config->get('DB_PASS', '');

            $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
            $this->pdo = new \PDO($dsn, $user, $pass, [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                \PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }
        return $this->pdo;
    }

    /** @param array<int|string,mixed> $params */
    public function run(string $sql, array $params = []): \PDOStatement
    {
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /** @param array<int|string,mixed> $params @return array<string,mixed>|null */
    public function first(string $sql, array $params = []): ?array
    {
        $row = $this->run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** @param array<int|string,mixed> $params @return array<int,array<string,mixed>> */
    public function all(string $sql, array $params = []): array
    {
        return $this->run($sql, $params)->fetchAll();
    }
}
