<?php

declare(strict_types=1);

namespace Standscale\Security\Repository;

use Standscale\Security\Db\Connection;
use Standscale\Security\TenantContext;

/**
 * Base repository that makes tenant isolation STRUCTURAL: every read/write
 * helper injects the current tenant_workspace_id from TenantContext, so no
 * subclass query can forget the predicate. This is the invariant ARCH-004 §7
 * requires (vs the legacy "best-effort WHERE" scattered across 30 queries).
 *
 * Subclasses that need bespoke SQL still get the tenant via currentTenant().
 */
abstract class TenantScopedRepository
{
    protected Connection $db;
    protected TenantContext $tenant;

    public function __construct(Connection $db, TenantContext $tenant)
    {
        $this->db = $db;
        $this->tenant = $tenant;
    }

    /** Fully-qualified table name for this aggregate. */
    abstract protected function table(): string;

    /** The tenant column (override if a table uses a different name). */
    protected function tenantColumn(): string
    {
        return 'tenant_workspace_id';
    }

    protected function currentTenant(): string
    {
        return $this->tenant->requireTenant();
    }

    /**
     * SELECT * scoped to the current tenant, with an optional extra WHERE.
     * @param array<string,mixed> $where  column => value (ANDed)
     * @return array<int,array<string,mixed>>
     */
    protected function scopedAll(array $where = [], string $orderBy = ''): array
    {
        [$sql, $params] = $this->buildSelect($where, $orderBy);
        return $this->db->all($sql, $params);
    }

    /**
     * @param array<string,mixed> $where
     * @return array<string,mixed>|null
     */
    protected function scopedFirst(array $where = []): ?array
    {
        [$sql, $params] = $this->buildSelect($where, '', 1);
        return $this->db->first($sql, $params);
    }

    /**
     * INSERT with the tenant column forced to the current tenant.
     * @param array<string,mixed> $data
     */
    protected function scopedInsert(array $data): void
    {
        $data[$this->tenantColumn()] = $this->currentTenant();
        $cols = array_keys($data);
        $place = implode(', ', array_map(fn ($c) => ':' . $c, $cols));
        $collist = implode(', ', array_map(fn ($c) => "`{$c}`", $cols));
        $sql = "INSERT INTO `{$this->table()}` ({$collist}) VALUES ({$place})";
        $this->db->run($sql, $this->bind($data));
    }

    /**
     * UPDATE scoped to the current tenant.
     * @param array<string,mixed> $data
     * @param array<string,mixed> $where
     */
    protected function scopedUpdate(array $data, array $where): int
    {
        $set = implode(', ', array_map(fn ($c) => "`{$c}` = :set_{$c}", array_keys($data)));
        $params = [];
        foreach ($data as $c => $v) {
            $params["set_{$c}"] = $v;
        }
        [$whereSql, $whereParams] = $this->tenantWhere($where);
        $sql = "UPDATE `{$this->table()}` SET {$set} WHERE {$whereSql}";
        return $this->db->run($sql, array_merge($this->bind($params, ''), $whereParams))->rowCount();
    }

    /** @param array<string,mixed> $where */
    protected function scopedDelete(array $where): int
    {
        [$whereSql, $whereParams] = $this->tenantWhere($where);
        $sql = "DELETE FROM `{$this->table()}` WHERE {$whereSql}";
        return $this->db->run($sql, $whereParams)->rowCount();
    }

    /**
     * @param array<string,mixed> $where
     * @return array{0:string,1:array<string,mixed>}
     */
    private function buildSelect(array $where, string $orderBy, ?int $limit = null): array
    {
        [$whereSql, $params] = $this->tenantWhere($where);
        $sql = "SELECT * FROM `{$this->table()}` WHERE {$whereSql}";
        if ($orderBy !== '') {
            $sql .= " ORDER BY {$orderBy}";
        }
        if ($limit !== null) {
            $sql .= " LIMIT {$limit}";
        }
        return [$sql, $params];
    }

    /**
     * Always prefixes the tenant predicate. Returns "tenant = :__t AND col = :w_col ...".
     * @param array<string,mixed> $where
     * @return array{0:string,1:array<string,mixed>}
     */
    private function tenantWhere(array $where): array
    {
        $sql = "`{$this->tenantColumn()}` = :__t";
        $params = ['__t' => $this->currentTenant()];
        foreach ($where as $col => $val) {
            $sql .= " AND `{$col}` = :w_{$col}";
            $params["w_{$col}"] = $val;
        }
        return [$sql, $params];
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    private function bind(array $data, string $prefix = ''): array
    {
        $out = [];
        foreach ($data as $k => $v) {
            $out[$prefix . $k] = $v;
        }
        return $out;
    }
}
