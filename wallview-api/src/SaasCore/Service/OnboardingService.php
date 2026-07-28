<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Service;

use Standscale\Http\HttpException;
use Standscale\Security\Db\Connection;
use Standscale\Security\PasswordHasher;
use Standscale\SaasCore\Repository\CompanyRepository;
use Standscale\SaasCore\Repository\FunnelRepository;
use Standscale\SaasCore\Repository\RoleRepository;
use Standscale\SaasCore\Repository\TenantRepository;
use Standscale\SaasCore\Repository\UserRepository;

/**
 * The onboarding funnel: contact -> verify -> setup-workspace (provision tenant
 * + company + admin + roles + default config) -> auto-login. Generalised from
 * the legacy WorkspaceController/FunctionalService/VerificationService, minus
 * the plaintext-password write into `tenants`.
 */
final class OnboardingService
{
    private FunnelRepository $funnel;
    private TenantRepository $tenants;
    private CompanyRepository $companies;
    private UserRepository $users;
    private RoleRepository $roles;
    private PasswordHasher $hasher;
    private AuthService $auth;
    private Connection $db;
    private bool $devEcho;

    public function __construct(
        FunnelRepository $funnel,
        TenantRepository $tenants,
        CompanyRepository $companies,
        UserRepository $users,
        RoleRepository $roles,
        PasswordHasher $hasher,
        AuthService $auth,
        Connection $db,
        bool $devEcho
    ) {
        $this->funnel = $funnel;
        $this->tenants = $tenants;
        $this->companies = $companies;
        $this->users = $users;
        $this->roles = $roles;
        $this->hasher = $hasher;
        $this->auth = $auth;
        $this->db = $db;
        $this->devEcho = $devEcho;
    }

    /** Step 1: capture contact, issue an email verification code. */
    public function register(string $email, ?string $mobile): array
    {
        $email = $this->normalizeEmail($email);
        $this->funnel->upsertContact($email, $mobile);
        $code = $this->sixDigitCode();
        $this->funnel->createVerificationToken($email, $code, 30);
        // In prod this is emailed; in dev we return it so the flow is testable.
        return $this->devEcho ? ['status' => 'verification_sent', 'devCode' => $code]
                              : ['status' => 'verification_sent'];
    }

    /** Step 2: check the code, issue a single-use invite code for setup. */
    public function verify(string $email, string $code): array
    {
        $email = $this->normalizeEmail($email);
        $tok = $this->funnel->findValidVerification($email, $code);
        if ($tok === null) {
            throw HttpException::unprocessable('Verification code is invalid or expired.', 'code');
        }
        $this->funnel->markVerificationUsed((string) $tok['id']);
        $invite = $this->sixDigitCode() . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
        $this->funnel->createInviteCode($email, $invite, 60);
        return $this->devEcho ? ['status' => 'verified', 'inviteCode' => $invite]
                              : ['status' => 'verified'];
    }

    /**
     * Step 3: provision the workspace and auto-login.
     * @param array<string,mixed> $data
     * @return array{accessToken:string,refreshToken:string,user:array,tenant:array}
     */
    public function setupWorkspace(array $data): array
    {
        $inviteCode = (string) ($data['inviteCode'] ?? '');
        $email = $this->normalizeEmail((string) ($data['email'] ?? ''));
        $subdomain = strtolower(trim((string) ($data['subdomain'] ?? '')));
        $businessName = trim((string) ($data['businessName'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $adminName = trim((string) ($data['adminName'] ?? '')) ?: $email;

        if ($businessName === '' || $subdomain === '' || $password === '') {
            throw HttpException::badRequest('businessName, subdomain and password are required.');
        }
        if (!preg_match('/^[a-z0-9][a-z0-9-]{1,62}$/', $subdomain)) {
            throw HttpException::unprocessable('subdomain must be a lowercase slug (a-z, 0-9, -).', 'subdomain');
        }
        if (strlen($password) < 8) {
            throw HttpException::unprocessable('Password must be at least 8 characters.', 'password');
        }

        $invite = $this->funnel->findValidInvite($inviteCode);
        if ($invite === null || $this->normalizeEmail((string) $invite['email']) !== $email) {
            throw HttpException::unprocessable('Invite code is invalid, expired, or for a different email.', 'inviteCode');
        }
        if ($this->tenants->subdomainTaken($subdomain)) {
            throw HttpException::conflict('That workspace subdomain is already taken.');
        }

        // Provision atomically — a half-created workspace is worse than none.
        $pdo = $this->db->pdo();
        $pdo->beginTransaction();
        try {
            $tenant = $this->tenants->create($businessName, $subdomain, $data['region'] ?? null, $data['country'] ?? null, true);
            $ws = $tenant['tenant_workspace_id'];

            $this->companies->create($ws, $businessName, $data['country'] ?? null);

            $userId = $this->users->create(
                $ws,
                $subdomain,
                $adminName,
                $email,
                $this->hasher->hash($password),
                true
            );

            // Default roles; the first admin gets Admin.
            $adminRoleId = $this->roles->create($ws, 'Admin');
            $this->roles->create($ws, 'Member');
            $this->roles->assign($userId, $adminRoleId, $ws);

            $this->tenants->createDefaultConfig(
                $ws,
                ['name' => $businessName, 'logoUrl' => null, 'iconUrl' => null, 'accent' => '#e0a93a'],
                ['maxModules' => 50, 'pricingEnabled' => true, 'exportEnabled' => true],
                'mm'
            );

            $this->funnel->markInviteUsed((string) $invite['id']);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $userRow = $this->users->findById($userId);
        $session = $this->auth->issueFor($userRow);
        $session['tenant'] = [
            'workspaceId' => $tenant['tenant_workspace_id'],
            'subdomain' => $subdomain,
            'businessName' => $businessName,
        ];
        return $session;
    }

    private function normalizeEmail(string $email): string
    {
        $email = strtolower(trim($email));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw HttpException::unprocessable('A valid email is required.', 'email');
        }
        return $email;
    }

    private function sixDigitCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}
