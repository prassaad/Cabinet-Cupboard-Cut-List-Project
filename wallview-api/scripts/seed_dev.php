<?php

declare(strict_types=1);

/**
 * Seed a ready-to-use WallView dev workspace + admin, bypassing the funnel.
 * Run:  php scripts/seed_dev.php
 * Then log in with:  admin@wallview.local / password  (subdomain: wallview)
 */

use Standscale\Http\Container;
use Standscale\Security\Db\Connection;
use Standscale\Security\PasswordHasher;
use Standscale\SaasCore\Repository\RoleRepository;
use Standscale\SaasCore\Repository\TenantRepository;
use Standscale\SaasCore\Repository\UserRepository;

/** @var array{0:Container} $boot */
$boot = require dirname(__DIR__) . '/bootstrap.php';
[$c] = $boot;

$db = $c->get(Connection::class);
$tenants = $c->get(TenantRepository::class);
$users = $c->get(UserRepository::class);
$roles = $c->get(RoleRepository::class);
$hasher = $c->get(PasswordHasher::class);

$SUBDOMAIN = 'wallview';
$EMAIL = 'admin@wallview.local';
$PASSWORD = 'password';

if ($tenants->subdomainTaken($SUBDOMAIN)) {
    fwrite(STDERR, "Tenant '{$SUBDOMAIN}' already exists — nothing to do.\n");
    exit(0);
}

$pdo = $db->pdo();
$pdo->beginTransaction();
try {
    $t = $tenants->create('WallView', $SUBDOMAIN, 'IN', 'India', true);
    $ws = $t['tenant_workspace_id'];

    $userId = $users->create($ws, $SUBDOMAIN, 'WallView Admin', $EMAIL, $hasher->hash($PASSWORD), true);
    $adminRole = $roles->create($ws, 'Admin');
    $roles->create($ws, 'Member');
    $roles->assign($userId, $adminRole, $ws);

    $tenants->createDefaultConfig(
        $ws,
        ['name' => 'WallView', 'logoUrl' => null, 'iconUrl' => null, 'accent' => '#e0a93a', 'poweredBy' => 'Sky Furnitures'],
        ['maxModules' => 100, 'pricingEnabled' => true, 'exportEnabled' => true],
        'mm'
    );
    $pdo->commit();
} catch (\Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'Seed failed: ' . $e->getMessage() . "\n");
    exit(1);
}

echo "Seeded WallView workspace.\n";
echo "  subdomain: {$SUBDOMAIN}\n  email:     {$EMAIL}\n  password:  {$PASSWORD}\n";
