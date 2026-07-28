<?php

declare(strict_types=1);

namespace Standscale\Products\WallView\Repository;

use Ramsey\Uuid\Uuid;
use Standscale\Security\Repository\TenantScopedRepository;

/**
 * Per-tenant design-document store. Extends the scoped base so every read/write
 * is confined to the caller's tenant structurally — a project can never be read
 * or overwritten across tenants.
 */
final class ProjectRepository extends TenantScopedRepository
{
    protected function table(): string
    {
        return 'projects';
    }

    /** @return array<int,array{id:string,name:string,updatedAt:string}> newest first */
    public function listMeta(): array
    {
        $rows = $this->db->all(
            'SELECT id, name, updated_at FROM projects WHERE tenant_workspace_id = :t ORDER BY updated_at DESC',
            ['t' => $this->currentTenant()]
        );
        return array_map(fn ($r) => [
            'id' => (string) $r['id'],
            'name' => (string) $r['name'],
            'updatedAt' => (string) $r['updated_at'],
        ], $rows);
    }

    /** @return array{id:string,name:string,design:mixed,updatedAt:string}|null */
    public function find(string $id): ?array
    {
        $row = $this->scopedFirst(['id' => $id]);
        if ($row === null) {
            return null;
        }
        return [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'design' => json_decode((string) $row['design'], true),
            'updatedAt' => (string) $row['updated_at'],
        ];
    }

    public function create(string $name, string $designJson, ?string $userId): string
    {
        $id = Uuid::uuid4()->toString();
        $this->scopedInsert([
            'id' => $id,
            'name' => $name,
            'design' => $designJson,
            'schema_version' => 1,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
        return $id;
    }

    /** @return bool true if a row was updated (i.e. it exists in this tenant) */
    public function update(string $id, string $name, string $designJson, ?string $userId): bool
    {
        return $this->scopedUpdate(
            ['name' => $name, 'design' => $designJson, 'updated_by' => $userId],
            ['id' => $id]
        ) > 0;
    }

    public function delete(string $id): bool
    {
        return $this->scopedDelete(['id' => $id]) > 0;
    }
}
