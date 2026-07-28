<?php

declare(strict_types=1);

namespace Standscale\Products\WallView\Engine;

/**
 * Sheet nesting (FFDH shelf packing) — a line-faithful port of the JS engine's
 * `nest()` / `groupKey()` in prototype/app.js. This is the first piece of the
 * "moat" moved server-side (ARCH-004 E1): the optimiser no longer ships to the
 * browser.
 *
 * Parity is exact by construction:
 *  - same descending-by-max-dimension comparator; PHP 8 usort is stable, as is
 *    V8 Array.sort, so ties keep input order identically;
 *  - identical IEEE-754 double arithmetic (kerf, level cursor, area);
 *  - Math.round on positive dimensions == (int) round() in PHP.
 * Verified against JS golden fixtures (see tests/NesterParityTest.php).
 *
 * Pure: input -> output, no I/O. Trivially cacheable and testable.
 */
final class Nester
{
    /**
     * @param array{name:string,length:int|float,width:int|float,thick?:int|float,key:string} $it
     */
    public static function groupKey(array $it): string
    {
        return $it['name']
            . '|' . (int) round((float) $it['length'])
            . '|' . (int) round((float) $it['width'])
            . '|' . (int) round((float) ($it['thick'] ?? 0))
            . '|' . $it['key'];
    }

    /**
     * @param array{w:int|float,h:int|float,kerf:int|float} $sheetSpec
     * @param array<int,array<string,mixed>> $items each: name,length,width,thick,key,srcId
     * @return array{sheets:array<int,array{levels:array,placements:array}>,utilisation:float,SW:float,SH:float}
     */
    public static function nest(array $sheetSpec, bool $lock, array $items): array
    {
        $SW = (float) $sheetSpec['w'];
        $SH = (float) $sheetSpec['h'];
        $kerf = (float) $sheetSpec['kerf'];

        $rects = [];
        foreach ($items as $it) {
            $rects[] = [
                'name' => $it['name'],
                'len' => (float) $it['length'],
                'wid' => (float) $it['width'],
                'gkey' => self::groupKey($it),
                'srcId' => $it['srcId'] ?? null,
            ];
        }
        // JS: rects.sort((a,b) => max(b.len,b.wid) - max(a.len,a.wid))  (descending, stable)
        usort($rects, static fn ($a, $b) => max($b['len'], $b['wid']) <=> max($a['len'], $a['wid']));

        /** @var array<int,array{levels:array<int,array{y:float,h:float,x:float}>,placements:array}> $sheets */
        $sheets = [];

        // Try to place a fw×fh footprint on sheet $si; mutates its levels; returns placement or null.
        $tryFootprint = static function (int $si, float $fw, float $fh) use (&$sheets, $SW, $SH, $kerf) {
            $levels = &$sheets[$si]['levels'];
            foreach ($levels as $li => $lvl) {
                if ($lvl['x'] + $fw <= $SW && $fh <= $lvl['h']) {
                    $p = ['x' => $lvl['x'], 'y' => $lvl['y'], 'w' => $fw, 'h' => $fh];
                    $levels[$li]['x'] = $lvl['x'] + $fw + $kerf;
                    unset($levels);
                    return $p;
                }
            }
            $n = count($levels);
            $top = $n ? ($levels[$n - 1]['y'] + $levels[$n - 1]['h'] + $kerf) : 0.0;
            if ($top + $fh <= $SH && $fw <= $SW) {
                $levels[] = ['y' => $top, 'h' => $fh, 'x' => $fw + $kerf];
                unset($levels);
                return ['x' => 0.0, 'y' => $top, 'w' => $fw, 'h' => $fh];
            }
            unset($levels);
            return null;
        };

        $tag = static fn (array $p, array $r, bool $rot): array => [
            'x' => $p['x'], 'y' => $p['y'], 'w' => $p['w'], 'h' => $p['h'],
            'name' => $r['name'], 'gkey' => $r['gkey'], 'srcId' => $r['srcId'], 'rot' => $rot,
        ];

        $tryPlace = static function (int $si, array $r) use ($tryFootprint, $tag, $lock) {
            $p = $tryFootprint($si, $r['len'], $r['wid']);
            if ($p) {
                return $tag($p, $r, false);
            }
            if ($lock) {
                return null;
            }
            $p = $tryFootprint($si, $r['wid'], $r['len']);
            if ($p) {
                return $tag($p, $r, true);
            }
            return null;
        };

        foreach ($rects as $r) {
            $placed = null;
            for ($si = 0, $c = count($sheets); $si < $c; $si++) {
                $placed = $tryPlace($si, $r);
                if ($placed) {
                    $sheets[$si]['placements'][] = $placed;
                    break;
                }
            }
            if (!$placed) {
                $sheets[] = ['levels' => [], 'placements' => []];
                $si = count($sheets) - 1;
                $p = $tryPlace($si, $r);
                if ($p) {
                    $sheets[$si]['placements'][] = $p;
                }
            }
        }

        $partArea = 0.0;
        foreach ($rects as $r) {
            $partArea += $r['len'] * $r['wid'];
        }
        $sheetArea = count($sheets) * $SW * $SH;

        return [
            'sheets' => $sheets,
            'utilisation' => $sheetArea ? $partArea / $sheetArea : 0.0,
            'SW' => $SW,
            'SH' => $SH,
        ];
    }
}
