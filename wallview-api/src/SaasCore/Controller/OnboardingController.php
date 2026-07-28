<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Controller;

use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\SaasCore\Service\OnboardingService;

final class OnboardingController
{
    private OnboardingService $onboarding;

    public function __construct(OnboardingService $onboarding)
    {
        $this->onboarding = $onboarding;
    }

    public function register(Request $r): Response
    {
        $out = $this->onboarding->register((string) $r->input('email', ''), $r->input('mobile'));
        return Response::json($out, 201);
    }

    public function verify(Request $r): Response
    {
        $out = $this->onboarding->verify((string) $r->input('email', ''), (string) $r->input('code', ''));
        return Response::json($out);
    }

    public function setupWorkspace(Request $r): Response
    {
        $out = $this->onboarding->setupWorkspace($r->body);
        return Response::json($out, 201);
    }
}
