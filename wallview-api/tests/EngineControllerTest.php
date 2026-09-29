<?php

declare(strict_types=1);

namespace Standscale\Tests;

use PHPUnit\Framework\TestCase;
use Standscale\Http\Request;
use Standscale\Products\WallView\Controller\EngineController;
use Standscale\Products\WallView\Engine\EngineClient;
use Standscale\Support\Config;

/**
 * The engine endpoints are a pass-through proxy, so the thing worth testing is
 * that the proxy forwards exactly what the client asked for — in particular the
 * Wall designer's `room` flag, without which a wall edit would need a second
 * round trip to redraw the wall.
 *
 * EngineClient is final (it cannot be mocked), so the test stands up a real
 * one-shot HTTP listener on an ephemeral localhost port and inspects the body
 * the controller actually put on the wire.
 */
final class EngineControllerTest extends TestCase
{
    /** @var resource|null */
    private $server;
    private int $port = 0;

    protected function setUp(): void
    {
        $this->server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if ($this->server === false) {
            $this->markTestSkipped("cannot open a local socket: $errstr");
        }
        $name = stream_socket_get_name($this->server, false);
        $this->port = (int) substr((string) $name, strrpos((string) $name, ':') + 1);
    }

    protected function tearDown(): void
    {
        if (is_resource($this->server)) {
            fclose($this->server);
        }
    }

    private function controller(): EngineController
    {
        $config = new Config([
            'JWT_KEY' => str_repeat('k', 48),          // Config refuses to boot without one
            'ENGINE_URL' => 'http://127.0.0.1:' . $this->port,
            // Short on purpose: this is a single-threaded test, so curl writes its
            // request into the listen backlog and then times out waiting for a
            // reply we only send after accepting. The request body is already on
            // the wire by then, which is all this test inspects.
            'ENGINE_TIMEOUT_MS' => '250',
        ]);
        return new EngineController(new EngineClient($config));
    }

    /**
     * Serves one request, returns the decoded JSON body the controller sent.
     *
     * @return array<string,mixed>
     */
    private function captureRequestBody(callable $act): array
    {
        // Single-threaded: the OS queues the connection in the listen backlog, so
        // curl completes its write and gives up on the reply, and we read the body
        // it left behind afterwards. No child process, so this runs on Windows too.
        $captured = '';
        $act();

        $conn = @stream_socket_accept($this->server, 5);
        if ($conn === false) {
            $this->fail('the controller never called the engine');
        }
        stream_set_timeout($conn, 2);
        $raw = '';
        while (($line = fgets($conn)) !== false) {
            $raw .= $line;
            if (rtrim($line) === '') {
                break;   // end of headers
            }
        }
        $len = 0;
        if (preg_match('/Content-Length:\s*(\d+)/i', $raw, $m)) {
            $len = (int) $m[1];
        }
        if ($len > 0) {
            $captured = (string) stream_get_contents($conn, $len);
        }
        fwrite($conn, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}");
        fclose($conn);

        return json_decode($captured, true) ?? [];
    }

    public function testEditForwardsTheRoomFlagForTheWallDesigner(): void
    {
        $controller = $this->controller();
        $request = new Request('POST', '/api/v1/acme/engine/edit', [
            'design' => ['modules' => [], 'active' => -1],
            'op' => 'place_module',
            'args' => ['id' => 'm1', 'offsetX' => 800, 'baseHeight' => 0],
            'scope' => 'job',
            'room' => true,
        ], [], []);

        $sent = $this->captureRequestBody(static function () use ($controller, $request): void {
            try {
                $controller->edit($request);
            } catch (\Throwable $e) {
                // The stub answers "{}" — we only care about what went out.
            }
        });

        self::assertSame('place_module', $sent['op'] ?? null);
        self::assertSame('job', $sent['scope'] ?? null);
        self::assertTrue($sent['room'] ?? null, 'room must reach the engine or the wall cannot refresh in one trip');
        self::assertTrue($sent['render'] ?? null, 'render defaults to true');
        self::assertSame(800, $sent['args']['offsetX'] ?? null);
    }

    public function testEditDefaultsRoomOffSoExistingCallersAreUnchanged(): void
    {
        $controller = $this->controller();
        $request = new Request('POST', '/api/v1/acme/engine/edit', [
            'design' => ['modules' => [], 'active' => -1],
            'op' => 'add_shelves',
            'args' => ['count' => 2],
        ], [], []);

        $sent = $this->captureRequestBody(static function () use ($controller, $request): void {
            try {
                $controller->edit($request);
            } catch (\Throwable $e) {
            }
        });

        self::assertFalse($sent['room'] ?? null, 'a plain edit must not pay for the room model');
        self::assertSame('module', $sent['scope'] ?? null);
    }
}
