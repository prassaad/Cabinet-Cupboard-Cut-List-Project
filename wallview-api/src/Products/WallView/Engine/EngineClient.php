<?php

declare(strict_types=1);

namespace Standscale\Products\WallView\Engine;

use Standscale\Http\HttpException;
use Standscale\Support\Config;

/**
 * Talks to the internal Node engine service. The engine runs the real JS engine
 * headless; the PHP API is the only thing that calls it (browsers never do), so
 * the engine code never ships to the client. ENGINE_URL points at wherever Node
 * runs (a cPanel Node app, or a separate host); ENGINE_KEY is a shared secret.
 */
final class EngineClient
{
    private string $baseUrl;
    private string $key;
    private int $timeoutMs;

    public function __construct(Config $config)
    {
        $this->baseUrl = rtrim((string) $config->get('ENGINE_URL', 'http://127.0.0.1:4001'), '/');
        $this->key = (string) $config->get('ENGINE_KEY', '');
        $this->timeoutMs = $config->int('ENGINE_TIMEOUT_MS', 5000);
    }

    /**
     * @param array<string,mixed> $body {design, scope, currency?, prices?}
     * @return array<string,mixed> the render model
     */
    public function compute(array $body): array
    {
        return $this->post('/compute', $body);
    }

    /**
     * @param array<string,mixed> $body {design, op, args, scope}
     * @return array<string,mixed> {design, model}
     */
    public function edit(array $body): array
    {
        return $this->post('/edit', $body);
    }

    /**
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function post(string $pathSuffix, array $body): array
    {
        $url = $this->baseUrl . $pathSuffix;
        $json = json_encode($body, JSON_UNESCAPED_SLASHES);

        $headers = ['Content-Type: application/json'];
        if ($this->key !== '') {
            $headers[] = 'X-Engine-Key: ' . $this->key;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT_MS => $this->timeoutMs,
            CURLOPT_CONNECTTIMEOUT_MS => $this->timeoutMs,
        ]);
        $resp = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($resp === false || $status === 0) {
            // Engine unreachable — surface as 503 so the client can fall back.
            throw new HttpException(503, 'engine_unavailable', 'Engine service is unreachable' . ($err ? ": $err" : '.'));
        }
        $data = json_decode((string) $resp, true);
        if (!is_array($data)) {
            throw new HttpException(502, 'engine_bad_response', 'Engine returned an invalid response.');
        }
        if ($status >= 400) {
            $msg = $data['error']['message'] ?? 'Engine error.';
            throw new HttpException($status === 401 ? 502 : $status, 'engine_error', (string) $msg);
        }
        return $data;
    }
}
