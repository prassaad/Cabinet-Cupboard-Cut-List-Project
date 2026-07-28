<?php

declare(strict_types=1);

namespace Standscale\Tests;

use PHPUnit\Framework\TestCase;
use Standscale\Products\WallView\Engine\Nester;

/**
 * JS-vs-PHP nesting parity (ARCH-004 E1 risk control). Every case in
 * tests/parity/nest_golden.json was produced by the REAL JS engine
 * (prototype/app.js) via tests/parity/gen_golden.js. The PHP port must
 * reproduce each result exactly. Regenerate golden when the JS engine changes.
 */
final class NesterParityTest extends TestCase
{
    /** @return array<int,array{0:array,1:array,2:int}> */
    public function goldenCases(): array
    {
        $file = __DIR__ . '/parity/nest_golden.json';
        $golden = json_decode((string) file_get_contents($file), true);
        $out = [];
        foreach ($golden as $i => $g) {
            $out["case #$i"] = [$g['case'], $g['expected'], $i];
        }
        return $out;
    }

    /**
     * @dataProvider goldenCases
     * @param array $case     {sheet, grainLock, items}
     * @param array $expected the JS engine's output
     */
    public function testPhpMatchesJs(array $case, array $expected, int $i): void
    {
        $actual = Nester::nest($case['sheet'], (bool) $case['grainLock'], $case['items']);
        self::assertSame(
            $this->canon($expected),
            $this->canon($actual),
            "PHP nest diverged from JS on golden case #$i"
        );
    }

    /**
     * Canonicalise for comparison: sort object keys, keep list order, coerce all
     * numbers to 6-dp floats (so JS int 0 and PHP float 0.0 compare equal, and
     * IEEE rounding noise never trips the assertion). Bools/strings/null as-is.
     * @param mixed $v
     * @return mixed
     */
    private function canon($v)
    {
        if (is_array($v)) {
            if ($v !== [] && array_is_list($v)) {
                return array_map([$this, 'canon'], $v);
            }
            ksort($v);
            $out = [];
            foreach ($v as $k => $vv) {
                $out[$k] = $this->canon($vv);
            }
            return $out;
        }
        if (is_int($v) || is_float($v)) {
            return round((float) $v, 6);
        }
        return $v; // bool, string, null
    }
}
