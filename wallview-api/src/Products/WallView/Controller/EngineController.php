<?php

declare(strict_types=1);

namespace Standscale\Products\WallView\Controller;

use Standscale\Http\HttpException;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\Products\WallView\Engine\EngineClient;
use Standscale\Products\WallView\Engine\Nester;

/**
 * The engine endpoints (ARCH-004 E1). `compute` proxies to the internal Node
 * engine service which runs the real engine headless — the derivation rules,
 * nesting and pricing all execute server-side and never ship to the browser.
 * `nest` is the standalone PHP nester (kept for the pure-optimiser path).
 */
final class EngineController
{
    private const MAX_DESIGN_BYTES = 1048576; // 1 MB

    private EngineClient $engine;

    public function __construct(EngineClient $engine)
    {
        $this->engine = $engine;
    }

    /** POST /{tenant}/engine/compute — derive cut list, nesting and BOM from a design. */
    public function compute(Request $r): Response
    {
        $design = $r->input('design');
        if (!is_array($design)) {
            throw HttpException::unprocessable('design must be a JSON object.', 'design');
        }
        if (strlen((string) json_encode($design)) > self::MAX_DESIGN_BYTES) {
            throw new HttpException(413, 'payload_too_large', 'Design exceeds the 1 MB limit.', 'design');
        }
        $scope = $r->input('scope') === 'job' ? 'job' : 'module';
        $result = $this->engine->compute([
            'design' => $design,
            'scope' => $scope,
            'currency' => $r->input('currency'),
            'render' => (bool) $r->input('render', false),
            'room' => (bool) $r->input('room', false),
        ]);
        return Response::json($result);
    }

    /** POST /{tenant}/engine/edit — apply one edit intent, return {design, model}. */
    public function edit(Request $r): Response
    {
        $design = $r->input('design');
        $op = $r->input('op');
        if (!is_array($design)) {
            throw HttpException::unprocessable('design must be a JSON object.', 'design');
        }
        if (!is_string($op) || $op === '') {
            throw HttpException::unprocessable('op is required.', 'op');
        }
        if (strlen((string) json_encode($design)) > self::MAX_DESIGN_BYTES) {
            throw new HttpException(413, 'payload_too_large', 'Design exceeds the 1 MB limit.', 'design');
        }
        $args = $r->input('args');
        return Response::json($this->engine->edit([
            'design' => $design,
            'op' => $op,
            'args' => is_array($args) ? $args : [],
            'scope' => $r->input('scope') === 'job' ? 'job' : 'module',
        ]));
    }

    public function nest(Request $r): Response
    {
        $sheet = $r->input('sheet');
        $items = $r->input('items');
        $lock = (bool) $r->input('grainLock', false);

        if (!is_array($sheet) || !isset($sheet['w'], $sheet['h'], $sheet['kerf'])) {
            throw HttpException::unprocessable('sheet must be {w,h,kerf}.', 'sheet');
        }
        if (!is_array($items)) {
            throw HttpException::unprocessable('items must be an array.', 'items');
        }
        foreach ($items as $i => $it) {
            if (!is_array($it) || !isset($it['name'], $it['length'], $it['width'], $it['key'])) {
                throw HttpException::unprocessable("items[$i] must have name,length,width,key.", 'items');
            }
        }

        $result = Nester::nest(
            ['w' => $sheet['w'], 'h' => $sheet['h'], 'kerf' => $sheet['kerf']],
            $lock,
            $items
        );
        return Response::json($result);
    }
}
