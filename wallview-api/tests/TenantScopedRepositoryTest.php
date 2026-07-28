<?php

declare(strict_types=1);

namespace Standscale\Tests;

use PHPUnit\Framework\TestCase;
use Ramsey\Uuid\Uuid;
use Standscale\Security\Db\Connection;
use Standscale\Security\TenantContext;
use Standscale\Support\Config;
use Standscale\SaasCore\Repository\TenantConfigRepository;

/**
 * Proves the isolation invariant: a TenantScopedRepository, given tenant A's
 * context, can NEVER read tenant B's rows — the tenant predicate is injected
 * structurally, not left to each query. Runs against local wallview_dev.
 */
final class TenantScopedRepositoryTest extends TestCase
{
    private Connection $db;
    private string $wsA;
    private string $wsB;

    protected function setUp(): void
    {
        $this->db = new Connection(new Config($_ENV));

        // Two isolated tenants with distinct branding.
        $this->wsA = $this->makeTenant('iso-a');
        $this->wsB = $this->makeTenant('iso-b');
        $this->seedConfig($this->wsA, 'Alpha');
        $this->seedConfig($this->wsB, 'Beta');
    }

    protected function tearDown(): void
    {
        // Cascades remove companies/users/config/roles automatically.
        $this->db->run('DELETE FROM tenants WHERE tenant_workspace_id IN (:a, :b)', ['a' => $this->wsA, 'b' => $this->wsB]);
    }

    public function testScopedRepoOnlySeesItsOwnTenant(): void
    {
        $repoA = new TenantConfigRepository($this->db, $this->contextFor($this->wsA));
        $repoB = new TenantConfigRepository($this->db, $this->contextFor($this->wsB));

        $a = $repoA->current();
        $b = $repoB->current();

        self::assertNotNull($a);
        self::assertNotNull($b);
        self::assertSame('Alpha', $a['brand']['name']);
        self::assertSame('Beta', $b['brand']['name']);
        // The crux: A's repo returns A's brand, never B's — even though the query
        // named no tenant; the base class supplied the predicate.
        self::assertNotSame($a['brand']['name'], $b['brand']['name']);
    }

    public function testUnscopedContextRefusesToQuery(): void
    {
        $repo = new TenantConfigRepository($this->db, new TenantContext()); // no claims set
        $this->expectException(\RuntimeException::class);
        $repo->current();
    }

    private function contextFor(string $ws): TenantContext
    {
        $ctx = new TenantContext();
        $ctx->setClaims(['sub' => 'u', 'TenantWorkspaceId' => $ws, 'Subdomain' => $ws, 'roles' => ['Admin']]);
        return $ctx;
    }

    private function makeTenant(string $slugPrefix): string
    {
        $id = Uuid::uuid4()->toString();
        $ws = Uuid::uuid4()->toString();
        $sub = $slugPrefix . '-' . substr($ws, 0, 8);
        $this->db->run(
            'INSERT INTO tenants (id, tenant_workspace_id, business_name, subdomain) VALUES (:id, :ws, :bn, :sd)',
            ['id' => $id, 'ws' => $ws, 'bn' => 'T', 'sd' => $sub]
        );
        return $ws;
    }

    private function seedConfig(string $ws, string $brandName): void
    {
        $this->db->run(
            'INSERT INTO tenant_config (tenant_workspace_id, brand, features) VALUES (:ws, :b, :f)',
            ['ws' => $ws, 'b' => json_encode(['name' => $brandName]), 'f' => json_encode(['pricingEnabled' => true])]
        );
    }
}
