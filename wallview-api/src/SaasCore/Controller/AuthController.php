<?php

declare(strict_types=1);

namespace Standscale\SaasCore\Controller;

use Standscale\Http\HttpException;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\SaasCore\Service\AuthService;

final class AuthController
{
    private AuthService $auth;

    public function __construct(AuthService $auth)
    {
        $this->auth = $auth;
    }

    public function login(Request $r): Response
    {
        $email = (string) $r->input('email', '');
        $subdomain = strtolower((string) $r->input('subdomain', ''));
        $password = (string) $r->input('password', '');
        if ($email === '' || $subdomain === '' || $password === '') {
            throw HttpException::badRequest('email, subdomain and password are required.');
        }
        return Response::json($this->auth->login($email, $subdomain, $password));
    }

    public function refresh(Request $r): Response
    {
        $token = (string) $r->input('refreshToken', '');
        if ($token === '') {
            throw HttpException::badRequest('refreshToken is required.', 'refreshToken');
        }
        return Response::json($this->auth->refresh($token));
    }

    public function logout(Request $r): Response
    {
        $token = (string) $r->input('refreshToken', '');
        if ($token !== '') {
            $this->auth->logout($token);
        }
        return Response::noContent();
    }
}
