<?php

declare(strict_types=1);

/**
 * Add a dev login to an EXISTING tenant, without touching any account already there.
 *
 * seed_dev.php creates a whole new workspace; this is for the case where the
 * workspace (and its saved projects) already exist but nobody remembers the
 * password — passwords are argon2id, so they can never be read back.
 *
 * Run:
 *   php scripts/add_dev_user.php <subdomain> [email] [password]
 * e.g.
 *   php scripts/add_dev_user.php sky-furniture dev@sky.local password
 *
 * Reuses the tenant's existing Admin role if it has one, so no duplicate roles
 * appear. Refuses to overwrite an email that is already registered in the tenant.
 * Dev convenience only — never run this against production.
 */

use Standscale\Http\Container;
use Standscale\Security\Db\Connection;
use Standscale\Security\PasswordHasher;
use Standscale\SaasCore\Repository\RoleRepository;
use Standscale\SaasCore\Repository\UserRepository;

/** @var array{0:Container} $boot */
$boot = require dirname(__DIR__) . '/bootstrap.php';
[$c] = $boot;

$SUBDOMAIN = $argv[1] ?? '';
$EMAIL     = $argv[2] ?? 'dev@local.test';
$PASSWORD  = $argv[3] ?? 'password';

if ($SUBDOMAIN === '') {
    fwrite(STDERR, "Usage: php scripts/add_dev_user.php <subdomain> [email] [password]\n");
    exit(1);
}

$db     = $c->get(Connection::class);
$users  = $c->get(UserRepository::class);
$roles  = $c->get(RoleRepository::class);
$hasher = $c->get(PasswordHasher::class);

$tenant = $db->first(
    'SELECT tenant_workspace_id, business_name FROM tenants WHERE subdomain = :sd',
    ['sd' => $SUBDOMAIN]
);
if (!$tenant) {
    fwrite(STDERR, "No tenant with subdomain '{$SUBDOMAIN}'.\n");
    exit(1);
}
$ws = $tenant['tenant_workspace_id'];

if ($users->findByEmailAndSubdomain($EMAIL, $SUBDOMAIN)) {
    fwrite(STDERR, "'{$EMAIL}' already exists in '{$SUBDOMAIN}' — refusing to overwrite it.\n");
    exit(1);
}

$pdo = $db->pdo();
$pdo->beginTransaction();
try {
    $userId = $users->create($ws, $SUBDOMAIN, 'Dev User', $EMAIL, $hasher->hash($PASSWORD), true);

    // Reuse the tenant's Admin role rather than creating a second one.
    $role = $db->first(
        'SELECT id FROM roles WHERE tenant_workspace_id = :ws AND name = :n',
        ['ws' => $ws, 'n' => 'Admin']
    );
    $roleId = $role['id'] ?? $roles->create($ws, 'Admin');
    $roles->assign($userId, $roleId, $ws);

    $pdo->commit();
} catch (\Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'Failed: ' . $e->getMessage() . "\n");
    exit(1);
}

echo "Added a dev login to '{$tenant['business_name']}'.\n";
echo "  subdomain: {$SUBDOMAIN}\n  email:     {$EMAIL}\n  password:  {$PASSWORD}\n";
echo "Existing accounts were not modified.\n";
