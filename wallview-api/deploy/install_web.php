<?php

declare(strict_types=1);

/**
 * ONE-TIME web installer — creates the first workspace + admin over HTTP,
 * because the CLI seed (scripts/seed_dev.php) needs a terminal.
 *
 * DEPLOY:
 *   1. Edit INSTALL_TOKEN below to a private value.
 *   2. Upload this file into the app's  public/  folder as  install.php
 *   3. Browse to:  https://<host>/<mount>/public/install.php?token=YOURTOKEN
 *        &email=you@company.com&password=YourStrongPass&subdomain=wallview&business=WallView
 *      (subdomain/business optional; defaults shown)
 *   4. DELETE this file immediately after it prints success.
 *
 * It refuses to run if the token is wrong or the subdomain already exists.
 */

const INSTALL_TOKEN = 'CHANGE-ME-TO-A-SECRET';

use Standscale\Http\Container;
use Standscale\Security\Db\Connection;
use Standscale\Security\PasswordHasher;
use Standscale\SaasCore\Repository\RoleRepository;
use Standscale\SaasCore\Repository\TenantRepository;
use Standscale\SaasCore\Repository\UserRepository;

header('Content-Type: text/plain; charset=utf-8');

if (!hash_equals(INSTALL_TOKEN, (string) ($_GET['token'] ?? ''))) {
    http_response_code(403);
    exit("Forbidden. Set INSTALL_TOKEN and pass ?token=...\n");
}

$email     = strtolower(trim((string) ($_GET['email'] ?? 'admin@wallview.local')));
$password  = (string) ($_GET['password'] ?? 'password');
$subdomain = strtolower(trim((string) ($_GET['subdomain'] ?? 'wallview')));
$business  = trim((string) ($_GET['business'] ?? 'WallView'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
    http_response_code(422);
    exit("Provide a valid &email= and a &password= of at least 8 characters.\n");
}

// Find the app code: a protected "_core/" beside this file (shared hosting),
// or one level above public/ (code kept above the web root).
/** @var array{0:Container} $boot */
$bootstrapFile = is_file(__DIR__ . '/_core/bootstrap.php')
    ? __DIR__ . '/_core/bootstrap.php'
    : dirname(__DIR__) . '/bootstrap.php';
$boot = require $bootstrapFile;
[$c] = $boot;

$db      = $c->get(Connection::class);
$tenants = $c->get(TenantRepository::class);
$users   = $c->get(UserRepository::class);
$roles   = $c->get(RoleRepository::class);
$hasher  = $c->get(PasswordHasher::class);

if ($tenants->subdomainTaken($subdomain)) {
    exit("Subdomain '{$subdomain}' already exists — nothing to do. Delete this file.\n");
}

$pdo = $db->pdo();
$pdo->beginTransaction();
try {
    $t  = $tenants->create($business, $subdomain, 'IN', 'India', true);
    $ws = $t['tenant_workspace_id'];

    $userId    = $users->create($ws, $subdomain, $business . ' Admin', $email, $hasher->hash($password), true);
    $adminRole = $roles->create($ws, 'Admin');
    $roles->create($ws, 'Member');
    $roles->assign($userId, $adminRole, $ws);

    $tenants->createDefaultConfig(
        $ws,
        ['name' => $business, 'logoUrl' => null, 'iconUrl' => null, 'accent' => '#e0a93a'],
        ['maxModules' => 100, 'pricingEnabled' => true, 'exportEnabled' => true],
        'mm'
    );
    $pdo->commit();
} catch (\Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    exit('Install failed: ' . $e->getMessage() . "\n");
}

echo "Installed WallView workspace.\n";
echo "  subdomain: {$subdomain}\n  email:     {$email}\n  password:  (the one you supplied)\n\n";
echo "NOW DELETE THIS FILE (install.php) from the server.\n";
